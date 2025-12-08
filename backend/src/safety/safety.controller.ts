import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import {
  CreateSafetyReportDto,
  TriggerSosDto,
  ResolveReportDto,
  SafetyFilterDto,
} from './dto/safety.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('safety')
@Controller('safety')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('report')
  @ApiOperation({ summary: 'Create a safety report' })
  @ApiResponse({ status: 201, description: 'Report created' })
  async createReport(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSafetyReportDto,
  ) {
    return this.safetyService.createReport(userId, dto);
  }

  @Post('sos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger SOS emergency alert' })
  @ApiResponse({ status: 200, description: 'SOS triggered' })
  async triggerSos(
    @CurrentUser('id') userId: string,
    @Body() dto: TriggerSosDto,
  ) {
    return this.safetyService.triggerSos(userId, dto);
  }

  @Get('my-reports')
  @ApiOperation({ summary: 'Get my safety reports' })
  @ApiResponse({ status: 200, description: 'Reports list' })
  async getMyReports(@CurrentUser('id') userId: string) {
    return this.safetyService.getMyReports(userId);
  }

  @Get('score')
  @ApiOperation({ summary: 'Get my safety score' })
  @ApiResponse({ status: 200, description: 'Safety score' })
  async getMySafetyScore(@CurrentUser('id') userId: string) {
    return this.safetyService.getUserSafetyScore(userId);
  }

  @Get('score/:userId')
  @ApiOperation({ summary: 'Get user safety score' })
  @ApiResponse({ status: 200, description: 'Safety score' })
  async getUserSafetyScore(@Param('userId') userId: string) {
    return this.safetyService.getUserSafetyScore(userId);
  }

  // Admin endpoints
  @Get('reports')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List all safety reports (Admin)' })
  @ApiResponse({ status: 200, description: 'Reports list' })
  async listReports(
    @Query() filter: SafetyFilterDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.safetyService.listReports(filter, page, limit);
  }

  @Get('sos/active')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get active SOS alerts (Admin)' })
  @ApiResponse({ status: 200, description: 'Active alerts' })
  async getActiveSosAlerts() {
    return this.safetyService.getActiveSosAlerts();
  }

  @Put('reports/:id/resolve')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Resolve safety report (Admin)' })
  @ApiResponse({ status: 200, description: 'Report resolved' })
  async resolveReport(
    @CurrentUser('id') adminId: string,
    @Param('id') reportId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.safetyService.resolveReport(reportId, adminId, dto);
  }

  @Put('sos/:id/resolve')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Resolve SOS alert (Admin)' })
  @ApiResponse({ status: 200, description: 'SOS resolved' })
  async resolveSos(
    @CurrentUser('id') adminId: string,
    @Param('id') alertId: string,
  ) {
    return this.safetyService.resolveSos(alertId, adminId);
  }
}
