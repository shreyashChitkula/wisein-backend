import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response, Request as ExpressRequest } from 'express';
import { DigiLockerVerificationService } from './services/digilocker-verification.service';
import {
  InitiateDigiLockerDto,
  ProcessDigiLockerCallbackDto,
  CompleteDigiLockerVerificationDto,
  UserProvidedData,
} from './dtos/digilocker.dto';

interface Request extends ExpressRequest {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * DigiLocker Verification Controller
 * API endpoints for onboarding verification flow
 */
@Controller('digilocker')
@UseGuards(JwtAuthGuard)
export class DigiLockerVerificationController {
  private readonly logger = new Logger(DigiLockerVerificationController.name);

  constructor(
    private readonly digiLockerService: DigiLockerVerificationService,
  ) {}

  /**
  * POST /api/digilocker/initiate
   * Initiate DigiLocker verification flow
   *
   * Checks DigiLocker account existence and generates consent URL
   *
   * **Request Body:**
   * ```json
   * {
   *   "mobileNumber": "9876543210"
   * }
   * ```
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "accountExists": true,
   *   "consentUrl": "https://verification-test.cashfree.com/dgl/...",
   *   "verificationId": "VER_1702650000000_ABC123",
   *   "flowType": "signin",
   *   "message": "DigiLocker account found. Please complete verification."
   * }
   * ```
   *
   * **Error Responses:**
   * - 400: Invalid mobile number format
   * - 409: DigiLocker account already verified by another user
   * - 500: Internal server error
   */
  @Post('initiate')
  async initiateVerification(
    @Body() dto: InitiateDigiLockerDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'User authentication required',
        });
      }

      const result = await this.digiLockerService.initiateVerification(userId, dto);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`Error initiating verification: ${error.message}`);
      throw error;
    }
  }

  /**
  * POST /api/digilocker/callback
   * Process DigiLocker callback after consent
   *
   * Handles redirect from DigiLocker after user authenticates
   *
   * **Request Body:**
   * ```json
   * {
   *   "verificationId": "VER_1702650000000_ABC123"
   * }
   * ```
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "status": "AUTHENTICATED",
   *   "readyForComparison": true,
   *   "message": "DigiLocker verification successful. Ready for data comparison."
   * }
   * ```
   *
   * **Error Responses:**
   * - 400: Invalid verification ID
   * - 500: Processing error
   */
  @Post('callback')
  async processCallback(
    @Body() dto: ProcessDigiLockerCallbackDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'User authentication required',
        });
      }

      const result = await this.digiLockerService.processCallback(userId, dto);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`Error processing callback: ${error.message}`);
      throw error;
    }
  }

  /**
  * POST /api/digilocker/complete
   * Complete verification with user data comparison
   *
   * Finalizes verification by comparing DigiLocker data with user input
   *
   * **Request Body:**
   * ```json
   * {
   *   "verificationId": "VER_1702650000000_ABC123",
   *   "userProvidedData": {
   *     "nameAsPerAadhaar": "JOHN DOE",
   *     "dateOfBirth": "1990-05-15",
   *     "gender": "Male",
   *     "country": "India",
   *     "state": "Maharashtra",
   *     "district": "Mumbai",
   *     "pincode": "400001",
   *     "phoneNumber": "9876543210",
   *     "addressLine1": "123 Main Street",
   *     "addressLine2": "Apartment 4B"
   *   }
   * }
   * ```
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "message": "Identity verification completed successfully",
   *   "verified": true,
   *   "comparisonDetails": {
   *     "nameMatch": true,
   *     "dobMatch": true,
   *     "genderMatch": true,
   *     "stateMatch": true,
   *     "pincodeMatch": true,
   *     "mismatches": []
   *   }
   * }
   * ```
   *
   * **Error Responses:**
   * - 400: Data mismatch or validation errors
   * - 409: Account already verified
   * - 500: Verification failed
   */
  @Post('complete')
  async completeVerification(
    @Body() dto: CompleteDigiLockerVerificationDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'User authentication required',
        });
      }

      const result = await this.digiLockerService.completeVerification(userId, dto);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`Error completing verification: ${error.message}`);
      throw error;
    }
  }

  /**
  * GET /api/digilocker/status/:verificationId
   * Get verification status
   *
   * Check current status of verification (useful for polling)
   *
   * **Path Parameters:**
   * - `verificationId` (string): ID from /initiate response
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "status": "AUTHENTICATED",
   *   "readyForComparison": true,
   *   "message": "Ready for data comparison"
   * }
   * ```
   *
   * **Error Responses:**
   * - 404: Verification session not found
   * - 500: Server error
   */
  @Get('status/:verificationId')
  async getVerificationStatus(
    @Param('verificationId') verificationId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.digiLockerService.getVerificationStatus(
        verificationId,
      );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`Error getting status: ${error.message}`);
      throw error;
    }
  }

  /**
  * GET /api/digilocker/user-status
   * Get user verification status
   *
   * Check if user is already verified via DigiLocker
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "verified": true,
   *   "verificationType": "DIGILOCKER",
   *   "message": "User is verified"
   * }
   * ```
   *
   * **Error Responses:**
   * - 401: User not authenticated
   */
  @Get('user-status')
  async getUserVerificationStatus(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'User authentication required',
        });
      }

      const result = await this.digiLockerService.checkUserVerificationStatus(
        userId,
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        verified: result.verified,
        message: result.verified
          ? 'User is verified'
          : 'User verification pending',
      });
    } catch (error) {
      this.logger.error(`Error checking user status: ${error.message}`);
      throw error;
    }
  }

  /**
  * POST /api/digilocker/admin/cleanup-expired
   * Admin endpoint to cleanup expired sessions
   *
   * Removes expired verification sessions (24+ hours)
   * Run periodically via cron job
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "deletedCount": 5,
   *   "message": "Cleaned up 5 expired verification sessions"
   * }
   * ```
   *
   * **Error Responses:**
   * - 500: Cleanup failed
   */
  @Post('admin/cleanup-expired')
  async cleanupExpiredSessions(@Res() res: Response) {
    try {
      const result = await this.digiLockerService.cleanupExpiredSessions();

      return res.status(HttpStatus.OK).json({
        success: true,
        deletedCount: result.deletedCount,
        message: `Cleaned up ${result.deletedCount} expired verification sessions`,
      });
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error.message}`);
      throw error;
    }
  }

  /**
  * GET /api/digilocker/health
   * Health check endpoint
   *
   * Verify DigiLocker service is operational
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "timestamp": "2025-11-12T23:37:00.000Z",
   *   "service": "DigiLocker Verification",
   *   "status": "operational"
   * }
   * ```
   */
  @Get('health')
  healthCheck(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      success: true,
      timestamp: new Date().toISOString(),
      service: 'DigiLocker Verification',
      status: 'operational',
    });
  }
}
