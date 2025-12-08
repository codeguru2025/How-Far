import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRouteDto, UpdateRouteDto, NearbyRoutesDto } from './dto/route.dto';

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new route
   */
  async create(userId: string, dto: CreateRouteDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.prisma.route.create({
      data: {
        driverId: driver.id,
        name: dto.name || `${dto.originName} - ${dto.destinationName}`,
        originName: dto.originName,
        originLat: dto.originLat,
        originLng: dto.originLng,
        destinationName: dto.destinationName,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
        polyline: dto.polyline,
        waypoints: dto.waypoints || [],
        distance: dto.distance,
        duration: dto.duration,
        baseFare: dto.baseFare || 1.0,
      },
      include: {
        driver: {
          include: {
            user: {
              select: { id: true, name: true, profilePic: true },
            },
            activeVehicle: true,
          },
        },
      },
    });
  }

  /**
   * Get route by ID
   */
  async findById(id: string) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, profilePic: true },
            },
            activeVehicle: true,
            liveLocation: true,
          },
        },
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return route;
  }

  /**
   * Get all routes for a driver
   */
  async findByDriver(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.prisma.route.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get active routes
   */
  async findActiveRoutes() {
    return this.prisma.route.findMany({
      where: {
        isActive: true,
        driver: {
          status: 'ONLINE',
        },
      },
      include: {
        driver: {
          include: {
            user: {
              select: { id: true, name: true, profilePic: true },
            },
            activeVehicle: true,
            liveLocation: true,
          },
        },
      },
    });
  }

  /**
   * Get nearby active routes
   */
  async findNearbyRoutes(dto: NearbyRoutesDto) {
    const radius = dto.radius || 5; // Default 5km

    const routes = await this.prisma.route.findMany({
      where: {
        isActive: true,
        driver: {
          status: 'ONLINE',
        },
      },
      include: {
        driver: {
          include: {
            user: {
              select: { id: true, name: true, profilePic: true, rating: false },
            },
            activeVehicle: true,
            liveLocation: true,
          },
        },
      },
    });

    // Filter routes where origin or driver location is within radius
    return routes.filter((route) => {
      const originDist = this.calculateDistance(
        dto.lat, dto.lng,
        route.originLat, route.originLng,
      );

      const driverDist = route.driver.liveLocation
        ? this.calculateDistance(
            dto.lat, dto.lng,
            route.driver.liveLocation.lat,
            route.driver.liveLocation.lng,
          )
        : Infinity;

      return originDist <= radius || driverDist <= radius;
    }).map((route) => ({
      ...route,
      distance: route.driver.liveLocation
        ? this.calculateDistance(
            dto.lat, dto.lng,
            route.driver.liveLocation.lat,
            route.driver.liveLocation.lng,
          )
        : null,
    }));
  }

  /**
   * Update route
   */
  async update(userId: string, routeId: string, dto: UpdateRouteDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.driverId !== driver.id) {
      throw new ForbiddenException('You can only update your own routes');
    }

    return this.prisma.route.update({
      where: { id: routeId },
      data: dto,
    });
  }

  /**
   * Delete route
   */
  async delete(userId: string, routeId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.driverId !== driver.id) {
      throw new ForbiddenException('You can only delete your own routes');
    }

    await this.prisma.route.delete({
      where: { id: routeId },
    });

    return { message: 'Route deleted successfully' };
  }

  /**
   * Toggle route active status
   */
  async toggleActive(userId: string, routeId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.driverId !== driver.id) {
      throw new ForbiddenException('You can only update your own routes');
    }

    return this.prisma.route.update({
      where: { id: routeId },
      data: { isActive: !route.isActive },
    });
  }

  /**
   * Calculate distance using Haversine formula
   */
  private calculateDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
