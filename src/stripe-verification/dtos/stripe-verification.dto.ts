import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Request DTO: Verify Stripe Identity Session
 * Used to verify a Stripe Identity verification session
 */
export class VerifyStripeIdentityDto {
  @IsString()
  @IsNotEmpty()
  verificationSessionId: string;
}
