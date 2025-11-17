import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private apiKey = process.env.CASHFREE_API_KEY_PAYMENT || '';
  private apiSecret = process.env.CASHFREE_API_SECRET_PAYMENT || '';
  private baseUrl = process.env.CASHFREE_BASE_URL_PAYMENT || 'https://sandbox.cashfree.com/pg';
  private apiVersion = '2022-09-01';

  constructor(private readonly prisma: PrismaService) {}

  async createPaymentOrder(userId: string, amount: number, currency = 'INR', customerPhone?: string, subscriptionOptions?: { isSubscription: boolean; planId?: string; planType?: string; planName?: string }) {
  // Debug: Print Cashfree credentials and endpoint
  this.logger.log(`CASHFREE_API_KEY_PAYMENT: ${this.apiKey?.substring(0, 8)}...`);
  this.logger.log(`CASHFREE_API_SECRET_PAYMENT: ${this.apiSecret?.substring(0, 8)}...`);
  this.logger.log(`CASHFREE_BASE_URL_PAYMENT: ${this.baseUrl}`);
    try {
      // Ensure user has completed video verification before creating an order
      // const user = await this.prisma.user.findUnique({ where: { id: userId } });
      // if (!user) {
      //   throw new BadRequestException('User not found');
      // }
      // if (user.status !== 'VIDEO_VERIFIED') {
      //   throw new BadRequestException('User must complete video verification before making a payment');
      // }
      const orderId = `order_${Date.now()}`;
      const customerId = `customer_${Date.now()}`;
      const orderData = {
        order_id: orderId,
        order_amount: amount,
        order_currency: currency,
        customer_details: {
          customer_id: customerId,
          customer_phone: customerPhone,
          customer_email: 'test@example.com',
          customer_name: 'Test Customer',
        },
        order_meta: {
          return_url: process.env.CASHFREE_ENV_PAYMENT === 'production'
            ? `${process.env.FRONTEND_URL}/payment/success?order_id={order_id}`
            : `http://localhost:${process.env.PORT || 3000}/payment/success?order_id={order_id}`,
          notify_url: process.env.CASHFREE_ENV_PAYMENT === 'production' ? `${process.env.API_URL || 'https://wisein.in'}/api/payment/webhook` : undefined,
        },
        order_note: 'Payment from backend',
      };

      this.logger.log(`Creating Cashfree order: ${orderId} for user: ${userId}`);
      const resp = await axios.post(`${this.baseUrl}/orders`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.apiKey,
          'x-client-secret': this.apiSecret,
          'x-api-version': this.apiVersion,
        },
      });

      const data = resp.data || {};
      
      // Extract payment_session_id - this is requcired to construct the payment URL
      const paymentSessionId = data.payment_session_id;
      
      if (!paymentSessionId) {
        this.logger.error('No payment_session_id in Cashfree response', JSON.stringify(data, null, 2));
        throw new BadRequestException('Failed to create payment session: No payment_session_id in response');
      }

      // IMPORTANT: data.payments.url is an API endpoint, NOT a payment page URL
      // We must construct the payment URL from payment_session_id
      // Format: https://payments-test.cashfree.com/order/#{payment_session_id}
      const isProduction = process.env.CASHFREE_ENV_PAYMENT === 'production';
      const paymentBaseUrl = isProduction 
        ? 'https://payments.cashfree.com/order'
        : 'https://payments-test.cashfree.com/order';
      
      // Construct the payment URL with the session ID
      const paymentUrl = `${paymentBaseUrl}/#${paymentSessionId}`;
      
      this.logger.log(`Payment URL: ${paymentUrl}`);
      this.logger.log(`Payment Session ID: ${paymentSessionId}`);

      // Save order to database
      await this.prisma.paymentOrder.create({
        data: {
          userId,
          orderId: data.order_id || orderId,
          paymentSessionId: data.payment_session_id,
          amount,
          currency,
          status: 'PENDING',
          customerPhone,
          customerEmail: 'test@example.com',
          isSubscription: subscriptionOptions?.isSubscription || false,
          planId: subscriptionOptions?.planId,
          planType: subscriptionOptions?.planType as any,
          planName: subscriptionOptions?.planName,
        },
      });

      return {
        success: true,
        orderId: data.order_id || orderId,
        payment_session_id: data.payment_session_id,
        paymentUrl,
        data: data,
      };
    } catch (error) {
      this.logger.error('createPaymentOrder error', error?.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Process webhook event from Cashfree
   */
  async processWebhookEvent(payload: any) {
    try {
      const { order_id, payment_status, event_time } = payload;

      if (!order_id) {
        this.logger.warn('Webhook received with no order_id');
        return { processed: false };
      }

      this.logger.log(`Processing webhook for order ${order_id}, status: ${payment_status}`);

      // Update the order status in the database
      if (payment_status === 'SUCCESS') {
        await this.prisma.paymentOrder.updateMany({
          where: { orderId: order_id },
          data: {
            status: 'SUCCESS',
            cashfreeOrderId: order_id,
            updatedAt: new Date(),
          },
        });

        // Also create a payment record
        const order = await this.prisma.paymentOrder.findUnique({
          where: { orderId: order_id },
        });

        if (order) {
          await this.prisma.paymentRecord.create({
            data: {
              userId: order.userId,
              paymentType: order.isSubscription ? 'SUBSCRIPTION' : 'ORDER',
              orderId: order.id,
              amount: order.amount,
              currency: order.currency,
              status: 'SUCCESS',
              cashfreeOrderId: order_id,
              webhookPayload: payload,
              paidAt: new Date(),
            },
          });

          // If this is a subscription payment, activate the subscription
          if (order.isSubscription && order.planId && order.planType && order.planName) {
            const endDate = new Date();
            // Calculate end date based on plan (yearly vs monthly)
            if (order.planId.includes('yearly') || order.planId.includes('year')) {
              endDate.setFullYear(endDate.getFullYear() + 1);
            } else {
              endDate.setMonth(endDate.getMonth() + 1);
            }

            await this.prisma.subscription.upsert({
              where: { userId: order.userId },
              update: {
                cashfreeOrderId: order_id,
                cashfreePaymentId: payload.payment_id,
                status: 'ACTIVE',
                startDate: new Date(),
                endDate,
                autoRenew: true,
                planType: order.planType,
                planName: order.planName,
              },
              create: {
                userId: order.userId,
                planType: order.planType,
                planName: order.planName,
                cashfreeOrderId: order_id,
                cashfreePaymentId: payload.payment_id,
                status: 'ACTIVE',
                startDate: new Date(),
                endDate,
                autoRenew: true,
              },
            });

            // Update user status to ACTIVE
            await this.prisma.user.update({
              where: { id: order.userId },
              data: { status: 'ACTIVE' },
            });
          }
        }
      } else if (payment_status === 'FAILED') {
        await this.prisma.paymentOrder.updateMany({
          where: { orderId: order_id },
          data: { status: 'FAILED', updatedAt: new Date() },
        });
      }

      return { processed: true, orderId: order_id };
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      return { processed: false };
    }
  }


  verifyWebhookSignature(timestamp: string, rawBody: string, signature: string) {
    try {
      const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || '';
      if (!webhookSecret) return false;
      const signatureData = `${timestamp}${rawBody}`;
      const computed = crypto.createHmac('sha256', webhookSecret).update(signatureData).digest('base64');
      return computed === signature;
    } catch (err) {
      this.logger.error('verifyWebhookSignature error', err.message);
      return false;
    }
  }

  async getPaymentStatus(orderId: string) {
    try {
      const resp = await axios.get(`${this.baseUrl}/orders/${orderId}`, {
        headers: {
          'x-client-id': this.apiKey,
          'x-client-secret': this.apiSecret,
          'x-api-version': this.apiVersion,
        },
      });
      return { success: true, status: resp.data.order_status, data: resp.data };
    } catch (error) {
      this.logger.error('getPaymentStatus error', error?.response?.data || error.message);
      throw error;
    }
  }


  /**
   * Get user's payment history
   */
  async getUserPaymentHistory(userId: string) {
    try {
      const payments = await this.prisma.paymentRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50, // limit to last 50 records
      });

      const orders = await this.prisma.paymentOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return {
        payments,
        orders,
      };
    } catch (error) {
      this.logger.error('getUserPaymentHistory error', error);
      throw error;
    }
  }

  /**
   * Manually complete subscription for development/testing (when webhooks don't fire)
   */
  async completeSubscriptionManually(orderId: string, userId: string) {
    try {
      // Find the payment order
      const order = await this.prisma.paymentOrder.findUnique({
        where: { orderId },
      });

      if (!order) {
        throw new BadRequestException('Payment order not found');
      }

      if (order.userId !== userId) {
        throw new ForbiddenException('Order does not belong to user');
      }

      if (!order.isSubscription) {
        throw new BadRequestException('Order is not for subscription');
      }

      // Check if subscription already exists
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (existingSubscription) {
        return { message: 'Subscription already exists', subscription: existingSubscription };
      }

      // Create the subscription
      const endDate = new Date();
      if (order.planId?.includes('yearly') || order.planId?.includes('year')) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const subscription = await this.prisma.subscription.create({
        data: {
          userId: order.userId,
          planType: order.planType || 'INDIVIDUAL',
          planName: order.planName || 'Premium',
          cashfreeOrderId: orderId,
          cashfreePaymentId: `manual_${Date.now()}`,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate,
          autoRenew: true,
        },
      });

      // Update user status
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      });

      // Update payment order status
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'SUCCESS' },
      });

      // Create payment record
      await this.prisma.paymentRecord.create({
        data: {
          userId,
          paymentType: 'SUBSCRIPTION',
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          status: 'SUCCESS',
          cashfreeOrderId: orderId,
          paidAt: new Date(),
        },
      });

      return { message: 'Subscription completed successfully', subscription };
    } catch (error) {
      this.logger.error('completeSubscriptionManually error', error);
      throw error;
    }
  }
}
