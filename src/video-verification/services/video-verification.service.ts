import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVideoVerificationDto } from '../dtos/video-verification.dto';

/**
 * Video Verification Service
 * Handles video-based liveness detection and face matching for ID-verified users
 * Called after successful DigiLocker verification
 */
@Injectable()
export class VideoVerificationService {
  private readonly logger = new Logger(VideoVerificationService.name);

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

      if (user.status === 'VIDEO_VERIFIED' || user.status === 'APPROVED') {
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
          status: 'VIDEO_VERIFIED',
          verified: true,
          verifiedAt: new Date(),
        },
        create: {
          userId,
          photoUrl,
          videoUrl,
          status: 'VIDEO_VERIFIED',
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
        photoUrl: videoVerification.photoUrl,
        videoUrl: videoVerification.videoUrl,
      };
    } catch (error) {
      this.logger.error(`Status check failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch status');
    }
  }
}
