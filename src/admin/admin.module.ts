import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './services/admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../shared/mail/mail.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService, MailService],
  exports: [AdminService],
})
export class AdminModule {}
