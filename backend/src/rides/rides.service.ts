import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RequestRideDto, UpdateRideStatusDto, RateRideDto, RideFilterDto } from './dto/ride.dto';
import { RideStatus, PaymentMethod, DriverStatus } from '@prisma/client';
import { v4 as uuid } from 'uuid';

@Injectable()
export class RidesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Request a ride
   */
  async requestRide(passengerId: string, dto: RequestRideDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
      include: { activeVehicle: true },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.status !== DriverStatus.ONLINE) {
      throw new BadRequestException('Driver is not available');
    }

    // Check if passenger has active ride
    const activeRide = await this.prisma.ride.findFirst({
      where: {
        passengerId,
        status: { in: [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] },
      },
    });

    if (activeRide) {
      throw new BadRequestException('You already have an active ride');
    }

    const ride = await this.prisma.ride.create({
      data: {
        passengerId,
        driverId: driver.id,
        vehicleId: driver.activeVehicleId,
        routeId: dto.routeId,
        pickupName: dto.pickupName,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        dropoffName: dto.dropoffName,
        dropoffLat: dto.dropoffLat,
        dropoffLng: dto.dropoffLng,
        fare: dto.fare,
        paymentMethod: dto.paymentMethod || PaymentMethod.WALLET,
      },
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, profilePic: true },
        },
        driver: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, profilePic: true },
            },
            activeVehicle: true,
          },
        },
      },
    });

    // TODO: Send notification to driver
    // TODO: Emit WebSocket event

    return ride;
  }

  /**
   * Accept or reject ride (Driver)
   */
  async respondToRide(userId: string, rideId: string, accept: boolean) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== driver.id) {
      throw new ForbiddenException('This ride is not assigned to you');
    }

    if (ride.status !== RideStatus.REQUESTED) {
      throw new BadRequestException('Ride cannot be modified');
    }

    if (accept) {
      return this.prisma.ride.update({
        where: { id: rideId },
        data: {
          status: RideStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        include: {
          passenger: {
            select: { id: true, name: true, phone: true, profilePic: true },
          },
        },
      });
    } else {
      return this.prisma.ride.update({
        where: { id: rideId },
        data: {
          status: RideStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: 'Driver rejected the ride',
        },
      });
    }
  }

  /**
   * Update ride status
   */
  async updateStatus(userId: string, rideId: string, dto: UpdateRideStatusDto) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    // Verify user is part of this ride
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    const isDriver = driver?.id === ride.driverId;
    const isPassenger = ride.passengerId === userId;

    if (!isDriver && !isPassenger) {
      throw new ForbiddenException('You are not part of this ride');
    }

    // Validate status transitions
    const validTransitions: Record<RideStatus, RideStatus[]> = {
      [RideStatus.REQUESTED]: [RideStatus.ACCEPTED, RideStatus.CANCELLED],
      [RideStatus.ACCEPTED]: [RideStatus.PASSENGER_PICKED, RideStatus.CANCELLED],
      [RideStatus.PASSENGER_PICKED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
      [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED, RideStatus.CANCELLED],
      [RideStatus.COMPLETED]: [],
      [RideStatus.CANCELLED]: [],
    };

    if (!validTransitions[ride.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${ride.status} to ${dto.status}`,
      );
    }

    const updateData: any = { status: dto.status };

    switch (dto.status) {
      case RideStatus.ACCEPTED:
        updateData.acceptedAt = new Date();
        break;
      case RideStatus.IN_PROGRESS:
        updateData.startedAt = new Date();
        // Update driver status
        await this.prisma.driver.update({
          where: { id: ride.driverId },
          data: { status: DriverStatus.ON_TRIP },
        });
        break;
      case RideStatus.COMPLETED:
        updateData.completedAt = new Date();
        // Update driver status back to online
        await this.prisma.driver.update({
          where: { id: ride.driverId },
          data: { status: DriverStatus.ONLINE },
        });
        break;
      case RideStatus.CANCELLED:
        updateData.cancelledAt = new Date();
        updateData.cancelReason = dto.cancelReason;
        // Update driver status if they were on trip
        if (ride.status === RideStatus.IN_PROGRESS) {
          await this.prisma.driver.update({
            where: { id: ride.driverId },
            data: { status: DriverStatus.ONLINE },
          });
        }
        break;
    }

    return this.prisma.ride.update({
      where: { id: rideId },
      data: updateData,
      include: {
        passenger: {
          select: { id: true, name: true, phone: true },
        },
        driver: {
          include: {
            user: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
      },
    });
  }

  /**
   * Rate a completed ride
   */
  async rateRide(userId: string, rideId: string, dto: RateRideDto) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Can only rate completed rides');
    }

    const isPassenger = ride.passengerId === userId;
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });
    const isDriver = driver?.id === ride.driverId;

    if (!isPassenger && !isDriver) {
      throw new ForbiddenException('You are not part of this ride');
    }

    if (isPassenger) {
      // Passenger rating driver
      if (ride.driverRating) {
        throw new BadRequestException('You have already rated this ride');
      }

      await this.prisma.ride.update({
        where: { id: rideId },
        data: {
          driverRating: dto.rating,
          feedback: dto.feedback,
        },
      });

      // Update driver's average rating
      const driverRides = await this.prisma.ride.findMany({
        where: {
          driverId: ride.driverId,
          driverRating: { not: null },
        },
        select: { driverRating: true },
      });

      const avgRating =
        driverRides.reduce((sum, r) => sum + (r.driverRating || 0), 0) /
        driverRides.length;

      await this.prisma.driver.update({
        where: { id: ride.driverId },
        data: {
          rating: Math.round(avgRating * 10) / 10,
          totalTrips: { increment: 1 },
        },
      });
    } else {
      // Driver rating passenger
      if (ride.passengerRating) {
        throw new BadRequestException('You have already rated this passenger');
      }

      await this.prisma.ride.update({
        where: { id: rideId },
        data: {
          passengerRating: dto.rating,
        },
      });
    }

    return { message: 'Rating submitted successfully' };
  }

  /**
   * Share trip with family
   */
  async shareTrip(userId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.passengerId !== userId) {
      throw new ForbiddenException('You can only share your own trips');
    }

    // Check if share already exists
    const existingShare = await this.prisma.tripShare.findUnique({
      where: { rideId },
    });

    if (existingShare) {
      return existingShare;
    }

    const shareCode = uuid().substring(0, 8).toUpperCase();
    const shareUrl = `https://ridepass.app/track/${shareCode}`;

    return this.prisma.tripShare.create({
      data: {
        rideId,
        creatorId: userId,
        shareCode,
        shareUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  }

  /**
   * View shared trip
   */
  async viewSharedTrip(shareCode: string) {
    const share = await this.prisma.tripShare.findUnique({
      where: { shareCode },
      include: {
        ride: {
          include: {
            driver: {
              include: {
                user: {
                  select: { name: true, profilePic: true },
                },
                activeVehicle: true,
                liveLocation: true,
              },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Shared trip not found');
    }

    if (new Date() > share.expiresAt) {
      throw new BadRequestException('Share link has expired');
    }

    // Update viewed timestamp
    await this.prisma.tripShare.update({
      where: { id: share.id },
      data: { viewedAt: new Date() },
    });

    return {
      ride: share.ride,
      driverLocation: share.ride.driver.liveLocation,
    };
  }

  /**
   * Get ride by ID
   */
  async findById(rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, profilePic: true },
        },
        driver: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, profilePic: true },
            },
            activeVehicle: true,
            liveLocation: true,
          },
        },
        route: true,
        tripShare: true,
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return ride;
  }

  /**
   * Get rides for passenger
   */
  async getPassengerRides(passengerId: string, filter: RideFilterDto) {
    const where: any = { passengerId };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    return this.prisma.ride.findMany({
      where,
      include: {
        driver: {
          include: {
            user: {
              select: { name: true, profilePic: true },
            },
            activeVehicle: true,
          },
        },
        route: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get rides for driver
   */
  async getDriverRides(userId: string, filter: RideFilterDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const where: any = { driverId: driver.id };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    return this.prisma.ride.findMany({
      where,
      include: {
        passenger: {
          select: { id: true, name: true, phone: true, profilePic: true },
        },
        route: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get active ride for user
   */
  async getActiveRide(userId: string) {
    // Check as passenger
    let ride = await this.prisma.ride.findFirst({
      where: {
        passengerId: userId,
        status: { in: [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] },
      },
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
        route: true,
      },
    });

    if (ride) {
      return { ride, role: 'passenger' };
    }

    // Check as driver
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (driver) {
      ride = await this.prisma.ride.findFirst({
        where: {
          driverId: driver.id,
          status: { in: [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] },
        },
        include: {
          passenger: {
            select: { id: true, name: true, phone: true, profilePic: true },
          },
          route: true,
        },
      });

      if (ride) {
        return { ride, role: 'driver' };
      }
    }

    return null;
  }
}
