import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SelectSubscriptionPlanDto } from '../dtos';
import { PaymentService } from '../../payment/payment.service';
import { MailService } from '../../shared/mail/mail.service';
import axios from 'axios';

@Injectable()
export class SubscriptionService {
  private logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private mailService: MailService,
  ) {}

  async getAvailablePlans(): Promise<{
    individualPlans: any[];
    companyPlans: any[];
  }> {
    return {
      individualPlans: [
        {
          id: 'ind_in_monthly',
          name: 'Individual India Monthly',
          price: 149,
          currency: 'INR',
          region: 'IN',
          billingCycle: 'monthly',
        },
        {
          id: 'ind_in_yearly',
          name: 'Individual India Yearly',
          price: 1499,
          currency: 'INR',
          region: 'IN',
          billingCycle: 'yearly',
        },
        {
          id: 'ind_int_monthly',
          name: 'Individual International Monthly',
          price: 9.99,
          currency: 'USD',
          region: 'INTL',
          billingCycle: 'monthly',
        },
        {
          id: 'ind_int_yearly',
          name: 'Individual International Yearly',
          price: 99.99,
          currency: 'USD',
          region: 'INTL',
          billingCycle: 'yearly',
        },
      ],
      companyPlans: [
        {
          id: 'comp_in_monthly',
          name: 'Company India Monthly',
          price: 499,
          currency: 'INR',
          region: 'IN',
          billingCycle: 'monthly',
        },
        {
          id: 'comp_in_yearly',
          name: 'Company India Yearly',
          price: 4999,
          currency: 'INR',
          region: 'IN',
          billingCycle: 'yearly',
        },
        {
          id: 'comp_int_monthly',
          name: 'Company International Monthly',
          price: 49.99,
          currency: 'USD',
          region: 'INTL',
          billingCycle: 'monthly',
        },
        {
          id: 'comp_int_yearly',
          name: 'Company International Yearly',
          price: 499.99,
          currency: 'USD',
          region: 'INTL',
          billingCycle: 'yearly',
        },
      ],
    };
  }

  // Use payments module for payment operations
  async createCheckoutSession(
    userId: string,
    planDto: { planId: string },
  ): Promise<{
    orderId: string;
    paymentSessionId?: string;
    url: string;
    message: string;
  }> {
    // Get plan details by planId
    const plans = await this.getAvailablePlans();
    const all = [...plans.individualPlans, ...plans.companyPlans];
    const match = all.find((p) => p.id === planDto.planId);
    if (!match) throw new BadRequestException('Invalid planId');
    const orderAmount = match.price;
    const currency = match.currency;

    // Call payments module to create payment order
    const paymentResult = await this.paymentService.createPaymentOrder(
      userId,
      orderAmount,
      currency,
      '7036716403', // customerPhone, if needed
      {
        isSubscription: true,
        planId: planDto.planId,
        planType: match.id.startsWith('ind') ? 'INDIVIDUAL' : 'COMPANY',
        planName: match.name,
      },
    );

    return {
      orderId: paymentResult.orderId,
      paymentSessionId: paymentResult.payment_session_id,
      url: paymentResult.paymentUrl,
      message: 'Checkout session created successfully',
    };
  }

  // On successful payment, add active subscription
  async handleSubscriptionSuccess(
    userId: string,
    cashfreeOrderId: string,
    cashfreePaymentId: string,
    planType: string,
    planName: string,
  ): Promise<{ subscriptionId: string; message: string }> {
    // Validate payment status using payments module
    const paymentStatus =
      await this.paymentService.getPaymentStatus(cashfreeOrderId);
    if (!paymentStatus.success || paymentStatus.status !== 'SUCCESS') {
      throw new BadRequestException('Payment not successful');
    }
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        cashfreeOrderId,
        cashfreePaymentId,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate,
        autoRenew: true,
      },
      create: {
        userId,
        planType: planType as any,
        planName,
        cashfreeOrderId,
        cashfreePaymentId,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate,
        autoRenew: true,
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
    return {
      subscriptionId: subscription.id,
      message: 'Subscription activated successfully. Welcome to the platform!',
    };
  }

  async getUserSubscription(userId: string): Promise<{
    subscriptionId: string;
    planType: string;
    planName: string;
    status: string;
    startDate: Date;
    endDate: Date;
    autoRenew: boolean;
  } | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription) return null;
    return {
      subscriptionId: subscription.id,
      planType: subscription.planType,
      planName: subscription.planName,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      autoRenew: subscription.autoRenew,
    };
  }

  async cancelSubscription(userId: string): Promise<{ message: string }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription)
      throw new BadRequestException('No active subscription found');
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'APPROVED' },
    });

    // Send payment cancellation email
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.email) {
        await this.mailService.sendPaymentCancellation(
          user.email,
          user.name || undefined,
        );
      }
    } catch (emailError) {
      this.logger.error(
        'Failed to send payment cancellation email',
        emailError,
      );
    }

    return { message: 'Subscription cancelled successfully' };
  }

  async handleSubscriptionRenewal(cashfreeOrderId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { cashfreeOrderId },
    });
    if (!subscription) throw new BadRequestException('Subscription not found');
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + 1);
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { endDate: newEndDate, status: 'ACTIVE' },
    });
  }

  async handleSubscriptionCancelled(cashfreeOrderId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { cashfreeOrderId },
    });
    if (!subscription) throw new BadRequestException('Subscription not found');
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });
    await this.prisma.user.update({
      where: { id: subscription.userId },
      data: { status: 'APPROVED' },
    });
  }
}
