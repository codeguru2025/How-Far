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
import { RoutesService } from './routes.service';
import { CreateRouteDto, UpdateRouteDto, NearbyRoutesDto } from './dto/route.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new route (Driver)' })
  @ApiResponse({ status: 201, description: 'Route created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRouteDto,
  ) {
    return this.routesService.create(userId, dto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active routes' })
  @ApiResponse({ status: 200, description: 'Active routes list' })
  async getActiveRoutes() {
    return this.routesService.findActiveRoutes();
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby active routes' })
  @ApiResponse({ status: 200, description: 'Nearby routes list' })
  async getNearbyRoutes(@Query() dto: NearbyRoutesDto) {
    return this.routesService.findNearbyRoutes(dto);
  }

  @Get('my-routes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my routes (Driver)' })
  @ApiResponse({ status: 200, description: 'Routes list' })
  async getMyRoutes(@CurrentUser('id') userId: string) {
    return this.routesService.findByDriver(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get route by ID' })
  @ApiResponse({ status: 200, description: 'Route found' })
  async getRoute(@Param('id') id: string) {
    return this.routesService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update route (Driver)' })
  @ApiResponse({ status: 200, description: 'Route updated' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.routesService.update(userId, id, dto);
  }

  @Put(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle route active status (Driver)' })
  @ApiResponse({ status: 200, description: 'Route status toggled' })
  async toggleActive(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.routesService.toggleActive(userId, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete route (Driver)' })
  @ApiResponse({ status: 200, description: 'Route deleted' })
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.routesService.delete(userId, id);
  }
}
