import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../shared/mail/mail.service';
import * as fs from 'fs';
import * as path from 'path';

// Note: These integrations need to be set up with actual API keys
// For now, these are placeholder implementations

@Injectable()
export class VerificationService {
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Step 3: DigiLocker Verification (for Indian users)
   * Exchange authorization code for user data
   */
  async verifyWithDigilocker(
    userId: string,
    authorizationCode: string,
  ): Promise<{
    message: string;
    verificationStatus: string;
  }> {
    // TODO: Implement DigiLocker API integration
    // Steps:
    // 1. Exchange authorization code for access token
    // 2. Fetch user's identity data from DigiLocker
    // 3. Extract name, DOB, Aadhaar, etc.

    // Placeholder implementation
    const digilockerData = {
      name: 'John Doe', // This would come from DigiLocker API
      dateOfBirth: '1990-01-15',
      documentType: 'Aadhaar',
      documentNumber: 'XXXXXXXXXXXXXX',
      gender: 'Male',
      address: 'Sample Address',
      state: 'Maharashtra',
    };

    // Create or update verification record
    const verification = await this.prisma.userVerification.upsert({
      where: { userId },
      update: {
        method: 'DIGILOCKER',
        verifiedData: digilockerData,
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
      create: {
        userId,
        method: 'DIGILOCKER',
        verifiedData: digilockerData,
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // Update user status to ID_VERIFIED
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ID_VERIFIED' },
    });

    return {
      message: 'DigiLocker verification successful',
      verificationStatus: 'VERIFIED',
    };
  }

  /**
   * Step 4: Upload and process video
   * Extract frame from video and use as profile picture
   */
  async uploadAndProcessVideo(
    userId: string,
    videoFile: any, // typed as any instead of Express.Multer.File due to type definition issues
  ): Promise<{
    videoUrl: string;
    frameUrl: string;
    message: string;
  }> {
    if (!videoFile) {
      throw new BadRequestException('Video file is required');
    }

    // Validate file type
    const allowedMimetypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedMimetypes.includes(videoFile.mimetype)) {
      throw new BadRequestException(
        'Invalid video format. Use MP4, WebM, or MOV',
      );
    }

    // Validate file size (max 100MB)
    const maxFileSize = 100 * 1024 * 1024;
    if (videoFile.size > maxFileSize) {
      throw new BadRequestException('Video file too large. Max size: 100MB');
    }

    try {
      // Save video file
      const videoFilename = `video_${userId}_${Date.now()}.mp4`;
      const videoPath = path.join(this.uploadsDir, 'videos', videoFilename);

      // Create videos directory if it doesn't exist
      const videosDir = path.join(this.uploadsDir, 'videos');
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }

      fs.writeFileSync(videoPath, videoFile.buffer);

      // Extract frame from video
      // TODO: Implement frame extraction using ffmpeg or jimp
      // For now, use a placeholder
      const frameFilename = `frame_${userId}_${Date.now()}.jpg`;
      const framePath = path.join(this.uploadsDir, 'frames', frameFilename);

      // Create frames directory if it doesn't exist
      const framesDir = path.join(this.uploadsDir, 'frames');
      if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir, { recursive: true });
      }

      // Placeholder: Copy video as frame (in production, extract actual frame)
      fs.copyFileSync(videoPath, framePath);

      const videoUrl = `/uploads/videos/${videoFilename}`;
      const frameUrl = `/uploads/frames/${frameFilename}`;

      // Update verification record
      const verification = await this.prisma.userVerification.findUnique({
        where: { userId },
      });

      if (!verification) {
        throw new BadRequestException(
          'Complete ID verification before uploading video',
        );
      }

      await this.prisma.userVerification.update({
        where: { userId },
        data: {
          videoUrl,
          frameUrl,
        },
      });

      // Update user with profile picture and status
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          profilePicUrl: frameUrl,
          status: 'VIDEO_VERIFIED',
        },
      });

      // Send verification pending email
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (user?.email) {
          await this.mailService.sendVerificationPending(
            user.email,
            user.name || undefined,
          );
        }
      } catch (emailError) {
        // Log error but don't fail the verification process
        console.error('Failed to send verification pending email:', emailError);
      }

      return {
        videoUrl,
        frameUrl,
        message: 'Video uploaded and processed successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Video processing failed: ${error.message}`,
      );
    }
  }

  /**
   * Get user verification status
   */
  async getVerificationStatus(userId: string): Promise<{
    status: string;
    method: string | null;
    verifiedData: any;
    videoUrl: string | null;
    frameUrl: string | null;
    verifiedAt: Date | null;
    rejectionReason: string | null;
  }> {
    const verification = await this.prisma.userVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      return {
        status: 'NOT_STARTED',
        method: null,
        verifiedData: null,
        videoUrl: null,
        frameUrl: null,
        verifiedAt: null,
        rejectionReason: null,
      };
    }

    return {
      status: verification.verificationStatus,
      method: verification.method,
      verifiedData: verification.verifiedData,
      videoUrl: verification.videoUrl,
      frameUrl: verification.frameUrl,
      verifiedAt: verification.verifiedAt,
      rejectionReason: verification.rejectionReason,
    };
  }
}
