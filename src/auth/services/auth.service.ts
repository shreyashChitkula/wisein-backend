import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { SignupDto, LoginDto, SelectCountryDto } from '../dtos';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  /**
   * Initiate registration flow by sending OTP to provided email.
   * 
   * **Steps:**
   * 1. Validate email is not already registered as EMAIL_VERIFIED or higher.
   * 2. Create user in REGISTERED status if new (stored in memory during OTP flow).
   * 3. Generate and send 6-digit OTP via email (valid for 10 minutes).
   * 4. Store OTP in memory with purpose='register' and username.
   * 
   * **Response:**
   * - success: { message, status: 200 }
   * - error (email exists and verified): { message, status: 409 }
   * 
   * @param signupDto { email, username }
   * @returns { message, status, userId? }
   */
  async signup(signupDto: SignupDto): Promise<{
    message: string;
    status: number;
    userId?: string;
  }> {
    const { email, username } = signupDto;
    this.logger.log(`[signup] Starting registration for ${email} with username: ${username}`);

    // Delegate to OtpService which:
    // 1. Checks if email is already verified in the database.
    // 2. Creates a user in REGISTERED status if new.
    // 3. Generates and sends OTP with purpose='register'.
    this.logger.log(`[signup] Sending OTP to ${email}`);
    const result = await this.otpService.sendOtp(email, { username, purpose: 'register' });

    this.logger.log(`[signup] OTP sent successfully for ${email}`);
    return result;
  }

  /**
   * Step 2: User selects country
   * This determines which ID verification method to use next
   */
  async selectCountry(userId: string, countryDto: SelectCountryDto): Promise<{
    userId: string;
    verificationMethod: string;
    message: string;
  }> {
    const { country } = countryDto;

    // Update user's country
    await this.prisma.user.update({
      where: { id: userId },
      data: { country },
    });

    // Determine verification method based on country
    const verificationMethod = country.toLowerCase() === 'india' ? 'DIGILOCKER' : 'STRIPE_IDENTITY';

    return {
      userId,
      verificationMethod,
      message: `Country selected: ${country}. Next step: ${verificationMethod} verification.`,
    };
  }

  /**
   * Generate JWT Access Token
   */
  private generateAccessToken(userId: string, email: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        email,
      },
      {
        expiresIn: '7d',
      },
    );
  }

  /**
   * Generate JWT Refresh Token
   */
  generateRefreshToken(userId: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        type: 'refresh',
      },
      {
        expiresIn: '30d',
      },
    );
  }

  /**
   * Initiate login flow by sending OTP to existing verified user.
   * 
   * **Preconditions:**
   * - User must exist in database with status EMAIL_VERIFIED or higher.
   * - If user not verified yet, return error and prompt to verify registration.
   * 
   * **Steps:**
   * 1. Validate email exists and is verified.
   * 2. Generate and send 6-digit OTP via email (valid for 10 minutes).
   * 3. Store OTP in memory with purpose='login'.
   * 
   * **Response:**
   * - success: { message, status: 200 }
   * - error (user not found): { message, status: 404 }
   * - error (email not verified): { message, status: 400 }
   * 
   * @param loginDto { email }
   * @returns { message, status }
   */
  async login(loginDto: LoginDto): Promise<{
    message: string;
    status: number;
  }> {
    const { email } = loginDto;
    this.logger.log(`[login] Initiating login OTP for ${email}`);
    
    // Delegate to OtpService which validates user exists and is verified,
    // then generates and sends OTP with purpose='login'.
    const result = await this.otpService.sendOtp(email, { purpose: 'login' });
    this.logger.log(`[login] OTP sent successfully for ${email}`);
    return { message: result.message, status: result.status };
  }

  /**
   * Unified OTP verification for both registration and login flows.
   * 
   * This is the primary verification endpoint that handles both email verification
   * (registration) and login OTP verification. It automatically detects which flow
   * to execute based on the OTP record's `purpose` field stored in OtpService.
   * 
   * **Registration Verification Flow (purpose='register'):**
   * 1. Validates OTP code against stored registration OTP.
   * 2. OtpService updates user status from REGISTERED to EMAIL_VERIFIED.
   * 3. OtpService creates OtpVerification audit record.
   * 4. Returns { userId, accessToken, refreshToken, message }.
   * 5. Both tokens are issued with 7d and 30d TTL respectively.
   * 6. Refresh token is persisted to RefreshToken table for later use.
   * 
   * **Login Verification Flow (purpose='login'):**
   * 1. Validates OTP code against stored login OTP.
   * 2. No user status change (already EMAIL_VERIFIED or higher).
   * 3. Returns { userId, accessToken, refreshToken, message }.
   * 4. Both tokens are issued with 7d and 30d TTL respectively.
   * 5. Refresh token is persisted to RefreshToken table for later use.
   * 
   * **Token Strategy:**
   * - Access Token (JWT): 7-day TTL; used to authorize API requests; includes sub (userId) and email.
   * - Refresh Token (JWT): 30-day TTL; used to generate new access tokens; includes sub (userId) and type='refresh'.
   * - Both tokens are issued immediately for both flows to enable seamless authentication.
   * 
   * **OTP Validation (handled by OtpService):**
   * - Max 3 failed attempts per OTP; auto-delete after 3rd failure.
   * - 10-minute expiry; auto-delete if expired.
   * - Case-sensitive comparison (OTP must match exactly).
   * 
   * @param email The email address associated with the OTP.
   * @param otpCode The 6-digit OTP code to verify.
   * @returns { userId, accessToken, refreshToken, message } with appropriate flow message.
   * @throws BadRequestException if OTP not found, expired, invalid, too many attempts, or purpose mismatch.
   * 
   * @example
   * // Registration verification
   * const result = await verifyOtpGeneric('user@example.com', '123456');
   * // Returns: { userId: 'xyz', accessToken: 'jwt...', refreshToken: 'jwt...', message: 'Email verified successfully.' }
   * 
   * @example
   * // Login verification
   * const result = await verifyOtpGeneric('user@example.com', '654321');
   * // Returns: { userId: 'xyz', accessToken: 'jwt...', refreshToken: 'jwt...', message: 'Login successful' }
   */
  async verifyOtpGeneric(email: string, otpCode: string): Promise<any> {
    this.logger.log(`[verifyOtpGeneric] Verifying OTP for ${email}`);

    // Delegate verification to OtpService which returns purpose and userId
    const result = await this.otpService.verifyOtp(email, otpCode);

    if (result.purpose === 'register') {
      // For registration, generate access + refresh tokens
      this.logger.log(`[verifyOtpGeneric] Registration verification for ${email}`);
      const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
      if (!user) throw new BadRequestException('User not found');
      
      const accessToken = this.generateAccessToken(user.id, user.email);
      const refreshToken = this.generateRefreshToken(user.id);
      
      // Persist refresh token for later use
      await this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      this.logger.log(`[verifyOtpGeneric] Registration verified for ${email}, userId: ${user.id}`);
      return { userId: user.id, accessToken, refreshToken, message: 'Email verified successfully.' };
    }

    if (result.purpose === 'login') {
      // For login, issue access + refresh tokens
      this.logger.log(`[verifyOtpGeneric] Login verification for ${email}`);
      const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
      if (!user) throw new BadRequestException('User not found');

      const accessToken = this.generateAccessToken(user.id, user.email);
      const refreshToken = this.generateRefreshToken(user.id);

      // Persist refresh token for later use
      await this.prisma.refreshToken.create({ 
        data: { 
          userId: user.id, 
          token: refreshToken, 
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
        } 
      });

      this.logger.log(`[verifyOtpGeneric] Login verified for ${email}, userId: ${user.id}`);
      return { userId: user.id, accessToken, refreshToken, message: 'Login successful' };
    }

    throw new BadRequestException('Invalid OTP purpose');
  }

  /**
   * Helper: Generate OTP
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get onboarding status for current user
   */
  async getOnboardingStatus(userId: string): Promise<{
    status: string;
    completedSteps: string[];
    nextStep: string;
    details: Record<string, any>;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        verification: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const completedSteps: string[] = [];
    let nextStep = '';

    if (user.status === 'REGISTERED') {
      nextStep = 'Verify OTP';
    } else if (user.status === 'EMAIL_VERIFIED') {
      completedSteps.push('Email Verified');
      nextStep = 'Select Country';
    } else if (user.status === 'ID_VERIFIED') {
      completedSteps.push('Email Verified', 'Country Selected', 'ID Verified');
      nextStep = 'Upload Video';
    } else if (user.status === 'VIDEO_VERIFIED') {
      completedSteps.push(
        'Email Verified',
        'Country Selected',
        'ID Verified',
        'Video Submitted',
      );
      nextStep = 'Awaiting Admin Approval';
    } else if (user.status === 'APPROVED') {
      completedSteps.push(
        'Email Verified',
        'Country Selected',
        'ID Verified',
        'Video Submitted',
        'Admin Approved',
      );
      nextStep = 'Select Subscription Plan';
    } else if (user.status === 'ACTIVE') {
      completedSteps.push(
        'Email Verified',
        'Country Selected',
        'ID Verified',
        'Video Submitted',
        'Admin Approved',
        'Subscription Active',
      );
      nextStep = 'Welcome to Platform';
    }

    return {
      status: user.status,
      completedSteps,
      nextStep,
      details: {
        email: user.email,
        country: user.country,
        verificationMethod: user.country?.toLowerCase() === 'india' ? 'DIGILOCKER' : 'STRIPE_IDENTITY',
        verification: user.verification
          ? {
              status: user.verification.verificationStatus,
              method: user.verification.method,
              verifiedAt: user.verification.verifiedAt,
            }
          : null,
        subscription: user.subscription
          ? {
              planName: user.subscription.planName,
              status: user.subscription.status,
              endDate: user.subscription.endDate,
            }
          : null,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    message: string;
  }> {
    try {
      const decoded = this.jwtService.verify(refreshToken);

      // Check if refresh token exists in database
      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expired or invalid');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user.id, user.email);

      return {
        accessToken,
        message: 'Token refreshed successfully',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
