import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Request DTO: Create Video Verification
 * Used to submit photo and video URLs for video verification
 */
export class CreateVideoVerificationDto {
  @IsString()
  @IsNotEmpty()
  photoUrl: string;

  @IsString()
  @IsNotEmpty()
  videoUrl: string;
}
