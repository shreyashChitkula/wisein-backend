import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SelectSubscriptionPlanDto } from '../dtos';

// TODO: Integrate with Cashfree SDK
// import Cashfree from 'cashfree-pg';

@Injectable()
export class SubscriptionService {
  private cashfree: any; // Cashfree instance

  constructor(private prisma: PrismaService) {
    // Initialize Cashfree with API keys
    // this.cashfree = new Cashfree({
    //   appId: process.env.CASHFREE_APP_ID,
    //   secretKey: process.env.CASHFREE_SECRET_KEY,
    // });
  }

  /**
   * Get available subscription plans
   */
  async getAvailablePlans(): Promise<{
    individualPlans: any[];
    companyPlans: any[];
  }> {
    // TODO: Fetch plans from Stripe or database
    const plans = {
      individualPlans: [
        {
          id: 'price_individual_pro',
          name: 'Pro',
          price: 9.99,
          currency: 'USD',
          features: ['1:1 calls', 'Post feature', 'Job applications'],
        },
        {
          id: 'price_individual_premium',
          name: 'Premium',
          price: 19.99,
          currency: 'USD',
          features: [
            'Unlimited 1:1 calls',
            'Post feature',
            'Job applications',
            'AI summaries',
          ],
        },
      ],
      companyPlans: [
        {
          id: 'price_company_startup',
          name: 'Startup',
          price: 49.99,
          currency: 'USD',
          features: ['Up to 5 job postings', 'Applicant tracking'],
        },
        {
          id: 'price_company_enterprise',
          name: 'Enterprise',
          price: 199.99,
          currency: 'USD',
          features: [
            'Unlimited job postings',
            'Advanced analytics',
            'Dedicated support',
          ],
        },
      ],
    };

    return plans;
  }

  /**
   * Step 6: Create checkout session for subscription
   */
  async createCheckoutSession(
    userId: string,
    planDto: SelectSubscriptionPlanDto,
  ): Promise<{
    orderId: string;
    url: string;
    message: string;
  }> {
    // TODO: Implement Cashfree order creation
    // const order = await this.cashfree.orders.create({
    //   order_id: `ORDER_${userId}_${Date.now()}`,
    //   order_amount: planDto.amount,
    //   order_currency: 'INR',
    //   customer_details: {
    //     customer_id: userId,
    //   },
    //   order_meta: {
    //     return_url: `${process.env.FRONTEND_URL}/subscription-success?order_id={order_id}`,
    //     notify_url: `${process.env.API_URL}/auth/webhooks/cashfree`,
    //   },
    //   order_tags: {
    //     planType: planDto.planType,
    //     planName: planDto.planName,
    //   },
    // });

    // Placeholder response
    const orderId = `ORD_${Math.random().toString(36).substr(2, 9)}`;
    const url = `https://checkout.cashfree.com/${orderId}`;

    return {
      orderId,
      url,
      message: 'Checkout session created successfully',
    };
  }

  /**
   * Handle successful subscription payment
   */
  async handleSubscriptionSuccess(
    userId: string,
    cashfreeOrderId: string,
    cashfreePaymentId: string,
    planType: string,
    planName: string,
  ): Promise<{
    subscriptionId: string;
    message: string;
  }> {
    // Calculate subscription end date (e.g., 1 month from now)
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // Create subscription record
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

    // Update user status to ACTIVE
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    return {
      subscriptionId: subscription.id,
      message: 'Subscription activated successfully. Welcome to the platform!',
    };
  }

  /**
   * Get user's current subscription
   */
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

    if (!subscription) {
      return null;
    }

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

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<{
    message: string;
  }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription found');
    }

    // TODO: Cancel subscription in Cashfree
    // if (subscription.cashfreeOrderId) {
    //   await this.cashfree.orders.cancel(subscription.cashfreeOrderId);
    // }

    // Update subscription status
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });

    // Update user status
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'APPROVED' }, // Back to approved but not active
    });

    return {
      message: 'Subscription cancelled successfully',
    };
  }

  /**
   * Handle subscription renewal via Cashfree webhook
   */
  async handleSubscriptionRenewal(cashfreeOrderId: string): Promise<void> {
    // Find subscription by Cashfree Order ID using findFirst (since it's not unique)
    const subscription = await this.prisma.subscription.findFirst({
      where: { cashfreeOrderId },
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    // Update end date
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        endDate: newEndDate,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Handle subscription cancellation via Cashfree webhook
   */
  async handleSubscriptionCancelled(cashfreeOrderId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { cashfreeOrderId },
    });

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
    });

    // Update user status back to APPROVED
    await this.prisma.user.update({
      where: { id: subscription.userId },
      data: { status: 'APPROVED' },
    });
  }
}
