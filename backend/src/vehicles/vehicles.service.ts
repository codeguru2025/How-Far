import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleFilterDto,
} from './dto/vehicle.dto';
import { VerificationStatus } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new vehicle
   */
  async create(userId: string, dto: CreateVehicleDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Check plate number uniqueness
    const existingVehicle = await this.prisma.vehicle.findUnique({
      where: { plateNumber: dto.plateNumber },
    });

    if (existingVehicle) {
      throw new BadRequestException('Vehicle with this plate number already exists');
    }

    return this.prisma.vehicle.create({
      data: {
        driverId: driver.id,
        plateNumber: dto.plateNumber.toUpperCase(),
        make: dto.make,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        vehicleType: dto.vehicleType,
        capacity: dto.capacity || 15,
        images: dto.images,
        insuranceNumber: dto.insuranceNumber,
        insuranceExpiry: dto.insuranceExpiry
          ? new Date(dto.insuranceExpiry)
          : null,
      },
    });
  }

  /**
   * Get vehicle by ID
   */
  async findById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        driver: {
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
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  /**
   * Get all vehicles for a driver
   */
  async findByDriver(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.prisma.vehicle.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update vehicle
   */
  async update(userId: string, vehicleId: string, dto: UpdateVehicleDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.driverId !== driver.id) {
      throw new ForbiddenException('You can only update your own vehicles');
    }

    // Check plate number uniqueness if updating
    if (dto.plateNumber && dto.plateNumber !== vehicle.plateNumber) {
      const existingVehicle = await this.prisma.vehicle.findUnique({
        where: { plateNumber: dto.plateNumber },
      });

      if (existingVehicle) {
        throw new BadRequestException('Vehicle with this plate number already exists');
      }
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...dto,
        plateNumber: dto.plateNumber?.toUpperCase(),
        insuranceExpiry: dto.insuranceExpiry
          ? new Date(dto.insuranceExpiry)
          : undefined,
        // Reset verification if key details changed
        verificationStatus:
          dto.plateNumber || dto.images
            ? VerificationStatus.PENDING
            : undefined,
        verified:
          dto.plateNumber || dto.images ? false : undefined,
      },
    });
  }

  /**
   * Delete vehicle
   */
  async delete(userId: string, vehicleId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.driverId !== driver.id) {
      throw new ForbiddenException('You can only delete your own vehicles');
    }

    // Check if this is the active vehicle
    if (driver.activeVehicleId === vehicleId) {
      await this.prisma.driver.update({
        where: { id: driver.id },
        data: { activeVehicleId: null },
      });
    }

    await this.prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    return { message: 'Vehicle deleted successfully' };
  }

  /**
   * Admin: List all vehicles with filters
   */
  async listVehicles(filter: VehicleFilterDto) {
    const where: any = {};

    if (filter.vehicleType) {
      where.vehicleType = filter.vehicleType;
    }

    if (filter.verificationStatus) {
      where.verificationStatus = filter.verificationStatus;
    }

    if (filter.search) {
      where.OR = [
        { plateNumber: { contains: filter.search, mode: 'insensitive' } },
        { make: { contains: filter.search, mode: 'insensitive' } },
        { model: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.vehicle.findMany({
      where,
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Verify vehicle
   */
  async verifyVehicle(vehicleId: string, status: VerificationStatus) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        verificationStatus: status,
        verified: status === VerificationStatus.VERIFIED,
      },
    });
  }
}
