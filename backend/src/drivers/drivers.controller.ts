import {
  Controller,
  Get,
  Post,
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
import { DriversService } from './drivers.service';
import {
  CreateDriverProfileDto,
  UpdateDriverProfileDto,
  UpdateDriverStatusDto,
  SetActiveVehicleDto,
  UpdateLocationDto,
  NearbyDriversDto,
  DriverFilterDto,
} from './dto/driver.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, VerificationStatus } from '@prisma/client';

@ApiTags('drivers')
@Controller('drivers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Create driver profile' })
  @ApiResponse({ status: 201, description: 'Driver profile created' })
  async createProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDriverProfileDto,
  ) {
    return this.driversService.createProfile(userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current driver profile' })
  @ApiResponse({ status: 200, description: 'Driver profile retrieved' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.driversService.getByUserId(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update driver profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.driversService.updateProfile(userId, dto);
  }

  @Put('status')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update driver status (online/offline)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDriverStatusDto,
  ) {
    return this.driversService.updateStatus(userId, dto.status);
  }

  @Put('active-vehicle')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Set active vehicle' })
  @ApiResponse({ status: 200, description: 'Active vehicle set' })
  async setActiveVehicle(
    @CurrentUser('id') userId: string,
    @Body() dto: SetActiveVehicleDto,
  ) {
    return this.driversService.setActiveVehicle(userId, dto.vehicleId);
  }

  @Put('location')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update live location' })
  @ApiResponse({ status: 200, description: 'Location updated' })
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driversService.updateLocation(userId, dto);
  }

  @Get('statistics')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get driver statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStatistics(@CurrentUser('id') userId: string) {
    return this.driversService.getStatistics(userId);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby online drivers' })
  @ApiResponse({ status: 200, description: 'Nearby drivers list' })
  async getNearbyDrivers(@Query() dto: NearbyDriversDto) {
    return this.driversService.getNearbyDrivers(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get driver by ID' })
  @ApiResponse({ status: 200, description: 'Driver found' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async getDriver(@Param('id') id: string) {
    return this.driversService.getProfile(id);
  }

  // Admin endpoints
  @Get()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List all drivers (Admin)' })
  @ApiResponse({ status: 200, description: 'Drivers list' })
  async listDrivers(@Query() filter: DriverFilterDto) {
    return this.driversService.listDrivers(filter);
  }

  @Put(':id/verify')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Verify driver (Admin)' })
  @ApiResponse({ status: 200, description: 'Driver verification updated' })
  async verifyDriver(
    @Param('id') id: string,
    @Body('status') status: VerificationStatus,
  ) {
    return this.driversService.verifyDriver(id, status);
  }
}
