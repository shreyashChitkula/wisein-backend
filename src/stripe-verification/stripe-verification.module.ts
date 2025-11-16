import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { StripeVerificationController } from './stripe-verification.controller';
import { StripeVerificationService } from './services/stripe-verification.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [StripeVerificationController],
  providers: [StripeVerificationService, PrismaService],
  exports: [StripeVerificationService],
})
export class StripeVerificationModule {}

