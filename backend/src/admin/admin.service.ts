import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RideStatus, DriverStatus, VerificationStatus, TransactionStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalDrivers,
      verifiedDrivers,
      pendingVerifications,
      totalVehicles,
      verifiedVehicles,
      onlineDrivers,
      totalRides,
      todayRides,
      weekRides,
      monthRides,
      completedRides,
      cancelledRides,
      totalRevenue,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      activeAlerts,
      pendingReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.driver.count(),
      this.prisma.driver.count({ where: { verificationStatus: VerificationStatus.VERIFIED } }),
      this.prisma.driver.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      this.prisma.vehicle.count(),
      this.prisma.vehicle.count({ where: { verified: true } }),
      this.prisma.driver.count({ where: { status: DriverStatus.ONLINE } }),
      this.prisma.ride.count(),
      this.prisma.ride.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.ride.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.ride.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.ride.count({ where: { status: RideStatus.COMPLETED } }),
      this.prisma.ride.count({ where: { status: RideStatus.CANCELLED } }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, amount: { gt: 0 }, createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, amount: { gt: 0 }, createdAt: { gte: startOfWeek } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED, amount: { gt: 0 }, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.sosAlert.count({ where: { isActive: true } }),
      this.prisma.safetyReport.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        drivers: totalDrivers,
        passengers: totalUsers - totalDrivers,
      },
      drivers: {
        total: totalDrivers,
        verified: verifiedDrivers,
        pending: pendingVerifications,
        online: onlineDrivers,
      },
      vehicles: {
        total: totalVehicles,
        verified: verifiedVehicles,
        pending: totalVehicles - verifiedVehicles,
      },
      rides: {
        total: totalRides,
        today: todayRides,
        week: weekRides,
        month: monthRides,
        completed: completedRides,
        cancelled: cancelledRides,
        completionRate: totalRides > 0 
          ? Math.round((completedRides / totalRides) * 100) 
          : 0,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
        today: todayRevenue._sum.amount || 0,
        week: weekRevenue._sum.amount || 0,
        month: monthRevenue._sum.amount || 0,
      },
      safety: {
        activeAlerts,
        pendingReports,
      },
    };
  }

  /**
   * Get route analytics
   */
  async getRouteAnalytics() {
    // Get popular routes
    const popularRoutes = await this.prisma.ride.groupBy({
      by: ['routeId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Fetch route details
    const routeIds = popularRoutes.map((r) => r.routeId).filter((id) => id !== null);
    const routes = await this.prisma.route.findMany({
      where: { id: { in: routeIds as string[] } },
      select: {
        id: true,
        name: true,
        originName: true,
        destinationName: true,
      },
    });

    const routeMap = new Map(routes.map((r) => [r.id, r]));

    return popularRoutes.map((pr) => ({
      route: pr.routeId ? routeMap.get(pr.routeId) : null,
      rideCount: pr._count.id,
    }));
  }

  /**
   * Get system configuration
   */
  async getSystemConfig() {
    const configs = await this.prisma.systemConfig.findMany();
    return configs.reduce(
      (acc, config) => ({ ...acc, [config.key]: config.value }),
      {},
    );
  }

  /**
   * Update system configuration
   */
  async updateSystemConfig(key: string, value: any, adminId: string) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedBy: adminId },
      create: { key, value, updatedBy: adminId },
    });
  }

  /**
   * Log admin action
   */
  async logAction(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    details?: any,
  ) {
    return this.prisma.adminAction.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        details,
      },
    });
  }

  /**
   * Get admin action logs
   */
  async getActionLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.adminAction.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.adminAction.count(),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Suspend user
   */
  async suspendUser(adminId: string, userId: string, reason: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await this.logAction(adminId, 'SUSPEND_USER', 'USER', userId, { reason });

    return { message: 'User suspended' };
  }

  /**
   * Reactivate user
   */
  async reactivateUser(adminId: string, userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    await this.logAction(adminId, 'REACTIVATE_USER', 'USER', userId);

    return { message: 'User reactivated' };
  }
}
