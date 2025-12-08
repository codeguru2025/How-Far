import {
  Controller,
  Get,
  Put,
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
import { SettlementsService } from './settlements.service';
import { SettlementFilterDto, ProcessSettlementDto } from './dto/settlement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('settlements')
@Controller('settlements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get('driver')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get my settlements (Driver)' })
  @ApiResponse({ status: 200, description: 'Settlements list' })
  async getDriverSettlements(
    @CurrentUser('id') userId: string,
    @Query() filter: SettlementFilterDto,
  ) {
    return this.settlementsService.getDriverSettlements(userId, filter);
  }

  @Get('summary')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get settlement summary (Driver)' })
  @ApiResponse({ status: 200, description: 'Summary retrieved' })
  async getDriverSummary(@CurrentUser('id') userId: string) {
    return this.settlementsService.getDriverSummary(userId);
  }

  // Admin endpoints
  @Get()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List all settlements (Admin)' })
  @ApiResponse({ status: 200, description: 'Settlements list' })
  async listSettlements(
    @Query() filter: SettlementFilterDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.settlementsService.listSettlements(filter, page, limit);
  }

  @Put(':id/process')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Process settlement (Admin)' })
  @ApiResponse({ status: 200, description: 'Settlement processed' })
  async processSettlement(
    @Param('id') id: string,
    @Body() dto: ProcessSettlementDto,
  ) {
    return this.settlementsService.processSettlement(id, dto);
  }
}
