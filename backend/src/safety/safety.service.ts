import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateSafetyReportDto,
  TriggerSosDto,
  ResolveReportDto,
  SafetyFilterDto,
} from './dto/safety.dto';
import { ReportStatus } from '@prisma/client';

@Injectable()
export class SafetyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a safety report
   */
  async createReport(reporterId: string, dto: CreateSafetyReportDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.targetId },
    });

    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    if (reporterId === dto.targetId) {
      throw new BadRequestException('Cannot report yourself');
    }

    return this.prisma.safetyReport.create({
      data: {
        reporterId,
        targetId: dto.targetId,
        type: dto.type,
        description: dto.description,
        evidence: dto.evidence || [],
        location: dto.lat && dto.lng ? { lat: dto.lat, lng: dto.lng } : null,
      },
      include: {
        reporter: {
          select: { id: true, name: true, phone: true },
        },
        target: {
          select: { id: true, name: true, phone: true },
        },
      },
    });
  }

  /**
   * Trigger SOS alert
   */
  async triggerSos(userId: string, dto: TriggerSosDto) {
    // Create SOS alert
    const sosAlert = await this.prisma.sosAlert.create({
      data: {
        userId,
        rideId: dto.rideId,
        lat: dto.lat,
        lng: dto.lng,
        message: dto.message,
      },
    });

    // Get user details and guardian
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        guardian: true,
      },
    });

    // TODO: Send notifications
    // 1. Notify admin/support
    // 2. Notify guardian if exists
    // 3. Send SMS with location

    console.log(`🚨 SOS ALERT from user ${user?.name} at ${dto.lat}, ${dto.lng}`);

    // If in a ride, get ride details
    if (dto.rideId) {
      const ride = await this.prisma.ride.findUnique({
        where: { id: dto.rideId },
        include: {
          driver: {
            include: {
              user: {
                select: { name: true, phone: true },
              },
            },
          },
        },
      });

      if (ride) {
        // Notify driver or passenger depending on who triggered
        console.log(`🚨 SOS triggered during ride ${ride.id}`);
      }
    }

    return {
      alert: sosAlert,
      message: 'SOS alert triggered. Help is on the way.',
      emergencyContacts: user?.guardian ? [user.guardian.phone] : [],
    };
  }

  /**
   * Resolve SOS alert
   */
  async resolveSos(alertId: string, resolvedBy: string) {
    const alert = await this.prisma.sosAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException('SOS alert not found');
    }

    return this.prisma.sosAlert.update({
      where: { id: alertId },
      data: {
        isActive: false,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }

  /**
   * Get active SOS alerts (Admin)
   */
  async getActiveSosAlerts() {
    return this.prisma.sosAlert.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get reports by user
   */
  async getMyReports(userId: string) {
    return this.prisma.safetyReport.findMany({
      where: { reporterId: userId },
      include: {
        target: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get reports against user
   */
  async getReportsAgainstUser(userId: string) {
    return this.prisma.safetyReport.findMany({
      where: { targetId: userId },
      include: {
        reporter: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: List all reports with filters
   */
  async listReports(filter: SafetyFilterDto, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;

    const [reports, total] = await Promise.all([
      this.prisma.safetyReport.findMany({
        where,
        include: {
          reporter: {
            select: { id: true, name: true, phone: true },
          },
          target: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.safetyReport.count({ where }),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Resolve report
   */
  async resolveReport(reportId: string, adminId: string, dto: ResolveReportDto) {
    const report = await this.prisma.safetyReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.safetyReport.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolvedAt: new Date(),
        resolvedBy: adminId,
        resolution: dto.resolution,
      },
    });
  }

  /**
   * Get user safety score based on reports
   */
  async getUserSafetyScore(userId: string) {
    const [reportsMade, reportsReceived, resolvedPositively] = await Promise.all([
      this.prisma.safetyReport.count({ where: { reporterId: userId } }),
      this.prisma.safetyReport.count({ where: { targetId: userId } }),
      this.prisma.safetyReport.count({
        where: {
          targetId: userId,
          status: ReportStatus.RESOLVED,
        },
      }),
    ]);

    // Calculate score (100 - penalties)
    let score = 100;
    score -= reportsReceived * 5; // -5 per report
    score += resolvedPositively * 2; // +2 for resolved positively
    score = Math.max(0, Math.min(100, score)); // Clamp between 0-100

    return {
      score,
      reportsMade,
      reportsReceived,
      resolvedPositively,
    };
  }
}
