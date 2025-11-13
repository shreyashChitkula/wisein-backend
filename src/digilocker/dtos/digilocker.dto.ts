import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, Matches } from 'class-validator';

/**
 * DigiLocker Verification DTOs
 * Used for onboarding flow integration
 */

export enum DocumentType {
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  DRIVING_LICENSE = 'DRIVING_LICENSE'
}

export enum UserFlow {
  SIGNIN = 'signin',
  SIGNUP = 'signup'
}

export enum VerificationStatus {
  INITIATED = 'INITIATED',
  AUTHENTICATED = 'AUTHENTICATED',
  PENDING = 'PENDING',
  EXPIRED = 'EXPIRED',
  CONSENT_DENIED = 'CONSENT_DENIED',
  SUCCESS = 'SUCCESS'
}

/**
 * User provided data interface for type safety
 */
export interface UserProvidedData {
  nameAsPerAadhaar: string;
  dateOfBirth: string;
  gender: string;
  country?: string;
  state: string;
  district?: string;
  pincode: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
}

/**
 * Request DTO: Initiate DigiLocker Verification
 */
export class InitiateDigiLockerDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10}$/, {
    message: 'Mobile number must be 10 digits'
  })
  mobileNumber: string;
}

/**
 * Response DTO: DigiLocker Initiation Response
 */
export class DigiLockerInitiationResponseDto {
  success: boolean;
  accountExists: boolean;
  consentUrl: string;
  verificationId: string;
  flowType: UserFlow;
  message: string;
}

/**
 * Request DTO: Process DigiLocker Callback
 */
export class ProcessDigiLockerCallbackDto {
  @IsString()
  @IsNotEmpty()
  verificationId: string;
}

/**
 * Response DTO: DigiLocker Callback Response
 */
export class DigiLockerCallbackResponseDto {
  success: boolean;
  status: VerificationStatus;
  readyForComparison: boolean;
  message: string;
}

/**
 * Request DTO: Complete DigiLocker Verification with User Data
 */
export class CompleteDigiLockerVerificationDto {
  @IsString()
  @IsNotEmpty()
  verificationId: string;

  @IsNotEmpty()
  userProvidedData: UserProvidedData;
}

/**
 * Response DTO: Verification Completion Response
 */
export class DigiLockerVerificationCompleteDto {
  success: boolean;
  message: string;
  verificationId: string;
  verified: boolean;
  comparisonDetails?: {
    nameMatch: boolean;
    dobMatch: boolean;
    genderMatch: boolean;
    stateMatch: boolean;
    pincodeMatch: boolean;
    mismatches?: string[];
  };
}

/**
 * Response DTO: Get Verification Status
 */
export class GetVerificationStatusDto {
  status: VerificationStatus;
  readyForComparison: boolean;
  message: string;
}

/**
 * Response DTO: Get User Verification Status
 */
export class GetUserVerificationStatusDto {
  success: boolean;
  verified: boolean;
  verificationType?: string;
  message: string;
}
