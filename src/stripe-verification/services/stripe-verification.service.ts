import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Optional Stripe import - will be null if package is not installed
let Stripe: any = null;
try {
  Stripe = require('stripe');
} catch (e) {
  // Stripe package not installed - will use placeholder mode
}

/**
 * Stripe Verification Service
 * Handles Stripe Identity verification for non-Indian users
 * This is an alternative to DigiLocker for international users
 */
@Injectable()
export class StripeVerificationService {
  private readonly logger = new Logger(StripeVerificationService.name);
  private stripe: any = null;

  constructor(private readonly prisma: PrismaService) {
    // Initialize Stripe client if API key is available and package is installed
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey && Stripe) {
      try {
        this.stripe = new Stripe(stripeSecretKey, {
          apiVersion: '2023-10-16',
        });
        this.logger.log('Stripe client initialized');
      } catch (error) {
        this.logger.warn(`Failed to initialize Stripe: ${error.message}`);
      }
    } else {
      if (!stripeSecretKey) {
        this.logger.warn('STRIPE_SECRET_KEY not found. Stripe verification will use placeholder mode.');
      }
      if (!Stripe) {
        this.logger.warn('stripe package not installed. Install with: npm install stripe. Stripe verification will use placeholder mode.');
      }
    }
  }

  /**
   * Create Stripe Identity verification session
   * Generates a verification session URL for the user to complete identity verification
   */
  async createStripeIdentitySession(
    userId: string,
  ): Promise<{
    success: boolean;
    verificationSessionId: string;
    url: string;
    clientSecret?: string;
  }> {
    this.logger.log(`Creating Stripe Identity session for user: ${userId}`);

    try {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prevent Stripe Identity flow for Indian users
      if (user.country && String(user.country).toLowerCase() === 'india') {
        throw new BadRequestException(
          'Stripe Identity verification is not available for users in India. Please use DigiLocker verification instead.',
        );
      }

      // Check if user already has verified identity
      const existingVerification = await this.prisma.userVerification.findUnique({
        where: { userId },
      });

      if (existingVerification?.verificationStatus === 'VERIFIED') {
        this.logger.log(`User ${userId} already has verified identity`);
        return {
          success: true,
          verificationSessionId: 'already_verified',
          url: '',
        };
      }

      // Create Stripe Identity verification session
      if (this.stripe) {
        try {
          const session = await this.stripe.identity.verificationSessions.create({
            type: 'document',
            metadata: {
              userId,
              email: user.email,
            },
          });

          this.logger.log(`Stripe Identity session created: ${session.id}`);

          return {
            success: true,
            verificationSessionId: session.id,
            url: session.url || '',
            clientSecret: session.client_secret || undefined,
          };
        } catch (stripeError) {
          this.logger.error(`Stripe API error: ${stripeError.message}`);
          throw new InternalServerErrorException(
            `Failed to create Stripe verification session: ${stripeError.message}`,
          );
        }
      } else {
        // Placeholder mode for development/testing
        this.logger.warn('Using placeholder Stripe session (STRIPE_SECRET_KEY not configured)');
        const placeholderSessionId = `vs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
          success: true,
          verificationSessionId: placeholderSessionId,
          url: `https://verify.stripe.com/start/${placeholderSessionId}`,
        };
      }
    } catch (error) {
      this.logger.error(`Error creating Stripe session: ${error.message}`);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create verification session');
    }
  }

  /**
   * Verify Stripe Identity session result
   * Checks the status of a Stripe Identity verification session and updates user verification
   */
  async verifyStripeIdentitySession(
    userId: string,
    verificationSessionId: string,
  ): Promise<{
    success: boolean;
    message: string;
    verificationStatus: string;
    verifiedData?: any;
  }> {
    this.logger.log(
      `Verifying Stripe Identity session for user: ${userId}, session: ${verificationSessionId}`,
    );

    try {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prevent Stripe Identity flow for Indian users
      if (user.country && String(user.country).toLowerCase() === 'india') {
        throw new BadRequestException(
          'Stripe Identity verification is not available for users in India. Please use DigiLocker verification instead.',
        );
      }

      // Handle already verified case
      if (verificationSessionId === 'already_verified') {
        const existingVerification = await this.prisma.userVerification.findUnique({
          where: { userId },
        });

        if (existingVerification?.verificationStatus === 'VERIFIED') {
          return {
            success: true,
            message: 'Identity already verified',
            verificationStatus: 'VERIFIED',
            verifiedData: existingVerification.verifiedData,
          };
        }
      }

      // Verify with Stripe API
      if (this.stripe) {
        try {
          const session = await this.stripe.identity.verificationSessions.retrieve(
            verificationSessionId,
          );

          if (session.status === 'verified') {
            // Extract verified data from Stripe session
            const verifiedData = {
              name: session.verified_outputs?.name?.first_name
                ? `${session.verified_outputs.name.first_name} ${session.verified_outputs.name.last_name || ''}`.trim()
                : null,
              dateOfBirth: session.verified_outputs?.dob
                ? `${session.verified_outputs.dob.year}-${String(session.verified_outputs.dob.month).padStart(2, '0')}-${String(session.verified_outputs.dob.day).padStart(2, '0')}`
                : null,
              documentType: session.type || 'unknown',
              documentNumber: session.verified_outputs?.id_number || null,
              gender: session.verified_outputs?.sex || null,
              address: session.verified_outputs?.address
                ? `${session.verified_outputs.address.line1 || ''} ${session.verified_outputs.address.city || ''} ${session.verified_outputs.address.state || ''} ${session.verified_outputs.address.postal_code || ''} ${session.verified_outputs.address.country || ''}`.trim()
                : null,
              country: session.verified_outputs?.address?.country || user.country,
              state: session.verified_outputs?.address?.state || null,
              pincode: session.verified_outputs?.address?.postal_code || null,
              addressLine1: session.verified_outputs?.address?.line1 || null,
              addressLine2: session.verified_outputs?.address?.line2 || null,
            };

            // Create or update verification record
            const verification = await this.prisma.userVerification.upsert({
              where: { userId },
              update: {
                method: 'STRIPE_IDENTITY',
                verifiedData: verifiedData,
                verificationStatus: 'VERIFIED',
                verified: true,
                verifiedAt: new Date(),
              },
              create: {
                userId,
                method: 'STRIPE_IDENTITY',
                verifiedData: verifiedData,
                verificationStatus: 'VERIFIED',
                verified: true,
                verifiedAt: new Date(),
              },
            });

            // Update user status to ID_VERIFIED
            await this.prisma.user.update({
              where: { id: userId },
              data: { status: 'ID_VERIFIED' },
            });

            this.logger.log(`Stripe Identity verification successful for user: ${userId}`);

            return {
              success: true,
              message: 'Stripe Identity verification successful',
              verificationStatus: 'VERIFIED',
              verifiedData: verification.verifiedData,
            };
          } else if (session.status === 'processing') {
            return {
              success: false,
              message: 'Verification is still processing. Please check again later.',
              verificationStatus: 'PENDING',
            };
          } else if (session.status === 'requires_input') {
            return {
              success: false,
              message: 'Additional information required. Please complete the verification process.',
              verificationStatus: 'PENDING',
            };
          } else {
            // Session failed or was canceled
            return {
              success: false,
              message: `Verification ${session.status}. Please try again.`,
              verificationStatus: 'REJECTED',
            };
          }
        } catch (stripeError) {
          this.logger.error(`Stripe API error: ${stripeError.message}`);
          throw new InternalServerErrorException(
            `Failed to verify Stripe session: ${stripeError.message}`,
          );
        }
      } else {
        // Placeholder mode for development/testing
        this.logger.warn('Using placeholder Stripe verification (STRIPE_SECRET_KEY not configured)');
        
        const placeholderData = {
          name: user.name || 'Placeholder Name',
          dateOfBirth: user.dateOfBirth?.toISOString().split('T')[0] || '1990-01-01',
          documentType: 'Passport',
          documentNumber: 'PLACEHOLDER123',
          gender: null,
          address: 'Placeholder Address',
          country: user.country || 'USA',
          state: null,
          pincode: null,
          addressLine1: null,
          addressLine2: null,
        };

        // Create or update verification record
        const verification = await this.prisma.userVerification.upsert({
          where: { userId },
          update: {
            method: 'STRIPE_IDENTITY',
            verifiedData: placeholderData,
            verificationStatus: 'VERIFIED',
            verified: true,
            verifiedAt: new Date(),
          },
          create: {
            userId,
            method: 'STRIPE_IDENTITY',
            verifiedData: placeholderData,
            verificationStatus: 'VERIFIED',
            verified: true,
            verifiedAt: new Date(),
          },
        });

        // Update user status to ID_VERIFIED
        await this.prisma.user.update({
          where: { id: userId },
          data: { status: 'ID_VERIFIED' },
        });

        this.logger.warn(`Placeholder verification completed for user: ${userId}`);

        return {
          success: true,
          message: 'Stripe Identity verification successful (placeholder mode)',
          verificationStatus: 'VERIFIED',
          verifiedData: verification.verifiedData,
        };
      }
    } catch (error) {
      this.logger.error(`Error verifying Stripe session: ${error.message}`);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to verify identity session');
    }
  }

  /**
   * Get Stripe verification status for a user
   */
  async getStripeVerificationStatus(userId: string): Promise<{
    success: boolean;
    verified: boolean;
    status: string;
    method: string | null;
    verifiedData: any;
    verifiedAt: Date | null;
  }> {
    this.logger.log(`Getting Stripe verification status for user: ${userId}`);

    try {
      const verification = await this.prisma.userVerification.findUnique({
        where: { userId },
      });

      if (!verification || verification.method !== 'STRIPE_IDENTITY') {
        return {
          success: true,
          verified: false,
          status: 'NOT_STARTED',
          method: null,
          verifiedData: null,
          verifiedAt: null,
        };
      }

      return {
        success: true,
        verified: verification.verified || false,
        status: verification.verificationStatus || 'PENDING',
        method: verification.method,
        verifiedData: verification.verifiedData,
        verifiedAt: verification.verifiedAt,
      };
    } catch (error) {
      this.logger.error(`Error getting verification status: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch verification status');
    }
  }
}

