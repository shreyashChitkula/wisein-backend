import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { DigiLockerModule } from './digilocker/digilocker.module';
import { VideoVerificationModule } from './video-verification/video-verification.module';
import { StripeVerificationModule } from './stripe-verification/stripe-verification.module';
import { PrismaService } from './prisma/prisma.service';
import { LoggingInterceptor } from './common/interceptors';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [AuthModule, AdminModule, DigiLockerModule, VideoVerificationModule, StripeVerificationModule, PaymentModule],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
