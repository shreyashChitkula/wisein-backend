import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { VideoVerificationController } from './video-verification.controller';
import { VideoVerificationService } from './services/video-verification.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [VideoVerificationController],
  providers: [VideoVerificationService, PrismaService],
  exports: [VideoVerificationService],
})
export class VideoVerificationModule {}
