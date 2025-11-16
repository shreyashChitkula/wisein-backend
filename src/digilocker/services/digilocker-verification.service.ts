import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InitiateDigiLockerDto,
  ProcessDigiLockerCallbackDto,
  CompleteDigiLockerVerificationDto,
  DigiLockerInitiationResponseDto,
  DigiLockerCallbackResponseDto,
  DigiLockerVerificationCompleteDto,
  DocumentType,
  UserFlow,
  VerificationStatus,
} from '../dtos/digilocker.dto';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { getCashfreeSignature } from '../../utils/cashfree/public-key';

/**
 * DigiLocker Verification Service
 * Handles DigiLocker API integration for onboarding flow
 */
@Injectable()
export class DigiLockerVerificationService {
  private readonly logger = new Logger(DigiLockerVerificationService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly prisma: PrismaService) {
    this.baseUrl =
      process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com';
    this.clientId = process.env.CASHFREE_API_KEY || '';
    this.clientSecret = process.env.CASHFREE_API_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      this.logger.error('Cashfree API credentials not configured');
    }
  }

  /**
   * Generate unique verification ID
   */
  private generateVerificationId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `VER_${timestamp}_${random}`;
  }

  /**
   * Step 1: Initiate DigiLocker Verification
   * Checks if DigiLocker account exists and generates consent URL
   */
  async initiateVerification(
    userId: string,
    dto: InitiateDigiLockerDto,
  ): Promise<DigiLockerInitiationResponseDto> {
    this.logger.log(`Initiating DigiLocker verification for user: ${userId}`);

    try {
      // Ensure user has completed email verification and selected country
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.status !== 'EMAIL_VERIFIED') {
        throw new BadRequestException('Please verify your email before starting ID verification');
      }

      // if (!user.country) {
      //   throw new BadRequestException('Please select your country before starting ID verification');
      // }

      // // Only allow Digilocker flow for users in India. Other users should use Stripe verification.
      // if (user.country && user.country.toLowerCase() !== 'india') {
      //   this.logger.warn(`User ${userId} attempted DigiLocker init but country is ${user.country}`);
      //   throw new BadRequestException(
      //     'DigiLocker verification is available only for users in India. Please use Stripe verification for users outside India.',
      //   );
      // }

      // Validate input
      if (!dto.mobileNumber || !/^\d{10}$/.test(dto.mobileNumber)) {
        throw new BadRequestException('Invalid mobile number format');
      }

      // Check if user already has verified identity
      const existingVerification = await this.prisma.userVerification.findUnique({
        where: { userId },
      });

      if (existingVerification?.verified) {
        return {
          success: true,
          accountExists: true,
          consentUrl: '',
          verificationId: '',
          flowType: UserFlow.SIGNIN,
          message: 'User already verified',
        };
      }

      // Clean up incomplete previous sessions
      await this.prisma.digiLockerVerificationSession.deleteMany({
        where: {
          userId,
          status: {
            in: ['INITIATED', 'AUTHENTICATED', 'PENDING', 'EXPIRED'],
          },
        },
      });

      const verificationId = this.generateVerificationId();

      // Call Cashfree API to verify account existence
      const accountCheckResult = await this.verifyDigiLockerAccount(
        verificationId,
        dto.mobileNumber,
      );

      // Check if DigiLocker ID is already used
      if (accountCheckResult.digilocker_id) {
        const existingUse = await this.prisma.userVerification.findUnique({
          where: { digilockerAccountId: accountCheckResult.digilocker_id },
        });

        if (existingUse && existingUse.userId !== userId) {
          throw new ConflictException(
            'This DigiLocker account is already verified by another user',
          );
        }
      }

      // Generate consent URL
      const userFlow = accountCheckResult.digilocker_id
        ? UserFlow.SIGNIN
        : UserFlow.SIGNUP;

      const urlResult = await this.createDigiLockerConsent(
        verificationId,
        userFlow,
        [DocumentType.AADHAAR],
      );

      // Store verification session
      await this.prisma.digiLockerVerificationSession.create({
        data: {
          verificationId,
          userId,
          mobileNumber: dto.mobileNumber,
          status: 'INITIATED',
          flowType: userFlow.toLowerCase() as 'signin' | 'signup',
          consentUrl: urlResult.url,
          digilockerAccountId: accountCheckResult.digilocker_id || null,
        },
      });

      this.logger.log(
        `Verification initiated for user ${userId} with ID: ${verificationId}`,
      );

      return {
        success: true,
        accountExists: !!accountCheckResult.digilocker_id,
        consentUrl: urlResult.url,
        verificationId,
        flowType: userFlow,
        message: accountCheckResult.digilocker_id
          ? 'DigiLocker account found. Please complete verification.'
          : 'New DigiLocker account will be created. Please complete signup.',
      };
    } catch (error) {
      this.logger.error(`Error initiating verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 2: Process DigiLocker Callback
   * Handles callback after user completes consent flow
   */
  async processCallback(
    userId: string,
    dto: ProcessDigiLockerCallbackDto,
  ): Promise<DigiLockerCallbackResponseDto> {
    this.logger.log(
      `Processing DigiLocker callback for user: ${userId}, verification: ${dto.verificationId}`,
    );

    try {
      // Ensure caller is eligible for DigiLocker (India-only)
      const caller = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!caller) throw new BadRequestException('User not found');
      if (caller.country && caller.country.toLowerCase() !== 'india') {
        this.logger.warn(`User ${userId} attempted DigiLocker callback but country is ${caller.country}`);
        throw new BadRequestException(
          'DigiLocker verification is available only for users in India. Please use Stripe verification for users outside India.',
        );
      }

      // Get verification session
      const session = await this.prisma.digiLockerVerificationSession.findUnique({
        where: { verificationId: dto.verificationId },
      });

      if (!session || session.userId !== userId) {
        throw new BadRequestException('Invalid verification session');
      }

      // Check status with Cashfree
      const statusResult = await this.getDigiLockerVerificationStatus(
        dto.verificationId,
      );

      // Update session status
      await this.prisma.digiLockerVerificationSession.update({
        where: { verificationId: dto.verificationId },
        data: {
          status:
            statusResult.status === 'AUTHENTICATED'
              ? 'AUTHENTICATED'
              : 'PENDING',
        },
      });

      return {
        success: statusResult.status === 'AUTHENTICATED',
        status: statusResult.status as VerificationStatus,
        readyForComparison: statusResult.status === 'AUTHENTICATED',
        message:
          statusResult.status === 'AUTHENTICATED'
            ? 'DigiLocker verification successful. Ready for comparison.'
            : 'Verification still pending.',
      };
    } catch (error) {
      this.logger.error(`Error processing callback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 3: Complete Verification with Data Comparison
   * Fetches DigiLocker data and compares with user input
   */
  async completeVerification(
    userId: string,
    dto: CompleteDigiLockerVerificationDto,
  ): Promise<DigiLockerVerificationCompleteDto> {
    this.logger.log(
      `Completing verification for user: ${userId}, verification: ${dto.verificationId}`,
    );

    try {
      // Ensure caller is eligible for DigiLocker (India-only)
      const caller = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!caller) throw new BadRequestException('User not found');
      if (caller.country && caller.country.toLowerCase() !== 'india') {
        this.logger.warn(`User ${userId} attempted DigiLocker completion but country is ${caller.country}`);
        throw new BadRequestException(
          'DigiLocker verification is available only for users in India. Please use Stripe verification for users outside India.',
        );
      }

      // Get session
      const session = await this.prisma.digiLockerVerificationSession.findUnique({
        where: { verificationId: dto.verificationId },
      });

      if (!session || session.userId !== userId) {
        throw new BadRequestException('Invalid verification ID or expired session');
      }

      if (session.status !== 'AUTHENTICATED') {
        throw new BadRequestException(
          'DigiLocker authentication not completed. Please complete the flow first.',
        );
      }

      // Fetch document from DigiLocker
      let digilockerDocument;
      try {
        digilockerDocument = await this.getDigiLockerDocument(
          dto.verificationId,
          DocumentType.AADHAAR,
        );
      } catch (error) {
        this.logger.error(`Failed to fetch document: ${error.message}`);
        throw new BadRequestException(
          'Failed to retrieve your Aadhaar document. Please try again.',
        );
      }

      // Compare data
      const comparisonResult = this.compareData(
        digilockerDocument,
        dto.userProvidedData,
      );

      if (!comparisonResult.isMatch) {
        throw new BadRequestException(
          `Data mismatch. Mismatched fields: ${comparisonResult.mismatchedFields.join(', ')}`,
        );
      }

      // Store verification in database
      const digilockerAccountId =
        session.digilockerAccountId || digilockerDocument.uid;

      if (!digilockerAccountId) {
        throw new BadRequestException(
          'DigiLocker account ID not available. Please restart verification.',
        );
      }

      // Check for duplicates
      const existingUse = await this.prisma.userVerification.findUnique({
        where: { digilockerAccountId },
      });

      if (existingUse && existingUse.userId !== userId) {
        throw new ConflictException(
          'This DigiLocker account is already verified by another user',
        );
      }

      // Save verification
      await this.prisma.userVerification.upsert({
        where: { userId },
        update: {
          digilockerAccountId,
          verified: true,
          nameAsPerAadhaar: dto.userProvidedData.nameAsPerAadhaar,
          dateOfBirth: new Date(dto.userProvidedData.dateOfBirth),
          gender: dto.userProvidedData.gender,
          state: dto.userProvidedData.state,
          district: dto.userProvidedData.district || null,
          pincode: dto.userProvidedData.pincode,
          phoneNumber: dto.userProvidedData.phoneNumber,
          addressLine1: dto.userProvidedData.addressLine1,
          addressLine2: dto.userProvidedData.addressLine2 || null,
          comparisonResult: comparisonResult,
        },
        create: {
          userId,
          method: 'DIGILOCKER' as any,
          digilockerAccountId,
          verified: true,
          nameAsPerAadhaar: dto.userProvidedData.nameAsPerAadhaar,
          dateOfBirth: new Date(dto.userProvidedData.dateOfBirth),
          gender: dto.userProvidedData.gender,
          country: dto.userProvidedData.country,
          state: dto.userProvidedData.state,
          district: dto.userProvidedData.district || null,
          pincode: dto.userProvidedData.pincode,
          phoneNumber: dto.userProvidedData.phoneNumber,
          addressLine1: dto.userProvidedData.addressLine1,
          addressLine2: dto.userProvidedData.addressLine2 || null,
          comparisonResult: comparisonResult,
        },
      });

      // Clean up session
      await this.prisma.digiLockerVerificationSession.delete({
        where: { verificationId: dto.verificationId },
      });

      // Update user's onboarding/status to indicate ID verification completed
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { status: 'ID_VERIFIED' },
        });
        this.logger.log(`User onboarding status updated to ID_VERIFIED for user: ${userId}`);
      } catch (err) {
        // Log but don't fail the whole flow if updating user status fails
        this.logger.error(`Failed to update user status for ${userId}: ${err.message}`);
      }

      this.logger.log(`Verification completed successfully for user: ${userId}`);

      return {
        success: true,
        message: 'Identity verification completed successfully',
        verificationId: dto.verificationId,
        verified: true,
        comparisonDetails: {
          nameMatch: comparisonResult.matchedFields.includes('name'),
          dobMatch: comparisonResult.matchedFields.includes('dob'),
          genderMatch: comparisonResult.matchedFields.includes('gender'),
          stateMatch: comparisonResult.matchedFields.includes('state'),
          pincodeMatch: comparisonResult.matchedFields.includes('pincode'),
          mismatches: comparisonResult.mismatchedFields || [],
        },
      } as any;
    } catch (error) {
      this.logger.error(`Error completing verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get verification status
   */
  async getVerificationStatus(verificationId: string): Promise<{
    status: string;
    readyForComparison: boolean;
  }> {
    try {
      const session =
        await this.prisma.digiLockerVerificationSession.findUnique({
          where: { verificationId },
        });

      if (!session) {
        throw new NotFoundException('Verification session not found');
      }

      // If the session is still INITIATED or PENDING, check with Cashfree
      // so frontend polling can trigger the update. If Cashfree reports
      // AUTHENTICATED we update the DB and return the updated status.
      if (session.status === 'INITIATED' || session.status === 'PENDING') {
        try {
          const statusResult = await this.getDigiLockerVerificationStatus(
            verificationId,
          );

          if (statusResult && statusResult.status === 'AUTHENTICATED') {
            await this.prisma.digiLockerVerificationSession.update({
              where: { verificationId },
              data: { status: 'AUTHENTICATED' },
            });

            // return authenticated immediately
            return {
              status: 'AUTHENTICATED',
              readyForComparison: true,
            };
          }
          // If not authenticated yet, fall through and return DB status
        } catch (err) {
          // Don't fail the status endpoint if the external call fails.
          this.logger.warn(
            `Failed to refresh DigiLocker status from Cashfree for ${verificationId}: ${err.message}`,
          );
        }
      }

      return {
        status: session.status,
        readyForComparison: session.status === 'AUTHENTICATED',
      };
    } catch (error) {
      this.logger.error(`Error getting verification status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check user verification status
   */
  async checkUserVerificationStatus(userId: string): Promise<{
    needsMigration: boolean;
    verificationType: string | null;
    verified: boolean;
  }> {
    const verification = await this.prisma.userVerification.findUnique({
      where: { userId },
    });

    return {
      needsMigration: false,
      verificationType: verification?.verified ? 'DIGILOCKER' : null,
      verified: verification?.verified || false,
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Call Cashfree API to verify account
   */
  private async verifyDigiLockerAccount(
    verificationId: string,
    mobileNumber: string,
  ): Promise<any> {
    this.logger.log(`Verifying DigiLocker account for mobile: ${mobileNumber}`);

    try {
      const endpoint = '/verification/digilocker/verify-account';
      const payload = {
        verification_id: verificationId,
        mobile_number: mobileNumber,
      };

      const response = await this.makeApiRequest(endpoint, 'POST', payload);
      return response;
    } catch (error) {
      this.logger.error(`Account verification failed: ${error.message}`);
      throw new HttpException(
        'Failed to verify DigiLocker account',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create DigiLocker consent URL
   */
  private async createDigiLockerConsent(
    verificationId: string,
    userFlow: UserFlow,
    documents: DocumentType[],
  ): Promise<any> {
    this.logger.log(`Creating DigiLocker consent URL for flow: ${userFlow}`);

    try {
      const endpoint = '/verification/digilocker';
      
      // Construct redirect URI - where DigiLocker will redirect after completion
      // Default to frontend callback page, or use environment variable
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUri = `${frontendUrl}/digilocker/callback`;
      
      const payload = {
        verification_id: verificationId,
        document_requested: documents,
        user_flow: userFlow,
        redirect_uri: redirectUri, // Add redirect URI so DigiLocker redirects back to our page
      };

      this.logger.log(`DigiLocker redirect URI: ${redirectUri}`);

      const response = await this.makeApiRequest(endpoint, 'POST', payload);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create consent URL: ${error.message}`);
      throw new HttpException(
        'Failed to create verification URL',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get DigiLocker verification status
   */
  private async getDigiLockerVerificationStatus(
    verificationId: string,
  ): Promise<any> {
    this.logger.log(`Getting verification status for: ${verificationId}`);

    try {
      const endpoint = `/verification/digilocker?verification_id=${verificationId}`;
      const response = await this.makeApiRequest(endpoint, 'GET');
      return response;
    } catch (error) {
      this.logger.error(`Failed to get verification status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get DigiLocker document
   */
  private async getDigiLockerDocument(
    verificationId: string,
    documentType: DocumentType,
  ): Promise<any> {
    this.logger.log(
      `Fetching DigiLocker document: ${documentType} for ${verificationId}`,
    );

    try {
      // Cashfree DigiLocker expects a GET to /verification/digilocker/document/{document_type}?verification_id=...
      const endpoint = `/verification/digilocker/document/${documentType}?verification_id=${verificationId}`;
      const response = await this.makeApiRequest(endpoint, 'GET');
      return response;
    } catch (error) {
      this.logger.error(`Failed to fetch document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make authenticated API request to Cashfree
   */
  private async makeApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client-id': this.clientId,
      'x-client-secret': this.clientSecret,
    };

    // Add Cashfree signature for all requests (Cashfree requires x-cf-signature)
    try {
      headers['x-cf-signature'] = this.generateSignature();
    } catch (err) {
      this.logger.error('Failed to generate signature for request:', err.message);
    }

    try {
      // Debug: mask sensitive headers for logs
      const maskedHeaders = { ...headers } as Record<string, string>;
      if (maskedHeaders['x-client-secret']) maskedHeaders['x-client-secret'] = '****';
      if (maskedHeaders['x-cf-signature']) maskedHeaders['x-cf-signature'] = '****';

      this.logger.debug(`Outgoing Cashfree request -> ${method} ${url}`);
      this.logger.debug(`Headers: ${JSON.stringify(maskedHeaders)}`);
      if (body) this.logger.debug(`Body: ${JSON.stringify(body)}`);

      const response = await fetch(url, {
        method,
        headers,
        ...(body && method === 'POST' && { body: JSON.stringify(body) }),
      });

      // Try to read raw text first (some endpoints return non-json)
      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }

      this.logger.debug(`Cashfree response status: ${response.status}`);
      this.logger.debug(`Cashfree response body: ${JSON.stringify(data).slice(0, 2000)}`);

      if (!response.ok) {
        this.logger.error(
          `API error: ${response.status} - ${JSON.stringify(data)}`,
        );
        throw new HttpException(
          data?.message || 'API request failed',
          response.status,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Network error: ${error.message}`);
      throw new HttpException(
        'Failed to communicate with DigiLocker service',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Generate HMAC-SHA256 signature for Cashfree API request
   */
  private generateSignature(): string {
    try {
      return getCashfreeSignature(this.clientId, process.env.CASHFREE_PUBLIC_KEY || '');
    } catch (error) {
      this.logger.error('Failed to generate Cashfree signature:', error.message);
      throw new HttpException(
        'Failed to generate API signature. Check CASHFREE_PUBLIC_KEY configuration.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Compare DigiLocker data with user input
   */
  private compareData(
    digilockerData: any,
    userProvidedData: any,
  ): {
    isMatch: boolean;
    matchedFields: string[];
    mismatchedFields: string[];
  } {
    const details: Record<string, boolean> = {
      name: this.compareName(
        digilockerData.name,
        userProvidedData.nameAsPerAadhaar,
      ),
      dob: this.compareDate(
        digilockerData.dob,
        userProvidedData.dateOfBirth,
      ),
      gender: this.compareGender(
        digilockerData.gender,
        userProvidedData.gender,
      ),
      state: this.compareState(
        digilockerData.split_address?.state,
        userProvidedData.state,
      ),
      pincode: this.comparePincode(
        digilockerData.split_address?.pincode,
        userProvidedData.pincode,
      ),
    };

    const matchedFields = Object.keys(details).filter((key) => details[key]);
    const mismatchedFields = Object.keys(details).filter(
      (key) => !details[key],
    );

    const isMatch = Object.values(details).every((v) => v === true);

    return {
      isMatch,
      matchedFields,
      mismatchedFields,
    };
  }

  private compareName(digilocker: string, userProvided: string): boolean {
    const normalize = (s: string) =>
      s.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    return normalize(digilocker) === normalize(userProvided);
  }

  private compareDate(digilocker: string, userProvided: string): boolean {
    try {
      const [day, month, year] = digilocker.split('-');
      const isoDate = `${year}-${month}-${day}`;
      return isoDate === userProvided;
    } catch {
      return false;
    }
  }

  private compareGender(digilocker: string, userProvided: string): boolean {
    const normalize = (g: string) => {
      const x = g.toLowerCase().trim();
      if (x === 'm' || x === 'male') return 'male';
      if (x === 'f' || x === 'female') return 'female';
      if (x === 't' || x === 'other') return 'other';
      return x;
    };
    return normalize(digilocker) === normalize(userProvided);
  }

  private compareState(digilocker: string, userProvided: string): boolean {
    const normalize = (s: string) =>
      s.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, '');
    return normalize(digilocker) === normalize(userProvided);
  }

  private comparePincode(digilocker: string, userProvided: string): boolean {
    return digilocker?.trim() === userProvided?.trim();
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.digiLockerVerificationSession.deleteMany({
      where: {
        createdAt: {
          lte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired verification sessions`);
    return { deletedCount: result.count };
  }
}
