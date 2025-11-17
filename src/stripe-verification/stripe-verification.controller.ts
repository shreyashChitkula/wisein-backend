import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response, Request as ExpressRequest } from 'express';
import { StripeVerificationService } from './services/stripe-verification.service';
import { VerifyStripeIdentityDto } from './dtos/stripe-verification.dto';

interface AuthRequest extends ExpressRequest {
  user?: { id: string };
}

@Controller('stripe-verification')
@UseGuards(JwtAuthGuard)
export class StripeVerificationController {
  private readonly logger = new Logger(StripeVerificationController.name);

  constructor(
    private readonly stripeVerificationService: StripeVerificationService,
  ) {}

  /**
   * POST /api/stripe-verification/create-session
   * Create Stripe Identity verification session
   *
   * This endpoint creates a Stripe Identity verification session for non-Indian users.
   * Users will be redirected to Stripe's verification page to complete identity verification.
   *
   * **Prerequisites:**
   * - User must be authenticated
   * - User must NOT be from India (DigiLocker should be used for Indian users)
   *
   * **Request:**
   * No request body required
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "verificationSessionId": "vs_1234567890abcdef",
   *   "url": "https://verify.stripe.com/start/vs_1234567890abcdef",
   *   "clientSecret": "vs_1234567890abcdef_secret_..."
   * }
   * ```
   *
   * **If user already verified:**
   * ```json
   * {
   *   "success": true,
   *   "verificationSessionId": "already_verified",
   *   "url": ""
   * }
   * ```
   *
   * **Error Responses:**
   * - 400: User is from India (should use DigiLocker)
   * - 401: Unauthorized (missing/invalid token)
   * - 404: User not found
   * - 500: Failed to create verification session
   */
  @Post('create-session')
  async createStripeIdentitySession(
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    try {
      const result =
        await this.stripeVerificationService.createStripeIdentitySession(
          userId,
        );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`Error creating Stripe session: ${error.message}`);
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to create verification session',
      });
    }
  }

  /**
   * POST /api/stripe-verification/verify
   * Verify Stripe Identity session result
   *
   * This endpoint verifies the status of a Stripe Identity verification session
   * and updates the user's verification status accordingly.
   *
   * **Prerequisites:**
   * - User must be authenticated
   * - User must have created a verification session via /create-session
   *
   * **Request Body:**
   * ```json
   * {
   *   "verificationSessionId": "vs_1234567890abcdef"
   * }
   * ```
   *
   * **Response (200 OK) - Verified:**
   * ```json
   * {
   *   "success": true,
   *   "message": "Stripe Identity verification successful",
   *   "verificationStatus": "VERIFIED",
   *   "verifiedData": {
   *     "name": "John Doe",
   *     "dateOfBirth": "1990-01-15",
   *     "documentType": "passport",
   *     "documentNumber": "P123456789",
   *     "country": "USA",
   *     "state": "California",
   *     "pincode": "90210",
   *     "addressLine1": "123 Main St"
   *   }
   * }
   * ```
   *
   * **Response (200 OK) - Processing:**
   * ```json
   * {
   *   "success": false,
   *   "message": "Verification is still processing. Please check again later.",
   *   "verificationStatus": "PENDING"
   * }
   * ```
   *
   * **Response (200 OK) - Requires Input:**
   * ```json
   * {
   *   "success": false,
   *   "message": "Additional information required. Please complete the verification process.",
   *   "verificationStatus": "PENDING"
   * }
   * ```
   *
   * **Error Responses:**
   * - 400: User is from India or invalid session
   * - 401: Unauthorized (missing/invalid token)
   * - 404: User not found
   * - 500: Failed to verify session
   */
  @Post('verify')
  async verifyStripeIdentity(
    @Body() dto: VerifyStripeIdentityDto,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    try {
      const result =
        await this.stripeVerificationService.verifyStripeIdentitySession(
          userId,
          dto.verificationSessionId,
        );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`Error verifying Stripe session: ${error.message}`);
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to verify identity session',
      });
    }
  }

  /**
   * GET /api/stripe-verification/status
   * Get Stripe verification status for the authenticated user
   *
   * Returns the current verification status, including whether the user is verified
   * and the verified data if available.
   *
   * **Response (200 OK) - Verified:**
   * ```json
   * {
   *   "success": true,
   *   "verified": true,
   *   "status": "VERIFIED",
   *   "method": "STRIPE_IDENTITY",
   *   "verifiedData": {
   *     "name": "John Doe",
   *     "dateOfBirth": "1990-01-15",
   *     "documentType": "passport"
   *   },
   *   "verifiedAt": "2025-11-15T23:00:00.000Z"
   * }
   * ```
   *
   * **Response (200 OK) - Not Started:**
   * ```json
   * {
   *   "success": true,
   *   "verified": false,
   *   "status": "NOT_STARTED",
   *   "method": null,
   *   "verifiedData": null,
   *   "verifiedAt": null
   * }
   * ```
   *
   * **Error Responses:**
   * - 401: Unauthorized (missing/invalid token)
   * - 500: Internal server error
   */
  @Get('status')
  async getStatus(@Req() req: AuthRequest, @Res() res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    try {
      const result =
        await this.stripeVerificationService.getStripeVerificationStatus(
          userId,
        );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`Error getting status: ${error.message}`);
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to fetch verification status',
      });
    }
  }
}
