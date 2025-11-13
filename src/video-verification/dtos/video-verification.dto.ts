import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

export enum VideoVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum VideoSessionStatus {
  INITIATED = 'INITIATED',
  RECORDING = 'RECORDING',
  SUBMITTED = 'SUBMITTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

/**
 * Request DTO: Initiate Video Verification Session
 * Called after user completes DigiLocker verification (ID_VERIFIED status)
 */
export class InitiateVideoVerificationDto {
  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

/**
 * Response DTO: Video Verification Session Initiated
 */
export class VideoVerificationSessionInitiatedDto {
  success: boolean;
  message: string;
  sessionId: string;
  expiresAt: Date;
  // Recording instructions
  instructions?: {
    maxDuration: number; // seconds
    acceptedFormats: string[];
    minFileSize: number; // bytes
    maxFileSize: number; // bytes
  };
}

/**
 * Request DTO: Submit Video for Verification
 * User submits recorded/captured video for verification
 */
export class SubmitVideoVerificationDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  videoUrl: string; // S3/storage URL after upload

  @IsNumber()
  @Min(1)
  videoDuration: number; // in seconds

  @IsString()
  @IsOptional()
  videoFormat?: string; // mp4, webm, etc.

  @IsNumber()
  @IsOptional()
  videoSize?: number; // in bytes

  @IsString()
  @IsOptional()
  ipAddress?: string;
}

/**
 * Response DTO: Video Submission Acknowledged
 */
export class VideoSubmissionAcknowledgedDto {
  success: boolean;
  message: string;
  status: VideoVerificationStatus;
  nextStatus: string; // "PROCESSING" or "PENDING_ADMIN_REVIEW"
}

/**
 * Request DTO: Get Video Verification Status
 */
export class GetVideoVerificationStatusDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

/**
 * Response DTO: Video Verification Status
 */
export class VideoVerificationStatusDto {
  success: boolean;
  sessionId: string;
  status: VideoVerificationStatus;
  verified: boolean;
  message: string;
  verifiedAt?: Date;
  rejectionReason?: string;
  comparisonDetails?: {
    faceDetected: boolean;
    livenessScore?: number;
    faceMatchScore?: number;
    matchDetails?: string[];
  };
}

/**
 * Request DTO: Admin - Verify Video (Accept)
 */
export class AdminVerifyVideoDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  faceMatchScore?: number;
}

/**
 * Response DTO: Admin Verification Result
 */
export class AdminVerificationResultDto {
  success: boolean;
  message: string;
  userId: string;
  status: VideoVerificationStatus;
  userStatus: string; // Should be VIDEO_VERIFIED now
  verifiedAt: Date;
}

/**
 * Request DTO: Admin - Reject Video
 */
export class AdminRejectVideoDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  rejectionReason: string; // Why verification failed

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Response DTO: Admin Rejection Result
 */
export class AdminRejectionResultDto {
  success: boolean;
  message: string;
  userId: string;
  status: VideoVerificationStatus;
  rejectionReason: string;
}

/**
 * Request DTO: Get User Video Verification Status
 */
export class GetUserVideoStatusDto {
  // No body needed - uses authenticated user
}

/**
 * Response DTO: User Video Verification Status
 */
export class UserVideoStatusDto {
  success: boolean;
  verified: boolean;
  status: VideoVerificationStatus;
  verifiedAt?: Date;
  rejectionReason?: string;
  message: string;
  nextSteps?: string[];
}

/**
 * Internal DTO: Processed Video Data
 */
export class ProcessedVideoDataDto {
  videoUrl: string;
  videoDuration: number;
  videoSize?: number;
  videoFormat?: string;
  faceDetected: boolean;
  livenessScore?: number;
  faceMatchScore?: number;
  comparisonResult?: {
    faceMatch: boolean;
    matchPercentage?: number;
    notes?: string;
  };
}
