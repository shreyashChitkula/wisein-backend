import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;
}

export class LoginDto {
  @IsEmail()
  email: string;
}

export class SendOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;
}

export class SelectCountryDto {
  @IsString()
  country: string;
}

export class VerifyIdWithDigilockerDto {
  @IsString()
  authorizationCode: string;
}

export class UploadVideoDto {
  // File handling will be done via @UseInterceptors
  // The file will be passed in the request
}

export class SubmitVideoVerificationDto {
  @IsString()
  videoUrl: string;
}

export class SelectSubscriptionPlanDto {
  @IsEnum(['INDIVIDUAL', 'COMPANY'])
  planType: string;

  @IsString()
  planName: string;
}

export class CreateCashfreeCheckoutSessionDto {
  @IsString()
  planName: string;

  @IsEnum(['INDIVIDUAL', 'COMPANY'])
  planType: string;

  @IsString()
  amount: string;
}

export class GetOnboardingStatusDto {
  // Query parameters will be extracted from the user context
}
