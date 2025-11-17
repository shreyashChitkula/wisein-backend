import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../shared/mail/mail.service';

@Module({
  providers: [PaymentService, PrismaService, MailService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
