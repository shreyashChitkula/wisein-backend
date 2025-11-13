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
        auth: authUser && authPass ? { user: authUser, pass: authPass } : undefined,
      };

      this.transporter = nodemailer.createTransport(transportOptions);

      // verify transport on startup (best-effort)
      this.transporter.verify().then(() => {
        this.logger.log('SMTP transporter verified');
      }).catch((err) => {
        this.logger.warn('SMTP transporter verification failed: ' + err?.message);
      });
    } else {
      // Fallback to a no-op transporter that logs messages.
      this.transporter = nodemailer.createTransport({ jsonTransport: true } as any);
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
      this.logger.log(`Email sent to ${opts.to}: ${info?.messageId || JSON.stringify(info)}`);
      return info;
    } catch (err) {
      this.logger.error('Failed to send email: ' + err?.message, err as any);
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
}
