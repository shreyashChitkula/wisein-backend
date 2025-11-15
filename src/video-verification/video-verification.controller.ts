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
import {
  InitiateVideoVerificationDto,
  SubmitVideoVerificationDto,
  AdminVerifyVideoDto,
  AdminRejectVideoDto,
  CreateVideoVerificationDto,
} from './dtos/video-verification.dto';

interface Request extends ExpressRequest {
  user?: {
    id: string;
    email?: string;
  };
}
interface AuthRequest extends Request {
  user?: { id: string };
}

@Controller('video-verification')
@UseGuards(JwtAuthGuard)
export class VideoVerificationController {
  private readonly logger = new Logger(VideoVerificationController.name);

  constructor(private readonly videoVerificationService: VideoVerificationService) {}

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

    const result = await this.videoVerificationService.createVideoVerification(dto, userId);
    return res.status(HttpStatus.OK).json(result);
  }

  @Get('status')
  async getStatus(@Req() req: AuthRequest, @Res() res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const result = await this.videoVerificationService.getVideoVerificationStatus(userId);
    return res.status(HttpStatus.OK).json(result);
  }



  /**
  * POST /video-verification/initiate
   * Initiate video verification session
   * 
   * User must be ID_VERIFIED (completed DigiLocker) to initiate video verification
   * 
   * **Request Body:**
   * ```json
   * {}
   * ```
   * 
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "message": "Video verification session initiated",
   *   "sessionId": "VID_1702650000000_ABC123",
   *   "expiresAt": "2025-11-13T23:45:00.000Z",
   *   "instructions": {
   *     "maxDuration": 30,
   *     "acceptedFormats": ["mp4", "webm", "mov"],
   *     "guidelines": [...]
   *   }
   * }
   * ```
   */
  // @Post('initiate')
  // async initiateVideoVerification(
  //   @Body() dto: InitiateVideoVerificationDto,
  //   @Req() req: Request,
  //   @Res() res: Response,
  // ) {
  //   try {
  //     const userId = req.user?.id;
  //     if (!userId) {
  //       return res.status(HttpStatus.UNAUTHORIZED).json({
  //         success: false,
  //         message: 'User authentication required',
  //       });
  //     }

  //     const result = await this.videoVerificationService.initiateVideoVerification(
  //       userId,
  //       dto,
  //     );
  //     return res.status(HttpStatus.OK).json(result);
  //   } catch (error) {
  //     this.logger.error(`Error initiating video verification: ${error.message}`);
  //     throw error;
  //   }
  // }

  // /**
  // * POST /video-verification/submit
  //  * Submit video for verification
  //  * 
  //  * User submits recorded/captured video for verification
  //  * Video URL should point to uploaded file (S3, CloudStorage, etc.)
  //  * 
  //  * **Request Body:**
  //  * ```json
  //  * {
  //  *   "sessionId": "VID_1702650000000_ABC123",
  //  *   "videoUrl": "https://storage.example.com/videos/abc123.mp4",
  //  *   "videoDuration": 28,
  //  *   "videoFormat": "mp4",
  //  *   "videoSize": 5242880
  //  * }
  //  * ```
  //  * 
  //  * **Response (200 OK):**
  //  * ```json
  //  * {
  //  *   "success": true,
  //  *   "message": "Video submitted successfully",
  //  *   "status": "PENDING",
  //  *   "nextStatus": "Awaiting admin review"
  //  * }
  //  * ```
  //  */
  // @Post('submit')
  // async submitVideoVerification(
  //   @Body() dto: SubmitVideoVerificationDto,
  //   @Req() req: Request,
  //   @Res() res: Response,
  // ) {
  //   try {
  //     const userId = req.user?.id;
  //     if (!userId) {
  //       return res.status(HttpStatus.UNAUTHORIZED).json({
  //         success: false,
  //         message: 'User authentication required',
  //       });
  //     }

  //     const result = await this.videoVerificationService.submitVideoVerification(
  //       userId,
  //       dto,
  //     );
  //     return res.status(HttpStatus.OK).json(result);
  //   } catch (error) {
  //     this.logger.error(`Error submitting video: ${error.message}`);
  //     throw error;
  //   }
  // }

  // /**
  // * GET /video-verification/status
  //  * Get /video verification status
  //  * 
  //  * Check current status of user's video verification
  //  * 
  //  * **Response (200 OK):**
  //  * ```json
  //  * {
  //  *   "success": true,
  //  *   "verified": false,
  //  *   "status": "PENDING",
  //  *   "message": "Your video is under review",
  //  *   "nextSteps": [...]
  //  * }
  //  * ```
  //  */
  // @Get('status')
  // async getVideoVerificationStatus(@Req() req: Request, @Res() res: Response) {
  //   try {
  //     const userId = req.user?.id;
  //     if (!userId) {
  //       return res.status(HttpStatus.UNAUTHORIZED).json({
  //         success: false,
  //         message: 'User authentication required',
  //       });
  //     }

  //     const result = await this.videoVerificationService.getVideoVerificationStatus(
  //       userId,
  //     );
  //     return res.status(HttpStatus.OK).json(result);
  //   } catch (error) {
  //     this.logger.error(`Error getting status: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
  * POST /video-verification/admin/verify
   * ADMIN: Approve video verification
   * 
   * Admin endpoint to approve user's video verification
   * 
   * **Request Body:**
   * ```json
   * {
   *   "userId": "user_id_123",
   *   "notes": "Face match successful",
   *   "faceMatchScore": 0.95
   * }
   * ```
   * 
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "message": "Video verification approved",
   *   "status": "VERIFIED",
   *   "userStatus": "VIDEO_VERIFIED",
   *   "verifiedAt": "2025-11-13T23:00:00.000Z"
   * }
   * ```
   */
  // @Post('admin/verify')
  // async adminVerifyVideo(
  //   @Body() dto: AdminVerifyVideoDto,
  //   @Req() req: Request,
  //   @Res() res: Response,
  // ) {
  //   try {
  //     const adminId = req.user?.id;
  //     if (!adminId) {
  //       return res.status(HttpStatus.UNAUTHORIZED).json({
  //         success: false,
  //         message: 'Admin authentication required',
  //       });
  //     }

  //     const result = await this.videoVerificationService.adminVerifyVideo(
  //       adminId,
  //       dto,
  //     );
  //     return res.status(HttpStatus.OK).json(result);
  //   } catch (error) {
  //     this.logger.error(`Error verifying video: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
  * POST /video-verification/admin/reject
   * ADMIN: Reject video verification
   * 
   * Admin endpoint to reject user's video and request re-submission
   * 
   * **Request Body:**
   * ```json
   * {
   *   "userId": "user_id_123",
   *   "rejectionReason": "Face not clearly visible",
   *   "notes": "Please ensure good lighting"
   * }
   * ```
   * 
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "message": "Video verification rejected",
   *   "status": "REJECTED",
   *   "rejectionReason": "Face not clearly visible"
   * }
  //  * ```
  //  */
  // @Post('admin/reject')
  // async adminRejectVideo(
  //   @Body() dto: AdminRejectVideoDto,
  //   @Req() req: Request,
  //   @Res() res: Response,
  // ) {
  //   try {
  //     const adminId = req.user?.id;
  //     if (!adminId) {
  //       return res.status(HttpStatus.UNAUTHORIZED).json({
  //         success: false,
  //         message: 'Admin authentication required',
  //       });
  //     }

  //     const result = await this.videoVerificationService.adminRejectVideo(
  //       adminId,
  //       dto,
  //     );
  //     return res.status(HttpStatus.OK).json(result);
  //   } catch (error) {
  //     this.logger.error(`Error rejecting video: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
  * GET /video-verification/admin/pending
   * ADMIN: Get pending videos
   * 
   * Get list of videos awaiting admin review
   * 
   * **Response (200 OK):**
   * ```json
   * {
   *   "success": true,
   *   "count": 5,
   *   "videos": [
   *     {
   *       "userId": "user_123",
   *       "userEmail": "user@example.com",
   *       "userName": "John Doe",
   *       "submittedAt": "2025-11-13T22:00:00.000Z",
   *       "videoDuration": 28,
   *       "status": "PENDING"
   *     }
   *   ]
   * }
   * ```
   */
  // @Get('admin/pending')
  // async adminGetPendingVideos(@Req() req: Request, @Res() res: Response) {
  //   try {
  //     const adminId = req.user?.id;
  //     if (!adminId) {
  //       return res.status(HttpStatus.UNAUTHORIZED).json({
  //         success: false,
  //         message: 'Admin authentication required',
  //       });
  //     }

  //     const result = await this.videoVerificationService.adminGetPendingVideos(
  //       adminId,
  //     );
  //     return res.status(HttpStatus.OK).json(result);
  //   } catch (error) {
  //     this.logger.error(`Error getting pending videos: ${error.message}`);
  //     throw error;
  //   }
  // }

  // /**
  // * GET /video-verification/health
  //  * Health check endpoint
  //  */
  // @Get('health')
  // healthCheck(@Res() res: Response) {
  //   return res.status(HttpStatus.OK).json({
  //     success: true,
  //     timestamp: new Date().toISOString(),
  //     service: 'Video Verification',
  //     status: 'operational',
  //   });
  // }


}
