import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { VehiclesService } from './vehicles.service';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleFilterDto,
  VerifyVehicleDto,
} from './dto/vehicle.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('vehicles')
@Controller('vehicles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Register a new vehicle' })
  @ApiResponse({ status: 201, description: 'Vehicle created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.create(userId, dto);
  }

  @Get('my-vehicles')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get all my vehicles' })
  @ApiResponse({ status: 200, description: 'Vehicles list' })
  async getMyVehicles(@CurrentUser('id') userId: string) {
    return this.vehiclesService.findByDriver(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle found' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async getVehicle(@Param('id') id: string) {
    return this.vehiclesService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update vehicle' })
  @ApiResponse({ status: 200, description: 'Vehicle updated' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(userId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.DRIVER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete vehicle' })
  @ApiResponse({ status: 200, description: 'Vehicle deleted' })
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.vehiclesService.delete(userId, id);
  }

  // Admin endpoints
  @Get()
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List all vehicles (Admin)' })
  @ApiResponse({ status: 200, description: 'Vehicles list' })
  async listVehicles(@Query() filter: VehicleFilterDto) {
    return this.vehiclesService.listVehicles(filter);
  }

  @Put(':id/verify')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Verify vehicle (Admin)' })
  @ApiResponse({ status: 200, description: 'Vehicle verification updated' })
  async verifyVehicle(@Param('id') id: string, @Body() dto: VerifyVehicleDto) {
    return this.vehiclesService.verifyVehicle(id, dto.status);
  }
}
