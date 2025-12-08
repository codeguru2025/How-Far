import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('analytics/routes')
  @ApiOperation({ summary: 'Get route analytics' })
  @ApiResponse({ status: 200, description: 'Route analytics' })
  async getRouteAnalytics() {
    return this.adminService.getRouteAnalytics();
  }

  @Get('config')
  @ApiOperation({ summary: 'Get system configuration' })
  @ApiResponse({ status: 200, description: 'System config' })
  async getSystemConfig() {
    return this.adminService.getSystemConfig();
  }

  @Put('config/:key')
  @ApiOperation({ summary: 'Update system configuration' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  async updateConfig(
    @CurrentUser('id') adminId: string,
    @Param('key') key: string,
    @Body('value') value: any,
  ) {
    return this.adminService.updateSystemConfig(key, value, adminId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get admin action logs' })
  @ApiResponse({ status: 200, description: 'Action logs' })
  async getActionLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getActionLogs(page, limit);
  }

  @Post('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend user' })
  @ApiResponse({ status: 200, description: 'User suspended' })
  async suspendUser(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.suspendUser(adminId, userId, reason);
  }

  @Post('users/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate user' })
  @ApiResponse({ status: 200, description: 'User reactivated' })
  async reactivateUser(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
  ) {
    return this.adminService.reactivateUser(adminId, userId);
  }
}
