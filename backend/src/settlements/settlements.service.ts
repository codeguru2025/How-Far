import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettlementFilterDto, ProcessSettlementDto } from './dto/settlement.dto';
import { SettlementPeriod, SettlementStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate driver earnings for a period
   */
  async calculateEarnings(driverId: string, startDate: Date, endDate: Date) {
    const rides = await this.prisma.ride.findMany({
      where: {
        driverId,
        status: 'COMPLETED',
        isPaid: true,
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalFare = rides.reduce((sum, ride) => sum + ride.fare, 0);
    const platformFee = totalFare * 0.1; // 10% platform fee
    const netAmount = totalFare - platformFee;

    return {
      rides: rides.length,
      totalFare,
      platformFee,
      netAmount,
    };
  }

  /**
   * Create a settlement for driver
   */
  async createSettlement(
    driverId: string,
    period: SettlementPeriod,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const earnings = await this.calculateEarnings(driverId, periodStart, periodEnd);

    if (earnings.netAmount <= 0) {
      return null; // No settlement needed
    }

    return this.prisma.settlement.create({
      data: {
        driverId,
        amount: earnings.totalFare,
        fee: earnings.platformFee,
        netAmount: earnings.netAmount,
        period,
        periodStart,
        periodEnd,
        reference: `STL-${Date.now()}-${uuid().substring(0, 8)}`,
      },
    });
  }

  /**
   * Get settlements for driver
   */
  async getDriverSettlements(userId: string, filter: SettlementFilterDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const where: any = { driverId: driver.id };

    if (filter.period) where.period = filter.period;
    if (filter.status) where.status = filter.status;

    if (filter.startDate || filter.endDate) {
      where.periodStart = {};
      if (filter.startDate) where.periodStart.gte = new Date(filter.startDate);
      if (filter.endDate) where.periodStart.lte = new Date(filter.endDate);
    }

    return this.prisma.settlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get driver's settlement summary
   */
  async getDriverSummary(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const [pending, completed, thisMonth] = await Promise.all([
      this.prisma.settlement.aggregate({
        where: { driverId: driver.id, status: SettlementStatus.PENDING },
        _sum: { netAmount: true },
      }),
      this.prisma.settlement.aggregate({
        where: { driverId: driver.id, status: SettlementStatus.COMPLETED },
        _sum: { netAmount: true },
      }),
      this.prisma.settlement.aggregate({
        where: {
          driverId: driver.id,
          status: SettlementStatus.COMPLETED,
          periodStart: { gte: this.startOfMonth() },
        },
        _sum: { netAmount: true },
      }),
    ]);

    // Calculate current period earnings (not yet settled)
    const currentEarnings = await this.calculateEarnings(
      driver.id,
      this.startOfWeek(),
      new Date(),
    );

    return {
      pendingSettlement: pending._sum.netAmount || 0,
      totalSettled: completed._sum.netAmount || 0,
      thisMonthSettled: thisMonth._sum.netAmount || 0,
      currentPeriodEarnings: currentEarnings.netAmount,
      totalEarnings: driver.totalEarnings,
    };
  }

  /**
   * Admin: List all settlements
   */
  async listSettlements(filter: SettlementFilterDto, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filter.period) where.period = filter.period;
    if (filter.status) where.status = filter.status;

    if (filter.startDate || filter.endDate) {
      where.periodStart = {};
      if (filter.startDate) where.periodStart.gte = new Date(filter.startDate);
      if (filter.endDate) where.periodStart.lte = new Date(filter.endDate);
    }

    const [settlements, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        include: {
          driver: {
            include: {
              user: {
                select: { name: true, phone: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return {
      settlements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Process settlement
   */
  async processSettlement(settlementId: string, dto: ProcessSettlementDto) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    return this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: dto.status,
        paidAt: dto.status === SettlementStatus.COMPLETED ? new Date() : null,
        reference: dto.reference || settlement.reference,
      },
    });
  }

  /**
   * Scheduled task: Generate daily settlements
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailySettlements() {
    console.log('🔄 Generating daily settlements...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    // Get all verified drivers
    const drivers = await this.prisma.driver.findMany({
      where: { verificationStatus: 'VERIFIED' },
    });

    let count = 0;
    for (const driver of drivers) {
      const settlement = await this.createSettlement(
        driver.id,
        SettlementPeriod.DAILY,
        yesterday,
        endOfYesterday,
      );
      if (settlement) count++;
    }

    console.log(`✅ Generated ${count} daily settlements`);
  }

  /**
   * Scheduled task: Generate weekly settlements
   */
  @Cron('0 0 * * 0') // Every Sunday at midnight
  async generateWeeklySettlements() {
    console.log('🔄 Generating weekly settlements...');

    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date();
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

    const drivers = await this.prisma.driver.findMany({
      where: { verificationStatus: 'VERIFIED' },
    });

    let count = 0;
    for (const driver of drivers) {
      const settlement = await this.createSettlement(
        driver.id,
        SettlementPeriod.WEEKLY,
        lastWeekStart,
        lastWeekEnd,
      );
      if (settlement) count++;
    }

    console.log(`✅ Generated ${count} weekly settlements`);
  }

  private startOfMonth(): Date {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private startOfWeek(): Date {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay());
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
