import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DigiLockerVerificationController } from './digilocker.controller';
import { DigiLockerVerificationService } from './services/digilocker-verification.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [DigiLockerVerificationController],
  providers: [DigiLockerVerificationService, PrismaService],
  exports: [DigiLockerVerificationService],
})
export class DigiLockerModule {}
