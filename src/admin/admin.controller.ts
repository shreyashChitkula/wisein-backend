import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private adminService: AdminService) {}

  /**
   * GET /admin/users/pending
   * Get all users pending admin approval
   */
  @Get('users/pending')
  async getPendingUsers(
    @Req() req,
  ) {
    this.logger.log(`[getPendingUsers] Admin ${req.user.id} fetching pending users`);
    try {
      // Verify user is admin
      await this.adminService.verifyAdminAccess(req.user.id);
      const users = await this.adminService.getPendingUsers();
      this.logger.log(`[getPendingUsers] Fetched ${users.length} pending users`);
      return users;
    } catch (error) {
      this.logger.error(`[getPendingUsers] Failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * GET /admin/users/:id
   * Get specific user's full verification details
   */
  @Get('users/:id')
  async getUserDetails(
    @Req() req,
    @Param('id') userId: string,
  ) {
    // Verify user is admin
    await this.adminService.verifyAdminAccess(req.user.id);
    return this.adminService.getUserDetails(userId);
  }

  /**
   * POST /admin/users/:id/approve
   * Approve user and move to APPROVED status
   */
  @Post('users/:id/approve')
  async approveUser(
    @Req() req,
    @Param('id') userId: string,
    @Body() body: { notes?: string },
  ) {
    // Verify user is admin
    await this.adminService.verifyAdminAccess(req.user.id);
    return this.adminService.approveUser(userId, body.notes);
  }

  /**
   * POST /admin/users/:id/reject
   * Reject user with reason
   */
  @Post('users/:id/reject')
  async rejectUser(
    @Req() req,
    @Param('id') userId: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason) {
      throw new BadRequestException('Rejection reason is required');
    }
    // Verify user is admin
    await this.adminService.verifyAdminAccess(req.user.id);
    return this.adminService.rejectUser(userId, body.reason);
  }

  /**
   * GET /admin/dashboard/stats
   * Get dashboard statistics
   */
  @Get('dashboard/stats')
  async getDashboardStats(
    @Req() req,
  ) {
    this.logger.log(`[getDashboardStats] Admin ${req.user.id} requesting dashboard stats`);
    try {
      // Verify user is admin
      await this.adminService.verifyAdminAccess(req.user.id);
      const stats = await this.adminService.getDashboardStats();
      this.logger.log(`[getDashboardStats] Dashboard stats retrieved successfully`);
      return stats;
    } catch (error) {
      this.logger.error(`[getDashboardStats] Failed: ${error.message}`);
      throw error;
    }
  }
}
