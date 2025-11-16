import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './services/auth.service';
import { VerificationService } from './services/verification.service';
import { SubscriptionService } from './services/subscription.service';
import { OtpService } from './services/otp.service';
import {
  SignupDto,
  LoginDto,
  SendOtpDto,
  VerifyOtpDto,
  SelectCountryDto,
  VerifyIdWithDigilockerDto,
  SelectSubscriptionPlanDto,
  CreateCashfreeCheckoutSessionDto,
} from './dtos';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { verifyCashfreeWebhookSignature } from '../utils/cashfree/webhook';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private authService: AuthService,
    private verificationService: VerificationService,
    private subscriptionService: SubscriptionService,
    private otpService: OtpService,
  ) {}

  // ============================================
  // STEP 1: SIGNUP & EMAIL VERIFICATION
  // ============================================

  /**
   * POST /auth/send-otp
   * 
   * **Initiate registration flow** for new users.
   * 
   * Accepts email and username, initiates email verification process:
   * 1. Checks if email is already registered and verified.
   * 2. Creates user account with REGISTERED status (in-memory during OTP flow).
   * 3. Generates and sends 6-digit OTP via email.
   * 
   * **Request:**
   * ```
   * POST /auth/send-otp
   * Content-Type: application/json
   * 
   * {
   *   "email": "user@example.com",
   *   "username": "johndoe"
   * }
   * ```
   * 
   * **Response (success - 200):**
   * ```
   * {
   *   "message": "OTP sent to your email",
   *   "status": 200
   * }
   * ```
   * 
   * **Response (error - email already verified - 409):**
   * ```
   * {
   *   "message": "User with this email already exists",
   *   "status": 409
   * }
   * ```
   * 
   * **Next step:** Call POST /auth/verify-otp with email and received OTP.
   * 
   * @param sendOtpDto { email, username }
   * @returns { message, status, userId? }
   */
  @Post('send-otp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    this.logger.log(`[send-otp] Received request for ${sendOtpDto.email}`);
    try {
      const result = await this.authService.signup(sendOtpDto);
      this.logger.log(`[send-otp] OTP sent successfully for ${sendOtpDto.email}`);
      return result;
    } catch (error) {
      this.logger.error(`[send-otp] Failed for ${sendOtpDto.email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * POST /auth/verify-otp
   * 
   * **Unified OTP verification endpoint** for both registration and login flows.
   * 
   * Verifies the 6-digit OTP sent to user's email. Automatically detects whether this is:
   * - **Registration verification:** Completes email verification, marks user EMAIL_VERIFIED, returns access+refresh tokens.
   * - **Login verification:** Completes login, returns access+refresh tokens (no status change).
   * 
   * **Request:**
   * ```
   * POST /auth/verify-otp
   * Content-Type: application/json
   * 
   * {
   *   "email": "user@example.com",
   *   "otp": "123456"
   * }
   * ```
   * 
   * **Response (success - 200):**
   * ```
   * {
   *   "userId": "clxyz123...",
   *   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "message": "Email verified successfully." (for registration) OR "Login successful" (for login)
   * }
   * ```
   * 
   * **Errors:**
   * - 400 Bad Request: OTP not found, expired (>10 min), or invalid code.
   * - 400 Bad Request: OTP already failed 3 times; request new OTP.
   * - 400 Bad Request: User not found (database inconsistency).
   * - 409 Conflict: User email not verified (for login flow only).
   * 
   * **Token Details:**
   * - Access Token: 7-day TTL; use for API requests in Authorization header.
   * - Refresh Token: 30-day TTL; use to generate new access tokens when expired.
   * 
   * **Both tokens are issued immediately** to enable seamless authentication.
   * 
   * @param verifyOtpDto { email, otp }
   * @returns { userId, accessToken, refreshToken, message }
   */
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    this.logger.log(`[verify-otp] Received request for ${verifyOtpDto.email}`);
    try {
      const result = await this.authService.verifyOtpGeneric(
        verifyOtpDto.email,
        verifyOtpDto.otp,
      );
      this.logger.log(`[verify-otp] Verified successfully for ${verifyOtpDto.email}`);
      return result;
    } catch (error) {
      this.logger.error(`[verify-otp] Failed for ${verifyOtpDto.email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * GET /auth/debug/otp?email=... (Dev Only)
   * 
   * **Development helper endpoint** to retrieve OTP for a given email during local testing.
   * Disabled in production (throws 403 Forbidden).
   * 
   * **Purpose:**
   * - Accelerate local testing by bypassing email delivery.
   * - Retrieve the in-memory OTP without waiting for email client.
   * 
   * **Usage:**
   * ```bash
   * # Via query parameter
   * curl http://localhost:3000/auth/debug/otp?email=user@example.com
   * 
   * # Via request body (httpie)
   * http POST http://localhost:3000/auth/debug/otp email=user@example.com
   * ```
   * 
   * **Response (success - 200):**
   * ```
   * {
   *   "email": "user@example.com",
   *   "otp": "123456"
   * }
   * ```
   * 
   * **Response (OTP not found - 200):**
   * ```
   * {
   *   "email": "user@example.com",
   *   "otp": null
   * }
   * ```
   * 
   * **Response (production - 403):**
   * ```
   * {
   *   "message": "Not allowed in production",
   *   "statusCode": 403
   * }
   * ```
   * 
   * **Note:** Only available when NODE_ENV !== 'production'.
   * 
   * @param emailQuery Email from query parameter (?email=...)
   * @param body Request body (alternative input; for httpie compatibility)
   * @returns { email, otp } where otp is null if not found
   * @throws ForbiddenException in production
   */
  @Get('debug/otp')
  async debugGetOtp(@Query('email') emailQuery?: string, @Body() body?: any) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not allowed in production');
    }

    // Accept email from query param or from body (for httpie compatibility)
    const email = emailQuery || body?.email;

    if (!email) {
      throw new BadRequestException('email is required (pass as ?email=... or in body)');
    }

    const otp = this.otpService.getOtpForTesting(email);
    return { email, otp: otp ?? null };
  }

  /**
   * POST /auth/login
   * 
   * **Initiate login flow** for existing verified users.
   * 
   * Accepts email, validates user exists and is verified, then:
   * 1. Generates and sends 6-digit OTP via email (valid for 10 minutes).
   * 2. Stores OTP in memory with purpose='login'.
   * 
   * **Preconditions:**
   * - User must exist in database with status EMAIL_VERIFIED or higher.
   * - If user not found or not verified, returns error.
   * 
   * **Request:**
   * ```
   * POST /auth/login
   * Content-Type: application/json
   * 
   * {
   *   "email": "user@example.com"
   * }
   * ```
   * 
   * **Response (success - 200):**
   * ```
   * {
   *   "message": "OTP sent to your email",
   *   "status": 200
   * }
   * ```
   * 
   * **Response (error - user not found - 404):**
   * ```
   * {
   *   "message": "User with this email not found",
   *   "status": 404
   * }
   * ```
   * 
   * **Response (error - email not verified - 400):**
   * ```
   * {
   *   "message": "Please verify your email first. Complete registration to login.",
   *   "status": 400
   * }
   * ```
   * 
   * **Next step:** Call POST /auth/verify-otp with email and received OTP.
   * 
   * @param loginDto { email }
   * @returns { message, status }
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`[login] Received request for ${loginDto.email}`);
    try {
      const result = await this.authService.login(loginDto);
      this.logger.log(`[login] OTP sent for ${loginDto.email}`);
      return result;
    } catch (error) {
      this.logger.error(`[login] Failed for ${loginDto.email}: ${error.message}`);
      throw error;
    }
  }

  // NOTE: verify-login-otp route removed — unified into POST /auth/verify-otp

  // ============================================
  // STEP 2: COUNTRY SELECTION
  // ============================================

  /**
   * POST /auth/select-country
   * User selects their country
   */
  @Post('select-country')
  @UseGuards(JwtAuthGuard)
  async selectCountry(
    @Req() req,
    @Body() countryDto: SelectCountryDto,
  ) {
    return this.authService.selectCountry(req.user.id, countryDto);
  }

  // ============================================
  // STEP 3: ID VERIFICATION
  // ============================================

  /**
   * POST /auth/digilocker/authorize
   * Initiate DigiLocker authorization flow
   */
  @Post('digilocker/authorize')
  @UseGuards(JwtAuthGuard)
  async initiateDigilockerAuth(@Req() req) {
    // In production, redirect to DigiLocker OAuth
    return {
      authUrl: `https://digilocker.gov.in/oauth/authorize?client_id=${process.env.DIGILOCKER_CLIENT_ID}&redirect_uri=${process.env.DIGILOCKER_REDIRECT_URI}&response_type=code`,
    };
  }

  /**
   * POST /auth/digilocker/verify
   * Verify with DigiLocker authorization code
   */
  @Post('digilocker/verify')
  @UseGuards(JwtAuthGuard)
  async verifyWithDigilocker(
    @Req() req,
    @Body() digilockerDto: VerifyIdWithDigilockerDto,
  ) {
    return this.verificationService.verifyWithDigilocker(
      req.user.id,
      digilockerDto.authorizationCode,
    );
  }


  /**
   * GET /auth/verification/status
   * Get verification status
   */
  @Get('verification/status')
  @UseGuards(JwtAuthGuard)
  async getVerificationStatus(@Req() req) {
    return this.verificationService.getVerificationStatus(req.user.id);
  }

  // ============================================
  // STEP 4: VIDEO VERIFICATION
  // ============================================

  /**
   * POST /auth/upload-video
   * Upload video for verification
   * Extracts frame and stores as profile picture
   */
  @Post('upload-video')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('video', { dest: './uploads' }))
  async uploadVideo(
    @Req() req,
    @UploadedFile() file: any, // typed as any instead of Express.Multer.File due to type definition issues
  ) {
    if (!file) {
      throw new BadRequestException('Video file is required');
    }
    return this.verificationService.uploadAndProcessVideo(req.user.id, file);
  }

  // ============================================
  // STEP 5: ADMIN APPROVAL
  // ============================================

  /**
   * GET /auth/onboarding-status
   * Get current onboarding status
   */
  @Get('onboarding-status')
  @UseGuards(JwtAuthGuard)
  async getOnboardingStatus(@Req() req) {
    return this.authService.getOnboardingStatus(req.user.id);
  }

  // ============================================
  // STEP 6: SUBSCRIPTION SETUP
  // ============================================

  /**
   * GET /auth/subscription/plans
   * Get available subscription plans
   */
  @Get('subscription/plans')
  async getSubscriptionPlans() {
    return this.subscriptionService.getAvailablePlans();
  }

  /**
   * POST /auth/subscription/select-plan
   * Select subscription plan and create checkout session
   */
  /**
   * POST /auth/subscription/select-plan
   * Select subscription plan by planId and create checkout session
   * Input: { planId: string }
   */
  @Post('subscription/select-plan')
  @UseGuards(JwtAuthGuard)
  async selectSubscriptionPlan(
    @Req() req,
    @Body() body: { planId: string },
  ) {
    return this.subscriptionService.createCheckoutSession(req.user.id, body);
  }

  /**
   * GET /auth/subscription/current
   * Get current subscription details
   */
  @Get('subscription/current')
  @UseGuards(JwtAuthGuard)
  async getCurrentSubscription(@Req() req) {
    const subscription = await this.subscriptionService.getUserSubscription(
      req.user.id,
    );
    return subscription || { message: 'No active subscription' };
  }

  /**
   * POST /auth/subscription/cancel
   * Cancel current subscription
   */
  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(@Req() req) {
    return this.subscriptionService.cancelSubscription(req.user.id);
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  /**
   * POST /auth/refresh-token
   * Refresh access token using refresh token
   */
  @Post('refresh-token')
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * POST /auth/webhooks/cashfree
   * Handle Cashfree webhook events
   */
  @Post('webhooks/cashfree')
  async handleCashfreeWebhook(@Req() req) {
    const signature = (req.headers['x-webhook-signature'] || req.headers['x-webhook-signature'.toLowerCase()]) as string | undefined;
    const timestamp = (req.headers['x-webhook-timestamp'] || req.headers['x-webhook-timestamp'.toLowerCase()]) as string | undefined;
    const rawBody = JSON.stringify(req.body || {});

    // Verify webhook signature if secret configured
    if (signature && timestamp) {
      const ok = verifyCashfreeWebhookSignature(timestamp, rawBody, signature);
      if (!ok) {
        this.logger.warn('[webhooks/cashfree] Invalid signature, rejecting webhook');
        return { received: false, reason: 'invalid_signature' };
      }
    }

    const event = req.body;

    switch (event.type) {
      case 'PAYMENT_SUCCESS':
        // Handle payment success
        await this.subscriptionService.handleSubscriptionRenewal(
          event.data.order_id,
        );
        break;

      case 'PAYMENT_FAILED':
        // Handle payment failure
        await this.subscriptionService.handleSubscriptionCancelled(
          event.data.order_id,
        );
        break;

      case 'charge.succeeded':
        // Handle successful charge
        break;

      default:
        break;
    }

    return { received: true };
  }
}
