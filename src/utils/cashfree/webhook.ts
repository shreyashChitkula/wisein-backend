import * as crypto from 'crypto';

/**
 * Verify Cashfree webhook signature.
 * Cashfree signs payload as base64(HMAC-SHA256(timestamp + rawBody)) using CASHFREE_WEBHOOK_SECRET
 */
export function verifyCashfreeWebhookSignature(
  timestamp: string,
  rawBody: string,
  signature: string,
): boolean {
  try {
    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || '';
    if (!webhookSecret) return false;

    const signatureData = `${timestamp}${rawBody}`;
    const computed = crypto
      .createHmac('sha256', webhookSecret)
      .update(signatureData)
      .digest('base64');
    return computed === signature;
  } catch (err) {
    return false;
  }
}
