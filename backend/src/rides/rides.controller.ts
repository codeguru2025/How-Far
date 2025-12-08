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
import { RidesService } from './rides.service';
import {
  RequestRideDto,
  UpdateRideStatusDto,
  RateRideDto,
  ShareTripDto,
  RideFilterDto,
} from './dto/ride.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('rides')
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post('request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a ride (Passenger)' })
  @ApiResponse({ status: 201, description: 'Ride requested' })
  async requestRide(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestRideDto,
  ) {
    return this.ridesService.requestRide(userId, dto);
  }

  @Put(':id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept or reject ride (Driver)' })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  async respondToRide(
    @CurrentUser('id') userId: string,
    @Param('id') rideId: string,
    @Body('accept') accept: boolean,
  ) {
    return this.ridesService.respondToRide(userId, rideId, accept);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update ride status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') rideId: string,
    @Body() dto: UpdateRideStatusDto,
  ) {
    return this.ridesService.updateStatus(userId, rideId, dto);
  }

  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate a completed ride' })
  @ApiResponse({ status: 200, description: 'Rating submitted' })
  async rateRide(
    @CurrentUser('id') userId: string,
    @Param('id') rideId: string,
    @Body() dto: RateRideDto,
  ) {
    return this.ridesService.rateRide(userId, rideId, dto);
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share trip with family (Passenger)' })
  @ApiResponse({ status: 200, description: 'Share link generated' })
  async shareTrip(
    @CurrentUser('id') userId: string,
    @Param('id') rideId: string,
  ) {
    return this.ridesService.shareTrip(userId, rideId);
  }

  @Get('shared/:shareCode')
  @ApiOperation({ summary: 'View shared trip (Public)' })
  @ApiResponse({ status: 200, description: 'Trip details' })
  async viewSharedTrip(@Param('shareCode') shareCode: string) {
    return this.ridesService.viewSharedTrip(shareCode);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current active ride' })
  @ApiResponse({ status: 200, description: 'Active ride or null' })
  async getActiveRide(@CurrentUser('id') userId: string) {
    return this.ridesService.getActiveRide(userId);
  }

  @Get('passenger')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get passenger ride history' })
  @ApiResponse({ status: 200, description: 'Rides list' })
  async getPassengerRides(
    @CurrentUser('id') userId: string,
    @Query() filter: RideFilterDto,
  ) {
    return this.ridesService.getPassengerRides(userId, filter);
  }

  @Get('driver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get driver ride history' })
  @ApiResponse({ status: 200, description: 'Rides list' })
  async getDriverRides(
    @CurrentUser('id') userId: string,
    @Query() filter: RideFilterDto,
  ) {
    return this.ridesService.getDriverRides(userId, filter);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ride by ID' })
  @ApiResponse({ status: 200, description: 'Ride found' })
  async getRide(@Param('id') id: string) {
    return this.ridesService.findById(id);
  }
}
