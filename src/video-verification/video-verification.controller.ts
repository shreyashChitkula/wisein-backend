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
import { VideoVerificationService } from './services/video-verification.service';
import { CreateVideoVerificationDto } from './dtos/video-verification.dto';

interface AuthRequest extends ExpressRequest {
  user?: { id: string };
}

@Controller('video-verification')
@UseGuards(JwtAuthGuard)
export class VideoVerificationController {
  private readonly logger = new Logger(VideoVerificationController.name);

  constructor(
    private readonly videoVerificationService: VideoVerificationService,
  ) {}

  /**
   * POST /api/video-verification/create
   * Create video verification with photo and video URLs
   *
   * This endpoint accepts photo and video URLs and automatically approves the verification.
   * User status is upgraded to VIDEO_VERIFIED upon successful submission.
   *
   * **Request Body:**
   * ```json
   * {
   *   "photoUrl": "https://storage.example.com/photos/user123.jpg",
   *   "videoUrl": "https://storage.example.com/videos/user123.mp4"
   * }
   * ```
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "message": "Verification successful! Welcome aboard.",
   *   "verificationStatus": "VIDEO_VERIFIED",
   *   "verifiedAt": "2025-11-13T23:00:00.000Z"
   * }
   * ```
   *
   * **Error Responses:**
   * - 400: Missing photoUrl or videoUrl
   * - 401: Unauthorized (missing/invalid token)
   * - 404: User not found
   */
  @Post('create')
  async createVideoVerification(
    @Body() dto: CreateVideoVerificationDto,
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

    const result = await this.videoVerificationService.createVideoVerification(
      dto,
      userId,
    );
    return res.status(HttpStatus.OK).json(result);
  }

  /**
   * GET /api/video-verification/status
   * Get video verification status for the authenticated user
   *
   * Returns the current verification status, including whether the user is verified
   * and the photo/video URLs if available.
   *
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "verified": true,
   *   "status": "VIDEO_VERIFIED",
   *   "message": "You are fully verified!",
   *   "photoUrl": "https://storage.example.com/photos/user123.jpg",
   *   "videoUrl": "https://storage.example.com/videos/user123.mp4"
   * }
   * ```
   *
   * If no verification exists:
   * ```json
   * {
   *   "success": true,
   *   "verified": false,
   *   "status": "NOT_STARTED",
   *   "message": "Please complete video verification"
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

    const result =
      await this.videoVerificationService.getVideoVerificationStatus(userId);
    return res.status(HttpStatus.OK).json(result);
  }
}
