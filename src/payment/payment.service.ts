import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private apiKey = process.env.CASHFREE_API_KEY || '';
  private apiSecret = process.env.CASHFREE_API_SECRET || '';
  private baseUrl = process.env.CASHFREE_BASE_URL || 'https://api.cashfree.com/pg';
  private apiVersion = '2022-09-01';

  async createPaymentOrder(amount: number, currency = 'INR', customerPhone?: string) {
    try {
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
          return_url: process.env.CASHFREE_ENV === 'production'
            ? `${process.env.FRONTEND_URL}/payment/success?order_id={order_id}`
            : `http://localhost:${process.env.PORT || 3000}/payment/success?order_id={order_id}`,
          notify_url: process.env.CASHFREE_ENV === 'production' ? `${process.env.API_URL || 'https://wisein.in'}/api/auth/webhooks/cashfree` : undefined,
        },
        order_note: 'Payment from backend',
      };

      this.logger.log(`Creating Cashfree order: ${orderId}`);
      const resp = await axios.post(`${this.baseUrl}/orders`, orderData, {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.apiKey,
          'x-client-secret': this.apiSecret,
          'x-api-version': this.apiVersion,
        },
      });

      const data = resp.data || {};
      const isProduction = process.env.CASHFREE_ENV === 'production';
      const paymentUrl = `https://payments${isProduction ? '' : '-test'}.cashfree.com/order/#${data.payment_session_id}`;

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

  async createSubscription(planId: string, customerId: string, customerPhone: string, amount: number, currency = 'INR') {
    try {
      const subscriptionId = `sub_${Date.now()}`;
      const subscriptionData = {
        subscription_id: subscriptionId,
        plan_id: planId,
        customer_id: customerId,
        customer_phone: customerPhone,
        customer_email: 'test@example.com',
        customer_name: 'Test Customer',
        subscription_amount: amount,
        subscription_currency: currency,
        return_url: process.env.CASHFREE_ENV === 'production'
          ? `${process.env.FRONTEND_URL}/payment/subscription-success?subscription_id={subscription_id}`
          : `http://localhost:${process.env.PORT || 3000}/payment/subscription-success?subscription_id={subscription_id}`,
        notify_url: process.env.CASHFREE_ENV === 'production' ? `${process.env.API_URL || 'https://wisein.in'}/api/auth/webhooks/cashfree` : undefined,
      };

      const resp = await axios.post(`${this.baseUrl}/subscriptions`, subscriptionData, {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.apiKey,
          'x-client-secret': this.apiSecret,
          'x-api-version': this.apiVersion,
        },
      });

      const data = resp.data || {};
      return {
        success: true,
        subscriptionId,
        payment_session_id: data.payment_session_id,
        paymentUrl: data.authorization_url || data.authorizationUrl,
        data,
      };
    } catch (error) {
      this.logger.error('createSubscription error', error?.response?.data || error.message);
      throw error;
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
}
