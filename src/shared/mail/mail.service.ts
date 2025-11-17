import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    const service = process.env.EMAIL_SERVICE || 'nodemailer';

    // For now we support nodemailer (SMTP). In future we can add AWS SES here.
    if (service === 'nodemailer') {
      const host = process.env.SMTP_HOST || 'localhost';
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = (process.env.SMTP_SECURE || 'false') === 'true';

      const authUser = process.env.SMTP_USER || '';
      const authPass = process.env.SMTP_PASS || '';

      const transportOptions: any = {
        host,
        port,
        secure,
        auth:
          authUser && authPass ? { user: authUser, pass: authPass } : undefined,
      };

      this.transporter = nodemailer.createTransport(transportOptions);

      // verify transport on startup (best-effort)
      this.transporter
        .verify()
        .then(() => {
          this.logger.log('SMTP transporter verified');
        })
        .catch((err) => {
          this.logger.warn(
            'SMTP transporter verification failed: ' + err?.message,
          );
        });
    } else {
      // Fallback to a no-op transporter that logs messages.
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      } as any);
    }
  }

  async sendMail(opts: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: string;
  }) {
    const from = opts.from || process.env.MAIL_FROM || 'no-reply@example.com';

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent to ${opts.to}: ${info?.messageId || JSON.stringify(info)}`,
      );
      return info;
    } catch (err) {
      this.logger.error('Failed to send email: ' + err?.message, err);
      throw err;
    }
  }

  /**
   * Send OTP email with different templates for registration and login.
   *
   * @param to Recipient email address
   * @param otp 6-digit OTP code
   * @param purpose 'register' | 'login' (controls subject/body)
   * @param name Optional display name or username to personalize the email
   */
  async sendOtp(
    to: string,
    otp: string,
    purpose: 'register' | 'login' = 'login',
    name?: string,
  ) {
    const displayName = name || 'User';

    if (purpose === 'register') {
      const subject = 'Your WiseIN Verification Code';
      const text = `Dear ${displayName},\n\nThank you for registering with WiseIN. To complete your signup process, please use the following one-time verification code (OTP):\n\n${otp}\n\nFor your security, please do not share this code with anyone. If you did not request this, please ignore this email or contact our support team.\n\nKind regards,\nWiseIN Team`;
      const html = `
        <p>Dear ${displayName},</p>
        <p>Thank you for registering with <strong>WiseIN</strong>. To complete your signup process, please use the following one-time verification code (OTP):</p>
        <h2 style="letter-spacing:4px">${otp}</h2>
        <p>For your security, please do not share this code with anyone. If you did not request this, please ignore this email or contact our support team.</p>
        <p>Kind regards,<br/>WiseIN Team</p>
      `;

      return this.sendMail({ to, subject, text, html });
    }

    // login
    const subject = 'WiseIN Login Verification Code';
    const text = `Dear ${displayName},\n\nYour one-time verification code to access your WiseIN account is:\n\n${otp}\n\nPlease enter this code to securely log in. If you did not initiate this request, please reach out to our support team immediately.\n\nSincerely,\nWiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>Your one-time verification code to access your <strong>WiseIN</strong> account is:</p>
      <h2 style="letter-spacing:4px">${otp}</h2>
      <p>Please enter this code to securely log in. If you did not initiate this request, please reach out to our support team immediately.</p>
      <p>Sincerely,<br/>WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send verification pending email
   */
  async sendVerificationPending(to: string, name?: string) {
    const displayName = name || 'User';
    const subject = 'Verification Under Review – WiseIN Account';
    const text = `Dear ${displayName},\n\nThank you for submitting your verification details on WiseIN. Your information is currently under review as part of our commitment to maintaining a trusted and secure professional community.\n\nVerification Status: Pending\nEstimated Completion Time: Within 24 hours\n\nWe appreciate your patience and will inform you promptly upon completion or if additional information is required. Should you have any questions, please contact our support team at Support@wisein.in.\n\nBest regards,\nWiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>Thank you for submitting your verification details on <strong>WiseIN</strong>. Your information is currently under review as part of our commitment to maintaining a trusted and secure professional community.</p>
      <p><strong>Verification Status:</strong> Pending</p>
      <p><strong>Estimated Completion Time:</strong> Within 24 hours</p>
      <p>We appreciate your patience and will inform you promptly upon completion or if additional information is required. Should you have any questions, please contact our support team at <a href="mailto:Support@wisein.in">Support@wisein.in</a>.</p>
      <p>Best regards,<br/>WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send verification rejected email
   */
  async sendVerificationRejected(to: string, name?: string, reasons?: string) {
    const displayName = name || 'User';
    const subject = 'Verification Unsuccessful – Action Needed';
    const text = `Dear ${displayName},\n\nUnfortunately, your recent verification attempt was unsuccessful due to the following issue(s):\n${reasons || 'Incomplete information, mismatched credentials'}.\n\nVerification Status: Rejected\n\nTo continue benefiting from WiseIN's features, please update and resubmit your verification information at your earliest convenience: [Verification Link]\n\nIf you believe this was in error or have questions, feel free to contact our support team for assistance.\n\nSincerely,\nWiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>Unfortunately, your recent verification attempt was unsuccessful due to the following issue(s):</p>
      <p>${reasons || 'Incomplete information, mismatched credentials'}.</p>
      <p><strong>Verification Status:</strong> Rejected</p>
      <p>To continue benefiting from WiseIN's features, please update and resubmit your verification information at your earliest convenience: [Verification Link]</p>
      <p>If you believe this was in error or have questions, feel free to contact our support team for assistance.</p>
      <p>Sincerely,<br/>WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send retry verification reminder email
   */
  async sendRetryVerificationReminder(to: string, name?: string) {
    const displayName = name || 'User';
    const subject = 'Reminder: Complete Your WiseIN Verification';
    const text = `Dear ${displayName},\n\nThis is a gentle reminder to complete your WiseIN verification to unlock full access to our platform.\n\nPlease update and resubmit your verification documents here: [Verification Link]\n\nOur support team is available to assist you with any questions.\n\nKind regards,\nWiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>This is a gentle reminder to complete your WiseIN verification to unlock full access to our platform.</p>
      <p>Please update and resubmit your verification documents here: [Verification Link]</p>
      <p>Our support team is available to assist you with any questions.</p>
      <p>Kind regards,<br/>WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send re-verification video instruction email
   */
  async sendReVerificationVideoInstruction(to: string, name?: string) {
    const displayName = name || 'User';
    const subject = 'How to Complete Your WiseIN Verification – Video Guide';
    const text = `Dear ${displayName},\n\nTo assist you in completing your verification, we have prepared a step-by-step video guide which you can access here: [Watch Verification Guide].\n\nFollowing this tutorial will help ensure your verification documents are accepted in a timely manner.\n\nIf you require further assistance, please contact our support team at Support@wisein.in.\n\nBest wishes,\nWiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>To assist you in completing your verification, we have prepared a step-by-step video guide which you can access here: [Watch Verification Guide].</p>
      <p>Following this tutorial will help ensure your verification documents are accepted in a timely manner.</p>
      <p>If you require further assistance, please contact our support team at <a href="mailto:Support@wisein.in">Support@wisein.in</a>.</p>
      <p>Best wishes,<br/>WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send verification approved email
   */
  async sendVerificationApproved(to: string, name?: string) {
    const displayName = name || 'User';
    const subject = 'Congratulations – Your WiseIN Verification is Approved';
    const text = `Dear ${displayName},\n\nWe are pleased to inform you that your WiseIN verification has been successfully completed. You now have full access to all platform features and can begin making meaningful professional connections.\n\nVerification Status: Verified\n\nAccess your account here: [Login Link]\n\nShould you need any assistance, our support team is ready to help.\n\nWarm regards,\nWiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>We are pleased to inform you that your WiseIN verification has been successfully completed. You now have full access to all platform features and can begin making meaningful professional connections.</p>
      <p><strong>Verification Status:</strong> Verified</p>
      <p>Access your account here: [Login Link]</p>
      <p>Should you need any assistance, our support team is ready to help.</p>
      <p>Warm regards,<br/>WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send final welcome email
   */
  async sendFinalWelcome(to: string, name?: string) {
    const displayName = name || 'User';
    const subject = 'Welcome to WiseIN – Begin Your Professional Journey';
    const text = `Dear ${displayName},\n\nWelcome to WiseIN! We are delighted to have you join our community of verified professionals dedicated to authentic networking and collaboration.\n\nHere are some steps to get started:\n- Complete your profile to improve connection opportunities\n- Engage with verified professionals across diverse fields\n- Participate in meaningful conversations and events\n\nBegin your journey here: [Login Link]\n\nIf you have any questions or need support, please reach out at any time.\n\nSincerely,\nWiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>Welcome to <strong>WiseIN</strong>! We are delighted to have you join our community of verified professionals dedicated to authentic networking and collaboration.</p>
      <p>Here are some steps to get started:</p>
      <ul>
        <li>Complete your profile to improve connection opportunities</li>
        <li>Engage with verified professionals across diverse fields</li>
        <li>Participate in meaningful conversations and events</li>
      </ul>
      <p>Begin your journey here: [Login Link]</p>
      <p>If you have any questions or need support, please reach out at any time.</p>
      <p>Sincerely,<br/>WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send payment completed email
   */
  async sendPaymentCompleted(
    to: string,
    name?: string,
    amount?: string,
    date?: string,
    transactionId?: string,
  ) {
    const displayName = name || 'User';
    const subject = 'Payment Confirmation from WiseIN';
    const text = `Dear ${displayName},\n\nThank you for your payment. We have successfully processed your transaction for your WiseIN subscription.\n\nPayment Details:\nAmount: ${amount || '[Amount]'}\nDate: ${date || '[Payment Date]'}\nTransaction ID: ${transactionId || '[Transaction ID]'}\n\nYour subscription is now active, and you have full access to all included features.\n\nIf you have any questions or require assistance, please contact our support team at Support@wisein.in.\n\nThank you for choosing WiseIN.\n\nWarm regards,\nThe WiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>Thank you for your payment. We have successfully processed your transaction for your WiseIN subscription.</p>
      <p><strong>Payment Details:</strong></p>
      <ul>
        <li><strong>Amount:</strong> ${amount || '[Amount]'}</li>
        <li><strong>Date:</strong> ${date || '[Payment Date]'}</li>
        <li><strong>Transaction ID:</strong> ${transactionId || '[Transaction ID]'}</li>
      </ul>
      <p>Your subscription is now active, and you have full access to all included features.</p>
      <p>If you have any questions or require assistance, please contact our support team at <a href="mailto:Support@wisein.in">Support@wisein.in</a>.</p>
      <p>Thank you for choosing WiseIN.</p>
      <p>Warm regards,<br/>The WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send payment retry email
   */
  async sendPaymentRetry(to: string, name?: string) {
    const displayName = name || 'User';
    const subject = 'Payment Unsuccessful – Please Retry Your WiseIN Payment';
    const text = `Dear ${displayName},\n\nWe were unable to process your recent payment attempt for WiseIN. To ensure uninterrupted access to your account and its features, please retry your payment at your earliest convenience.\n\nIf you require assistance or have questions, do not hesitate to contact our support team at Support@wisein.in.\n\nThank you for your prompt attention to this matter.\n\nSincerely,\nThe WiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>We were unable to process your recent payment attempt for <strong>WiseIN</strong>. To ensure uninterrupted access to your account and its features, please retry your payment at your earliest convenience.</p>
      <p>If you require assistance or have questions, do not hesitate to contact our support team at <a href="mailto:Support@wisein.in">Support@wisein.in</a>.</p>
      <p>Thank you for your prompt attention to this matter.</p>
      <p>Sincerely,<br/>The WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send payment cancellation email
   */
  async sendPaymentCancellation(to: string, name?: string) {
    const displayName = name || 'User';
    const subject = 'WiseIN Subscription Payment Canceled';
    const text = `Dear ${displayName},\n\nWe have received your request or noted that your payment for WiseIN subscription has been canceled. Please be aware that your access to premium features may be limited until payment is resumed.\n\nIf this cancellation was unexpected or if you would like to reactivate your subscription, please contact our support team or visit your account settings.\n\nThank you for being part of WiseIN.\n\nBest regards,\nThe WiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>We have received your request or noted that your payment for WiseIN subscription has been canceled. Please be aware that your access to premium features may be limited until payment is resumed.</p>
      <p>If this cancellation was unexpected or if you would like to reactivate your subscription, please contact our support team or visit your account settings.</p>
      <p>Thank you for being part of WiseIN.</p>
      <p>Best regards,<br/>The WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send payment successful email
   */
  async sendPaymentSuccessful(
    to: string,
    name?: string,
    amount?: string,
    date?: string,
    transactionId?: string,
  ) {
    const displayName = name || 'User';
    const subject =
      'Your Payment Was Successful – Welcome to Full Access on WiseIN';
    const text = `Dear ${displayName},\n\nGood news! Your payment has been successfully received, and your WiseIN subscription is now active. You can enjoy full access to all our professional networking features.\n\nTransaction Details:\nAmount: ${amount || '[Amount]'}\nPayment Date: ${date || '[Date]'}\nTransaction ID: ${transactionId || '[Transaction ID]'}\n\nWe're excited to support your journey on WiseIN. For any questions or assistance, please contact us at Support@wisein.in.\n\nWarm regards,\nThe WiseIN Team`;
    const html = `
      <p>Dear ${displayName},</p>
      <p>Good news! Your payment has been successfully received, and your WiseIN subscription is now active. You can enjoy full access to all our professional networking features.</p>
      <p><strong>Transaction Details:</strong></p>
      <ul>
        <li><strong>Amount:</strong> ${amount || '[Amount]'}</li>
        <li><strong>Payment Date:</strong> ${date || '[Date]'}</li>
        <li><strong>Transaction ID:</strong> ${transactionId || '[Transaction ID]'}</li>
      </ul>
      <p>We're excited to support your journey on WiseIN. For any questions or assistance, please contact us at <a href="mailto:Support@wisein.in">Support@wisein.in</a>.</p>
      <p>Warm regards,<br/>The WiseIN Team</p>
    `;

    return this.sendMail({ to, subject, text, html });
  }
}
