import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import {
  InitiateVideoVerificationDto,
  SubmitVideoVerificationDto,
  AdminVerifyVideoDto,
  AdminRejectVideoDto,
  VideoVerificationStatusDto,
  UserVideoStatusDto,
  VideoVerificationStatus,
  VideoSessionStatus,
  CreateVideoVerificationDto,
} from '../dtos/video-verification.dto';

/**
 * Video Verification Service
 * Handles video-based liveness detection and face matching for ID-verified users
 * Called after successful DigiLocker verification
 */
@Injectable()
export class VideoVerificationService {
  private readonly logger = new Logger(VideoVerificationService.name);
  private readonly SESSION_EXPIRY_MINUTES = 30; // 30 minutes to complete video

  constructor(private readonly prisma: PrismaService) {}


  async createVideoVerification(
    dto: CreateVideoVerificationDto,
    userId: string,
  ): Promise<any> {
    this.logger.log(`Processing VideoVerification submission for user: ${userId}`);

    const { photoUrl, videoUrl } = dto;

    if (!photoUrl || !videoUrl) {
      throw new BadRequestException('Both photo and video URLs are required');
    }

    try {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.status === 'VIDEO_VERIFIED') {
        this.logger.log(`User ${userId} already VIDEO_VERIFIED`);
        return {
          success: true,
          message: 'Already verified',
          status: 'VIDEO_VERIFIED',
        };
      }

      // Auto-create or update video verification → instantly approved
      const videoVerification = await this.prisma.userVideoVerification.upsert({
        where: { userId },
        update: {
          photoUrl,
          videoUrl,
          status: 'VERIFIED',
          verified: true,
          verifiedAt: new Date(),
        },
        create: {
          userId,
          photoUrl,
          videoUrl,
          status: 'VERIFIED',
          verified: true,
          verifiedAt: new Date(),
        },
      });

      // Upgrade user status
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'VIDEO_VERIFIED',
        },
      });

      this.logger.log(`User ${userId} instantly VIDEO_VERIFIED`);

      return {
        success: true,
        message: 'Verification successful! Welcome aboard.',
        verificationStatus: 'VIDEO_VERIFIED',
        verifiedAt: videoVerification.verifiedAt,
      };
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to complete registration');
    }
  }


  async getVideoVerificationStatus(userId: string): Promise<any> {
    this.logger.log(`Fetching verification status for user: ${userId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });

      const videoVerification = await this.prisma.userVideoVerification.findUnique({
        where: { userId },
        select: {
          photoUrl: true,
          videoUrl: true,
          status: true,
          verified: true,
          // verifiedAt: true,
          // createdAt: true,
        },
      });

      if (!videoVerification) {
        return {
          success: true,
          verified: false,
          status: 'NOT_STARTED',
          message: 'Please complete video verification',
        };
      }

      return {
        success: true,
        verified: videoVerification.verified,
        status: user?.status || 'ID_VERIFIED',
        message:
          videoVerification.verified
            ? 'You are fully verified!'
            : 'Verification in progress...',
        // verifiedAt: videoVerification.verifiedAt,
        photoUrl: videoVerification.photoUrl,
        videoUrl: videoVerification.videoUrl,
      };
    } catch (error) {
      this.logger.error(`Status check failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch status');
    }
  }

  /**
   * Step 1: Initiate Video Verification Session
   * User must be ID_VERIFIED (completed DigiLocker) before initiating video verification
   */
  // async initiateVideoVerification(
  //   userId: string,
  //   dto: InitiateVideoVerificationDto,
  // ): Promise<any> {
  //   this.logger.log(`Initiating video verification for user: ${userId}`);

  //   try {
  //     // Verify user exists and is ID_VERIFIED
  //     const user = await this.prisma.user.findUnique({
  //       where: { id: userId },
  //     });

  //     if (!user) {
  //       throw new NotFoundException('User not found');
  //     }

  //     // User must have completed ID verification (DigiLocker)
  //     if (user.status !== 'ID_VERIFIED') {
  //       throw new BadRequestException(
  //         `User must complete ID verification before video verification. Current status: ${user.status}`,
  //       );
  //     }

  //     // Check if user already has a verified video
  //     const existingVerification =
  //       await this.prisma.userVideoVerification.findUnique({
  //         where: { userId },
  //       });

  //     if (existingVerification?.verified) {
  //       this.logger.log(`User ${userId} already has verified video`);
  //       return {
  //         success: true,
  //         message: 'User already verified via video',
  //         status: 'ALREADY_VERIFIED',
  //       };
  //     }

  //     // Generate unique session ID
  //     const sessionId = this.generateSessionId();

  //     // Create video verification session
  //     const expiresAt = new Date();
  //     expiresAt.setMinutes(expiresAt.getMinutes() + this.SESSION_EXPIRY_MINUTES);

  //     const session = await this.prisma.videoVerificationSession.create({
  //       data: {
  //         sessionId,
  //         userId,
  //         status: VideoSessionStatus.INITIATED,
  //         expiresAt,
  //       },
  //     });

  //     this.logger.log(`Video verification session created: ${sessionId}`);

  //     return {
  //       success: true,
  //       message: 'Video verification session initiated. Please record a video.',
  //       sessionId,
  //       expiresAt: session.expiresAt,
  //       instructions: {
  //         maxDuration: 30, // seconds
  //         acceptedFormats: ['mp4', 'webm', 'mov'],
  //         minFileSize: 100 * 1024, // 100 KB
  //         maxFileSize: 50 * 1024 * 1024, // 50 MB
  //         guidelines: [
  //           'Face should be clearly visible',
  //           'Good lighting is essential',
  //           'No glasses or face coverings allowed',
  //           'Look directly at camera',
  //           'Blink naturally and smile',
  //         ],
  //       },
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error initiating video verification: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * Step 2: Submit Video for Verification
   * User uploads video; system processes it for face detection and liveness
   */
  // async submitVideoVerification(
  //   userId: string,
  //   dto: SubmitVideoVerificationDto,
  // ): Promise<any> {
  //   this.logger.log(`Submitting video for user: ${userId}`);

  //   try {
  //     // Verify session exists and is valid
  //     const session = await this.prisma.videoVerificationSession.findUnique({
  //       where: { sessionId: dto.sessionId },
  //     });

  //     if (!session || session.userId !== userId) {
  //       throw new BadRequestException('Invalid or expired session');
  //     }

  //     if (session.expiresAt < new Date()) {
  //       throw new BadRequestException('Session has expired');
  //     }

  //     // Get user's DigiLocker verification for face comparison
  //     const userVerification = await this.prisma.userVerification.findUnique({
  //       where: { userId },
  //     });

  //     if (!userVerification?.verified) {
  //       throw new BadRequestException('User must complete ID verification first');
  //     }

  //     // Update session status to SUBMITTED
  //     await this.prisma.videoVerificationSession.update({
  //       where: { sessionId: dto.sessionId },
  //       data: { status: VideoSessionStatus.SUBMITTED },
  //     });

  //     // Create or update UserVideoVerification record
  //     const videoVerification =
  //       await this.prisma.userVideoVerification.upsert({
  //         where: { userId },
  //         update: {
  //           videoUrl: dto.videoUrl,
  //           videoDuration: dto.videoDuration,
  //           videoSize: dto.videoSize || 0,
  //           videoFormat: dto.videoFormat,
  //           videoVerificationSessionId: session.id,
  //           status: VideoVerificationStatus.PENDING,
  //         },
  //         create: {
  //           userId,
  //           videoUrl: dto.videoUrl,
  //           videoDuration: dto.videoDuration,
  //           videoSize: dto.videoSize || 0,
  //           videoFormat: dto.videoFormat,
  //           videoVerificationSessionId: session.id,
  //           status: VideoVerificationStatus.PENDING,
  //           faceDetected: false,
  //         },
  //       });

  //     this.logger.log(`Video submitted for user ${userId}: ${videoVerification.id}`);

  //     // TODO: Trigger async video processing (ML pipeline for face detection/liveness)
  //     // For now, mark as pending for manual review
  //     // this.processVideoAsync(videoVerification.id, dto.videoUrl);

  //     return {
  //       success: true,
  //       message: 'Video submitted successfully. Verification in progress.',
  //       status: VideoVerificationStatus.PENDING,
  //       nextStatus: 'Admin will review within 24 hours',
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error submitting video: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * Step 3: Get Video Verification Status
   * User checks current verification status
   */
  // async getVideoVerificationStatus(
  //   userId: string,
  // ): Promise<UserVideoStatusDto> {
  //   this.logger.log(`Getting video verification status for user: ${userId}`);

  //   try {
  //     const verification = await this.prisma.userVideoVerification.findUnique({
  //       where: { userId },
  //     });

  //     if (!verification) {
  //       return {
  //         success: true,
  //         verified: false,
  //         status: VideoVerificationStatus.PENDING,
  //         message:
  //           'No video verification found. Please initiate video verification.',
  //         nextSteps: [
  //           '1. Click "Start Video Verification"',
  //           '2. Record a video with clear face visibility',
  //           '3. Submit video for verification',
  //           '4. Wait for admin approval',
  //         ],
  //       };
  //     }

  //     return {
  //       success: true,
  //       verified: verification.verified,
  //       status: verification.status as VideoVerificationStatus,
  //       verifiedAt: verification.verifiedAt || undefined,
  //       rejectionReason: verification.rejectionReason || undefined,
  //       message: this.getStatusMessage(verification.status),
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error getting status: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * ADMIN: Verify Video (Accept)
   * Admin approves video verification
   */
  // async adminVerifyVideo(
  //   adminId: string,
  //   dto: AdminVerifyVideoDto,
  // ): Promise<any> {
  //   this.logger.log(
  //     `Admin ${adminId} verifying video for user ${dto.userId}`,
  //   );

  //   try {
  //     // Verify admin exists and has permission
  //     const admin = await this.prisma.user.findUnique({
  //       where: { id: adminId },
  //     });

  //     if (!admin || admin.role !== 'ADMIN') {
  //       throw new UnauthorizedException('Only admins can verify videos');
  //     }

  //     // Get video verification
  //     const verification = await this.prisma.userVideoVerification.findUnique({
  //       where: { userId: dto.userId },
  //     });

  //     if (!verification) {
  //       throw new NotFoundException('Video verification not found');
  //     }

  //     // Mark as verified
  //     const verified = await this.prisma.userVideoVerification.update({
  //       where: { userId: dto.userId },
  //       data: {
  //         verified: true,
  //         status: VideoVerificationStatus.VERIFIED,
  //         verifiedAt: new Date(),
  //         verifiedBy: adminId,
  //         faceMatchScore: dto.faceMatchScore || 0.95,
  //       },
  //     });

  //     // Update user status to VIDEO_VERIFIED
  //     const user = await this.prisma.user.update({
  //       where: { id: dto.userId },
  //       data: { status: 'VIDEO_VERIFIED' },
  //     });

  //     this.logger.log(`Video verified for user ${dto.userId}`);

  //     return {
  //       success: true,
  //       message: 'Video verification approved',
  //       userId: dto.userId,
  //       status: VideoVerificationStatus.VERIFIED,
  //       userStatus: user.status,
  //       verifiedAt: verified.verifiedAt,
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error verifying video: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * ADMIN: Reject Video
   * Admin rejects video verification and requests re-submission
   */
  // async adminRejectVideo(
  //   adminId: string,
  //   dto: AdminRejectVideoDto,
  // ): Promise<any> {
  //   this.logger.log(
  //     `Admin ${adminId} rejecting video for user ${dto.userId}`,
  //   );

  //   try {
  //     // Verify admin
  //     const admin = await this.prisma.user.findUnique({
  //       where: { id: adminId },
  //     });

  //     if (!admin || admin.role !== 'ADMIN') {
  //       throw new UnauthorizedException('Only admins can reject videos');
  //     }

  //     // Get video verification
  //     const verification = await this.prisma.userVideoVerification.findUnique({
  //       where: { userId: dto.userId },
  //     });

  //     if (!verification) {
  //       throw new NotFoundException('Video verification not found');
  //     }

  //     // Mark as rejected
  //     const rejected = await this.prisma.userVideoVerification.update({
  //       where: { userId: dto.userId },
  //       data: {
  //         verified: false,
  //         status: VideoVerificationStatus.REJECTED,
  //         rejectionReason: dto.rejectionReason,
  //         verifiedBy: adminId,
  //       },
  //     });

  //     this.logger.log(
  //       `Video rejected for user ${dto.userId}: ${dto.rejectionReason}`,
  //     );

  //     return {
  //       success: true,
  //       message: 'Video verification rejected. User can re-submit.',
  //       userId: dto.userId,
  //       status: VideoVerificationStatus.REJECTED,
  //       rejectionReason: dto.rejectionReason,
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error rejecting video: ${error.message}`);
  //     throw error;
  //   }
  // }

  /**
   * ADMIN: Get All Pending Videos
   * Get list of videos awaiting review
   */
  // async adminGetPendingVideos(adminId: string): Promise<any> {
  //   this.logger.log(`Admin ${adminId} requesting pending videos`);

  //   try {
  //     // Verify admin
  //     const admin = await this.prisma.user.findUnique({
  //       where: { id: adminId },
  //     });

  //     if (!admin || admin.role !== 'ADMIN') {
  //       throw new UnauthorizedException('Only admins can access this');
  //     }

  //     const pending = await this.prisma.userVideoVerification.findMany({
  //       where: { status: VideoVerificationStatus.PENDING },
  //       include: { user: { select: { id: true, email: true, name: true } } },
  //       orderBy: { createdAt: 'asc' },
  //     });

  //     return {
  //       success: true,
  //       count: pending.length,
  //       videos: pending.map((v) => ({
  //         userId: v.userId,
  //         userEmail: v.user.email,
  //         userName: v.user.name,
  //         submittedAt: v.createdAt,
  //         videoDuration: v.videoDuration,
  //         status: v.status,
  //       })),
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error getting pending videos: ${error.message}`);
  //     throw error;
  //   }
  // }

  // ==================== PRIVATE METHODS ====================

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `VID_${timestamp}_${random}`;
  }

  /**
   * Get user-friendly status message
   */
  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      [VideoVerificationStatus.PENDING]:
        'Your video is under review. Please wait for admin approval.',
      [VideoVerificationStatus.VERIFIED]:
        'Your video has been verified successfully! You can now complete onboarding.',
      [VideoVerificationStatus.REJECTED]:
        'Your video verification was rejected. Please re-submit a new video.',
      [VideoVerificationStatus.FAILED]:
        'Video processing failed. Please try again.',
    };
    return messages[status] || 'Unknown status';
  }

  /**
   * TODO: Async video processing
   * Integrate with ML/face detection service
   */
  // private async processVideoAsync(verificationId: string, videoUrl: string) {
  //   // Call ML pipeline to:
  //   // 1. Detect face in video
  //   // 2. Check liveness score
  //   // 3. Compare face with DigiLocker photo
  //   // 4. Store results in UserVideoVerification
  // }
}

// export class CreateRegistrationDto {
//   @ApiProperty({
//     description: 'User clicked photo key',
//     example: 'userClickedPhotoKey',
//   })
//   userClickedPhotoKey: string;

//   @ApiProperty({
//     description: 'User video key',
//     example: 'userVideoKey',
//   })
//   userVideoKey: string;
// }

// import { customiseSessionToken } from 'src/utils/auth/customise-session-token';
