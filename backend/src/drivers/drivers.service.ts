import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateDriverProfileDto,
  UpdateDriverProfileDto,
  UpdateLocationDto,
  NearbyDriversDto,
  DriverFilterDto,
} from './dto/driver.dto';
import { DriverStatus, VerificationStatus, UserRole } from '@prisma/client';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create driver profile
   */
  async createProfile(userId: string, dto: CreateDriverProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.driver) {
      throw new BadRequestException('Driver profile already exists');
    }

    // Check licence number uniqueness
    const existingLicence = await this.prisma.driver.findUnique({
      where: { licenceNumber: dto.licenceNumber },
    });

    if (existingLicence) {
      throw new BadRequestException('Licence number already registered');
    }

    // Update user role to DRIVER
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.DRIVER },
    });

    return this.prisma.driver.create({
      data: {
        userId,
        licenceNumber: dto.licenceNumber,
        licenceImage: dto.licenceImage,
        licenceExpiryDate: dto.licenceExpiryDate
          ? new Date(dto.licenceExpiryDate)
          : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            profilePic: true,
          },
        },
      },
    });
  }

  /**
   * Get driver profile
   */
  async getProfile(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profilePic: true,
            isVerified: true,
          },
        },
        vehicles: true,
        activeVehicle: true,
        liveLocation: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  /**
   * Get driver by user ID
   */
  async getByUserId(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profilePic: true,
            isVerified: true,
          },
        },
        vehicles: true,
        activeVehicle: true,
        liveLocation: true,
        routes: {
          where: { isActive: true },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return driver;
  }

  /**
   * Update driver profile
   */
  async updateProfile(userId: string, dto: UpdateDriverProfileDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Check licence number uniqueness if updating
    if (dto.licenceNumber && dto.licenceNumber !== driver.licenceNumber) {
      const existingLicence = await this.prisma.driver.findUnique({
        where: { licenceNumber: dto.licenceNumber },
      });

      if (existingLicence) {
        throw new BadRequestException('Licence number already registered');
      }
    }

    return this.prisma.driver.update({
      where: { userId },
      data: {
        ...dto,
        licenceExpiryDate: dto.licenceExpiryDate
          ? new Date(dto.licenceExpiryDate)
          : undefined,
        // Reset verification status if licence details changed
        verificationStatus:
          dto.licenceNumber || dto.licenceImage
            ? VerificationStatus.PENDING
            : undefined,
      },
    });
  }

  /**
   * Update driver status (online/offline)
   */
  async updateStatus(userId: string, status: DriverStatus) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { activeVehicle: true },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    if (driver.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException('Driver must be verified to go online');
    }

    if (status === DriverStatus.ONLINE && !driver.activeVehicle) {
      throw new BadRequestException('Please set an active vehicle first');
    }

    return this.prisma.driver.update({
      where: { userId },
      data: { status },
    });
  }

  /**
   * Set active vehicle
   */
  async setActiveVehicle(userId: string, vehicleId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        driverId: driver.id,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found or not owned by driver');
    }

    if (!vehicle.verified) {
      throw new BadRequestException('Vehicle must be verified first');
    }

    return this.prisma.driver.update({
      where: { userId },
      data: { activeVehicleId: vehicleId },
      include: { activeVehicle: true },
    });
  }

  /**
   * Update live location
   */
  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.prisma.liveLocation.upsert({
      where: { driverId: driver.id },
      update: {
        lat: dto.lat,
        lng: dto.lng,
        heading: dto.heading,
        speed: dto.speed,
        accuracy: dto.accuracy,
        updatedAt: new Date(),
      },
      create: {
        driverId: driver.id,
        lat: dto.lat,
        lng: dto.lng,
        heading: dto.heading,
        speed: dto.speed,
        accuracy: dto.accuracy,
      },
    });
  }

  /**
   * Get nearby online drivers
   */
  async getNearbyDrivers(dto: NearbyDriversDto) {
    const radius = dto.radius || 5; // Default 5km

    // Get all online drivers with locations
    const drivers = await this.prisma.driver.findMany({
      where: {
        status: DriverStatus.ONLINE,
        verificationStatus: VerificationStatus.VERIFIED,
        liveLocation: { isNot: null },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePic: true,
          },
        },
        activeVehicle: true,
        liveLocation: true,
        routes: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    // Filter by distance
    return drivers.filter((driver) => {
      if (!driver.liveLocation) return false;

      const distance = this.calculateDistance(
        dto.lat,
        dto.lng,
        driver.liveLocation.lat,
        driver.liveLocation.lng,
      );

      return distance <= radius;
    }).map((driver) => ({
      ...driver,
      distance: this.calculateDistance(
        dto.lat,
        dto.lng,
        driver.liveLocation!.lat,
        driver.liveLocation!.lng,
      ),
    }));
  }

  /**
   * Get driver statistics
   */
  async getStatistics(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const [todayRides, weekRides, monthRides, totalRides] = await Promise.all([
      this.prisma.ride.count({
        where: {
          driverId: driver.id,
          completedAt: { gte: this.startOfDay() },
        },
      }),
      this.prisma.ride.count({
        where: {
          driverId: driver.id,
          completedAt: { gte: this.startOfWeek() },
        },
      }),
      this.prisma.ride.count({
        where: {
          driverId: driver.id,
          completedAt: { gte: this.startOfMonth() },
        },
      }),
      this.prisma.ride.count({
        where: { driverId: driver.id },
      }),
    ]);

    const earnings = await this.prisma.ride.aggregate({
      where: {
        driverId: driver.id,
        isPaid: true,
      },
      _sum: { fare: true },
    });

    return {
      totalRides,
      todayRides,
      weekRides,
      monthRides,
      rating: driver.rating,
      totalEarnings: driver.totalEarnings,
      pendingEarnings: earnings._sum.fare || 0,
    };
  }

  /**
   * Admin: List all drivers with filters
   */
  async listDrivers(filter: DriverFilterDto) {
    return this.prisma.driver.findMany({
      where: {
        status: filter.status,
        verificationStatus: filter.verificationStatus,
        rating: filter.minRating ? { gte: filter.minRating } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            profilePic: true,
            isVerified: true,
          },
        },
        vehicles: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Verify driver
   */
  async verifyDriver(driverId: string, status: VerificationStatus) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        verificationStatus: status,
        licenceVerifiedAt: status === VerificationStatus.VERIFIED ? new Date() : null,
      },
    });
  }

  /**
   * Update driver rating
   */
  async updateRating(driverId: string, newRating: number) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Calculate new average rating
    const totalRatings = driver.totalTrips;
    const currentTotal = driver.rating * totalRatings;
    const newAverage = (currentTotal + newRating) / (totalRatings + 1);

    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        rating: Math.round(newAverage * 10) / 10, // Round to 1 decimal
        totalTrips: { increment: 1 },
      },
    });
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // Round to 2 decimals
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private startOfDay(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private startOfWeek(): Date {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay());
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private startOfMonth(): Date {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
