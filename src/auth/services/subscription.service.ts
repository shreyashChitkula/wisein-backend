import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SelectSubscriptionPlanDto } from '../dtos';
import axios from 'axios';

@Injectable()
export class SubscriptionService {
  private logger = new Logger(SubscriptionService.name);

  constructor(private prisma: PrismaService) {}

  async getAvailablePlans(): Promise<{ individualPlans: any[]; companyPlans: any[] }> {
    return {
      individualPlans: [
        { id: 'price_individual_pro', name: 'Pro', price: 9.99, currency: 'USD', features: ['1:1 calls'] },
        { id: 'price_individual_premium', name: 'Premium', price: 19.99, currency: 'USD', features: ['Unlimited 1:1 calls'] },
      ],
      companyPlans: [
        { id: 'price_company_startup', name: 'Startup', price: 49.99, currency: 'USD', features: ['Up to 5 job postings'] },
        { id: 'price_company_enterprise', name: 'Enterprise', price: 199.99, currency: 'USD', features: ['Unlimited job postings'] },
      ],
    };
  }

  async createCheckoutSession(
    userId: string,
    planDto: SelectSubscriptionPlanDto,
  ): Promise<{ orderId: string; paymentSessionId?: string; url: string; message: string }> {
    const baseUrl = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';
    const apiKey = process.env.CASHFREE_API_KEY || '';
    const apiSecret = process.env.CASHFREE_API_SECRET || '';
    const apiVersion = '2022-09-01';

    if (!apiKey || !apiSecret) {
      this.logger.warn('Cashfree credentials missing; returning mock checkout URL');
      const mockOrderId = `ORD_${Math.random().toString(36).substr(2, 9)}`;
      return { orderId: mockOrderId, url: `https://checkout.cashfree.com/${mockOrderId}`, message: 'Mock checkout session (CASHFREE not configured)' };
    }

    const orderId = `order_${Date.now()}`;
    // planDto coming from controller may not include amount. Prefer provided amount, else look up from available plans or fallback.
    let orderAmount = 0;
    if ((planDto as any).amount) {
      orderAmount = Number((planDto as any).amount);
    } else {
      try {
        const plans = await this.getAvailablePlans();
        const all = [...plans.individualPlans, ...plans.companyPlans];
        const match = all.find((p) => p.name === (planDto as any).planName || p.id === (planDto as any).planName);
        orderAmount = match ? match.price : 149; // fallback amount (INR)
      } catch (e) {
        orderAmount = 149;
      }
    }
    const isProduction = process.env.CASHFREE_ENV === 'production';

    const returnUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/subscription-success?order_id={order_id}`
      : `http://localhost:${process.env.PORT || 3000}/subscription-success?order_id={order_id}`;

    const notifyUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/auth/webhooks/cashfree`;

    const orderData = {
      order_id: orderId,
      order_amount: orderAmount,
  order_currency: (planDto as any).currency || 'INR',
      customer_details: { customer_id: userId },
      order_meta: { return_url: returnUrl, notify_url: notifyUrl },
      order_note: `Subscription checkout for user ${userId}`,
    };

    try {
      this.logger.log(`Creating Cashfree order ${orderId} amount=${orderAmount}`);
      const resp = await axios.post(`${baseUrl}/orders`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': apiKey,
          'x-client-secret': apiSecret,
          'x-api-version': apiVersion,
        },
      });

      const data = resp.data || {};
      const paymentSessionId = data.payment_session_id;
      const paymentUrl = `https://payments${isProduction ? '' : '-test'}.cashfree.com/order/#${paymentSessionId}`;
      return { orderId, paymentSessionId, url: paymentUrl, message: 'Checkout session created successfully' };
    } catch (err) {
      this.logger.error('Cashfree order creation failed', err?.response?.data || err.message);
      const fallbackOrderId = `ORD_${Math.random().toString(36).substr(2, 9)}`;
      return { orderId: fallbackOrderId, url: `https://checkout.cashfree.com/${fallbackOrderId}`, message: `Failed to create checkout session: ${err?.response?.data?.message || err.message}` };
    }
  }

  async handleSubscriptionSuccess(
    userId: string,
    cashfreeOrderId: string,
    cashfreePaymentId: string,
    planType: string,
    planName: string,
  ): Promise<{ subscriptionId: string; message: string }> {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: { cashfreeOrderId, cashfreePaymentId, status: 'ACTIVE', startDate: new Date(), endDate, autoRenew: true },
      create: { userId, planType: planType as any, planName, cashfreeOrderId, cashfreePaymentId, status: 'ACTIVE', startDate: new Date(), endDate, autoRenew: true },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    return { subscriptionId: subscription.id, message: 'Subscription activated successfully. Welcome to the platform!' };
  }

  async getUserSubscription(userId: string): Promise<{ subscriptionId: string; planType: string; planName: string; status: string; startDate: Date; endDate: Date; autoRenew: boolean } | null> {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) return null;
    return { subscriptionId: subscription.id, planType: subscription.planType, planName: subscription.planName, status: subscription.status, startDate: subscription.startDate, endDate: subscription.endDate, autoRenew: subscription.autoRenew };
  }

  async cancelSubscription(userId: string): Promise<{ message: string }> {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new BadRequestException('No active subscription found');
    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELLED' } });
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'APPROVED' } });
    return { message: 'Subscription cancelled successfully' };
  }

  async handleSubscriptionRenewal(cashfreeOrderId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({ where: { cashfreeOrderId } });
    if (!subscription) throw new BadRequestException('Subscription not found');
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + 1);
    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { endDate: newEndDate, status: 'ACTIVE' } });
  }

  async handleSubscriptionCancelled(cashfreeOrderId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({ where: { cashfreeOrderId } });
    if (!subscription) throw new BadRequestException('Subscription not found');
    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELLED' } });
    await this.prisma.user.update({ where: { id: subscription.userId }, data: { status: 'APPROVED' } });
  }
}

