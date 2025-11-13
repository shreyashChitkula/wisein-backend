import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { MailService } from '../../shared/mail/mail.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  /**
   * In-memory OTP store (development only; use Redis in production).
   * 
   * Key: email address
   * Value: {
   *   otp: 6-digit code
   *   expiresAt: expiry timestamp (10 minutes from generation)
   *   attempts: failed attempt counter (max 3)
   *   purpose: 'register' | 'login' (disambiguates flow)
   *   username: provided for registration flow only
   * }
   * 
   * TODO: Migrate to Redis for production deployments.
   */
  private otpStore: Map<
    string,
    { otp: string; expiresAt: Date; attempts: number; purpose: 'register' | 'login'; username?: string }
  > = new Map();

  constructor(private prisma: PrismaService, private mailService: MailService) {}

  /**
   * Generate a random 6-digit OTP.
   * @private
   * @returns string A 6-digit OTP code.
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Retrieve OTP for testing (development only).
   * Used by the debug endpoint GET /auth/debug/otp to return the in-memory OTP.
   * 
   * @param email The email address for which to retrieve the OTP.
   * @returns The 6-digit OTP or undefined if not found.
   */
  getOtpForTesting(email: string): string | undefined {
    return this.otpStore.get(email)?.otp;
  }

  /**
   * Send OTP via email for either registration or login.
   * 
   * **Registration Flow (when username is provided):**
   * 1. Validates email and username are unique.
   * 2. Creates a new user with status REGISTERED.
   * 3. Generates and stores OTP with purpose='register'.
   * 4. Sends OTP email.
   * 
   * **Login Flow (when username is not provided):**
   * 1. Validates user exists and is EMAIL_VERIFIED or higher.
   * 2. Generates and stores OTP with purpose='login'.
   * 3. Sends OTP email.
   * 
   * @param email User's email address.
   * @param options Optional: { username, purpose }
   *   - username: provided for registration; triggers registration flow if present.
   *   - purpose: explicit flow purpose; auto-detected if not provided.
   * @returns { message, status, userId? } userId included for registration only.
   * @throws ConflictException if email or username already exists (registration).
   * @throws ConflictException if user not found (login).
   * @throws BadRequestException if user not verified (login).
   */
  async sendOtp(email: string, options?: { username?: string; purpose?: 'register' | 'login' }): Promise<{ message: string; status: number; userId?: string }> {
    const purpose = options?.purpose ?? (options?.username ? 'register' : 'login');
    this.logger.log(`[sendOtp] Processing send-otp for ${email} purpose=${purpose} username=${options?.username}`);

    if (purpose === 'register') {
      const username = options?.username;

      // Check if email already has a user
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        this.logger.warn(`[sendOtp] User already exists: ${email}`);
        throw new ConflictException('User already exists with this email');
      }

      // Check if username is unique
      if (username) {
        const existingUsername = await this.prisma.user.findUnique({ where: { username } });
        if (existingUsername) {
          this.logger.warn(`[sendOtp] Username already taken: ${username}`);
          throw new ConflictException('Username already taken');
        }
      }

      // Create user with REGISTERED status
      const user = await this.prisma.user.create({ data: { email, username, role: 'INDIVIDUAL', status: 'REGISTERED' } });
      this.logger.log(`[sendOtp] User created with ID: ${user.id}`);

      // Generate and store OTP
      const otp = this.generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      this.otpStore.set(email, { otp, expiresAt, attempts: 0, purpose: 'register', username });
      this.logger.debug(`[sendOtp] OTP stored for ${email} (register), expires at ${expiresAt}`);

      try {
        await this.mailService.sendOtp(email, otp, 'register', username ?? user.username ?? undefined);
        return { message: 'OTP sent successfully', status: 200, userId: user.id };
      } catch (err) {
        this.logger.warn(`[sendOtp] Email failed for ${email}, console fallback: ${err?.message}`);
        console.log(`OTP for ${email}: ${otp}`);
        return { message: 'OTP sent (console fallback)', status: 200, userId: user.id };
      }
    }

    // LOGIN flow
    if (purpose === 'login') {
      // Ensure user exists and is verified
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.warn(`[sendOtp] Login requested for unknown user: ${email}`);
        throw new ConflictException('User not found. Please register first.');
      }

      if (user.status === 'REGISTERED') {
        this.logger.warn(`[sendOtp] Login requested for unverified user: ${email}`);
        throw new BadRequestException('Please verify your email first.');
      }

      const otp = this.generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      this.otpStore.set(email, { otp, expiresAt, attempts: 0, purpose: 'login' });
      this.logger.debug(`[sendOtp] OTP stored for ${email} (login), expires at ${expiresAt}`);

      try {
        await this.mailService.sendOtp(email, otp, 'login', user.username ?? undefined);
        return { message: 'OTP sent successfully', status: 200 };
      } catch (err) {
        this.logger.warn(`[sendOtp] Email failed for ${email}, console fallback: ${err?.message}`);
        console.log(`Login OTP for ${email}: ${otp}`);
        return { message: 'OTP sent (console fallback)', status: 200 };
      }
    }

    throw new BadRequestException('Invalid OTP purpose');
  }

  /**
   * Verify OTP for both registration and login flows.
   * 
   * This is a unified endpoint that handles both registration and login OTP verification.
   * It determines which flow to execute based on the OTP record's `purpose` field.
   * 
   * **Registration Verification (purpose='register'):**
   * 1. Validates OTP against stored record.
   * 2. Updates user status from REGISTERED to EMAIL_VERIFIED.
   * 3. Creates an OtpVerification audit record in the database.
   * 4. Returns userId and purpose for token issuance.
   * 
   * **Login Verification (purpose='login'):**
   * 1. Validates OTP against stored record.
   * 2. Does NOT change user status (already EMAIL_VERIFIED or higher).
   * 3. Returns userId and purpose for token issuance.
   * 
   * **Validation Steps (both flows):**
   * 1. Look up OTP in memory by email.
   * 2. Check expiry (10 minutes); delete if expired.
   * 3. Check attempt count (max 3); delete if exceeded.
   * 4. Compare provided OTP with stored OTP; increment attempts on mismatch.
   * 
   * @param email The email address associated with the OTP.
   * @param otpCode The 6-digit OTP code to verify.
   * @returns { userId, purpose } where purpose indicates which flow was executed.
   * @throws BadRequestException if OTP not found, expired, too many attempts, or invalid.
   */
  async verifyOtp(email: string, otpCode: string): Promise<{ userId: string; purpose: 'register' | 'login' }> {
    this.logger.log(`[verifyOtp] Verifying OTP for ${email}`);
    const otpRecord = this.otpStore.get(email);

    if (!otpRecord) {
      this.logger.warn(`[verifyOtp] No OTP record found for email: ${email}`);
      throw new BadRequestException('No OTP found for this email');
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      this.logger.warn(`[verifyOtp] OTP expired for email ${email}`);
      this.otpStore.delete(email);
      throw new BadRequestException('OTP has expired');
    }

    if (otpRecord.attempts >= 3) {
      this.logger.warn(`[verifyOtp] Too many failed attempts for email ${email}`);
      this.otpStore.delete(email);
      throw new BadRequestException('Too many failed attempts. Request a new OTP.');
    }

    if (otpRecord.otp !== otpCode) {
      this.logger.debug(`[verifyOtp] Invalid OTP attempt for email ${email}, attempts: ${otpRecord.attempts + 1}`);
      otpRecord.attempts += 1;
      throw new BadRequestException('Invalid OTP');
    }

    this.logger.log(`[verifyOtp] OTP verified successfully for ${email} purpose=${otpRecord.purpose}`);

    // For registration: mark user as EMAIL_VERIFIED and persist audit
    if (otpRecord.purpose === 'register') {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.error(`[verifyOtp] User not found after successful OTP: ${email}`);
        throw new BadRequestException('User not found');
      }

      const updatedUser = await this.prisma.user.update({ where: { id: user.id }, data: { status: 'EMAIL_VERIFIED' } });

      await this.prisma.otpVerification.create({
        data: {
          userId: user.id,
          otp: otpRecord.otp,
          expiresAt: otpRecord.expiresAt,
          attempts: otpRecord.attempts,
          isVerified: true,
        },
      });

      this.otpStore.delete(email);
      return { userId: updatedUser.id, purpose: 'register' };
    }

    // For login: simply return userId (no status change)
    if (otpRecord.purpose === 'login') {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.error(`[verifyOtp] User not found for login OTP: ${email}`);
        throw new BadRequestException('User not found');
      }

      this.otpStore.delete(email);
      return { userId: user.id, purpose: 'login' };
    }

    throw new BadRequestException('Invalid OTP purpose');
  }

  // NOTE: sendLoginOtp was removed because the generic sendOtp is used
  // for both registration and login flows and accepts a `purpose`.
}
