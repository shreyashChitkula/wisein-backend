import { Controller, Post, Body, Get, Param, Headers, Req, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);
  constructor(private readonly paymentService: PaymentService) {}

  @Post('order')
  @UseGuards(JwtAuthGuard)
  async createOrder(@Req() req: any, @Body() body: { amount: number; currency?: string; phone?: string }) {
    const userId = req.user?.id;
    if (!userId) {
      return { success: false, message: 'User not authenticated' };
    }
    const { amount, currency = 'INR', phone } = body;
    return this.paymentService.createPaymentOrder(userId, amount, currency, phone);
  }


  @Get('status/:orderId')
  async getStatus(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(orderId);
  }


  @Get('history/:userId')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@Param('userId') userId: string) {
    return this.paymentService.getUserPaymentHistory(userId);
  }

  // Cashfree webhook receiver
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: any, @Headers() headers: any) {
    // Cashfree sends a timestamp and signature headers; accept multiple possible header names
    const signature = headers['x-cf-webhook-signature'] || headers['x-webhook-signature'] || headers['x-cf-signature'] || headers['signature'];
    const timestamp = headers['x-cf-webhook-timestamp'] || headers['x-timestamp'] || headers['timestamp'] || '';

    // raw body might be available as req.rawBody; fallback to stringified body
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body || {});

    const verified = this.paymentService.verifyWebhookSignature(timestamp, rawBody, signature);

    if (!verified) {
      this.logger.warn('Received webhook with invalid signature');
      return { success: false, message: 'invalid signature' };
    }

    // Process webhook payload
    const result = await this.paymentService.processWebhookEvent(req.body);
    
    this.logger.log(`Webhook processed: ${JSON.stringify(result)}`);

    return { success: true, result };
  }
}
