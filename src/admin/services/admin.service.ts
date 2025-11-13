import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Verify that user has admin access
   */
  async verifyAdminAccess(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have admin access');
    }
  }

  /**
   * Get all users pending admin approval
   */
  async getPendingUsers(): Promise<any[]> {
    const pendingUsers = await this.prisma.user.findMany({
      where: { status: 'VIDEO_VERIFIED' },
      include: {
        verification: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    return pendingUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      country: user.country,
      submittedAt: user.updatedAt,
      verification: {
        method: user.verification?.method,
        verifiedData: user.verification?.verifiedData,
        frameUrl: user.verification?.frameUrl,
        videoUrl: user.verification?.videoUrl,
      },
    }));
  }

  /**
   * Get full details of a specific user
   */
  async getUserDetails(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        verification: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
      country: user.country,
      status: user.status,
      profilePicUrl: user.profilePicUrl,
      bio: user.bio,
      createdAt: user.createdAt,
      verification: user.verification
        ? {
            method: user.verification.method,
            verifiedData: user.verification.verifiedData,
            videoUrl: user.verification.videoUrl,
            frameUrl: user.verification.frameUrl,
            verificationStatus: user.verification.verificationStatus,
            verifiedAt: user.verification.verifiedAt,
          }
        : null,
      subscription: user.subscription
        ? {
            planName: user.subscription.planName,
            planType: user.subscription.planType,
            status: user.subscription.status,
          }
        : null,
    };
  }

  /**
   * Approve user - move to APPROVED status
   */
  async approveUser(userId: string, notes?: string): Promise<{
    message: string;
    userId: string;
    status: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status !== 'VIDEO_VERIFIED') {
      throw new BadRequestException(
        `Cannot approve user with status ${user.status}. Must be VIDEO_VERIFIED.`,
      );
    }

    // Update user status to APPROVED
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'APPROVED' },
    });

    // TODO: Send approval email to user
    // await this.emailService.sendApprovalEmail(user.email);

    return {
      message: 'User approved successfully',
      userId: updatedUser.id,
      status: updatedUser.status,
    };
  }

  /**
   * Reject user - revert to REGISTERED status
   */
  async rejectUser(userId: string, reason: string): Promise<{
    message: string;
    userId: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status !== 'VIDEO_VERIFIED') {
      throw new BadRequestException(
        `Cannot reject user with status ${user.status}. Must be VIDEO_VERIFIED.`,
      );
    }

    // Update verification status to REJECTED with reason
    await this.prisma.userVerification.update({
      where: { userId },
      data: {
        verificationStatus: 'REJECTED',
        rejectionReason: reason,
      },
    });

    // Revert user status to REGISTERED so they can reapply
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'REGISTERED' },
    });

    // TODO: Send rejection email to user with reason
    // await this.emailService.sendRejectionEmail(user.email, reason);

    return {
      message: 'User rejected and can reapply after fixing issues',
      userId,
    };
  }

  /**
   * Get admin dashboard statistics
   */
  async getDashboardStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    pendingApproval: number;
    rejectedUsers: number;
    totalRevenue: number;
    conversionRates: Record<string, string>;
  }> {
    this.logger.log('[getDashboardStats] Fetching dashboard statistics');
    const startTime = Date.now();

    const totalUsers = await this.prisma.user.count();
    const activeUsers = await this.prisma.user.count({
      where: { status: 'ACTIVE' },
    });
    const pendingApproval = await this.prisma.user.count({
      where: { status: 'VIDEO_VERIFIED' },
    });
    const rejectedUsers = await this.prisma.userVerification.count({
      where: { verificationStatus: 'REJECTED' },
    });

    // Calculate conversion rates
    const emailVerified = await this.prisma.user.count({
      where: { status: { not: 'REGISTERED' } },
    });
    const idVerified = await this.prisma.user.count({
      where: { status: { in: ['ID_VERIFIED', 'VIDEO_VERIFIED', 'APPROVED', 'ACTIVE'] } },
    });
    const videoVerified = await this.prisma.user.count({
      where: { status: { in: ['VIDEO_VERIFIED', 'APPROVED', 'ACTIVE'] } },
    });
    const approved = await this.prisma.user.count({
      where: { status: { in: ['APPROVED', 'ACTIVE'] } },
    });

    const conversionRates = {
      emailVerification: totalUsers > 0 ? ((emailVerified / totalUsers) * 100).toFixed(2) : '0',
      idVerification: emailVerified > 0 ? ((idVerified / emailVerified) * 100).toFixed(2) : '0',
      videoVerification: idVerified > 0 ? ((videoVerified / idVerified) * 100).toFixed(2) : '0',
      adminApproval: videoVerified > 0 ? ((approved / videoVerified) * 100).toFixed(2) : '0',
      finalActivation: approved > 0 ? ((activeUsers / approved) * 100).toFixed(2) : '0',
    };

    // Calculate total revenue from active subscriptions
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
    });
    const totalRevenue = subscriptions.reduce((sum, sub) => {
      // Extract price from plan name or use default values
      const priceMap: Record<string, number> = {
        Pro: 9.99,
        Premium: 19.99,
        Startup: 49.99,
        Enterprise: 199.99,
      };
      return sum + (priceMap[sub.planName] || 0);
    }, 0);

    const duration = Date.now() - startTime;
    this.logger.log(`[getDashboardStats] Statistics fetched in ${duration}ms`, {
      totalUsers,
      activeUsers,
      pendingApproval,
      rejectedUsers,
      totalRevenue,
      conversionRates,
      duration,
    });

    return {
      totalUsers,
      activeUsers,
      pendingApproval,
      rejectedUsers,
      totalRevenue,
      conversionRates,
    };
  }
}
