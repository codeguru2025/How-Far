import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a notification
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: any,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data,
      },
    });

    // TODO: Send push notification via Firebase
    await this.sendPushNotification(userId, title, body, data);

    return notification;
  }

  /**
   * Send push notification via Firebase
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      return; // No FCM token, skip push notification
    }

    // TODO: Implement Firebase Admin SDK
    // import * as admin from 'firebase-admin';
    // await admin.messaging().send({
    //   token: user.fcmToken,
    //   notification: { title, body },
    //   data,
    // });

    console.log(`📱 Push notification to ${userId}: ${title}`);
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { message: 'All notifications marked as read' };
  }

  /**
   * Delete notification
   */
  async delete(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted' };
  }

  /**
   * Send notification to multiple users
   */
  async broadcast(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    data?: any,
  ) {
    const notifications = userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      data,
    }));

    await this.prisma.notification.createMany({ data: notifications });

    // Send push notifications
    for (const userId of userIds) {
      await this.sendPushNotification(userId, title, body, data);
    }

    return { message: `Sent to ${userIds.length} users` };
  }

  // Notification helper methods
  async notifyRideRequest(driverId: string, rideId: string, passengerName: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (driver) {
      await this.create(
        driver.userId,
        NotificationType.RIDE_REQUEST,
        'New Ride Request',
        `${passengerName} is requesting a ride`,
        { rideId },
      );
    }
  }

  async notifyRideAccepted(passengerId: string, rideId: string, driverName: string) {
    await this.create(
      passengerId,
      NotificationType.RIDE_ACCEPTED,
      'Ride Accepted',
      `${driverName} has accepted your ride request`,
      { rideId },
    );
  }

  async notifyRideCancelled(userId: string, rideId: string, reason?: string) {
    await this.create(
      userId,
      NotificationType.RIDE_CANCELLED,
      'Ride Cancelled',
      reason || 'Your ride has been cancelled',
      { rideId },
    );
  }

  async notifyPaymentReceived(driverId: string, amount: number) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (driver) {
      await this.create(
        driver.userId,
        NotificationType.PAYMENT_RECEIVED,
        'Payment Received',
        `You received $${amount.toFixed(2)}`,
        { amount },
      );
    }
  }

  async notifySettlement(driverId: string, amount: number) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (driver) {
      await this.create(
        driver.userId,
        NotificationType.SETTLEMENT,
        'Settlement Processed',
        `$${amount.toFixed(2)} has been settled to your account`,
        { amount },
      );
    }
  }
}
