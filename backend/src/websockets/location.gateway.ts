import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../common/prisma/prisma.service';
import { DriversService } from '../drivers/drivers.service';

interface LocationUpdate {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

interface SubscribeToDriver {
  driverId: string;
}

interface SubscribeToArea {
  lat: number;
  lng: number;
  radius: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/location',
})
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private driverSockets: Map<string, string> = new Map(); // driverId -> socketId
  private socketToDriver: Map<string, string> = new Map(); // socketId -> driverId
  private subscriptions: Map<string, Set<string>> = new Map(); // driverId -> Set<socketId>

  constructor(
    private prisma: PrismaService,
    private driversService: DriversService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);

    // Clean up driver connection
    const driverId = this.socketToDriver.get(client.id);
    if (driverId) {
      this.driverSockets.delete(driverId);
      this.socketToDriver.delete(client.id);
    }

    // Clean up subscriptions
    this.subscriptions.forEach((subscribers, driverId) => {
      subscribers.delete(client.id);
    });
  }

  /**
   * Driver registers their connection
   */
  @SubscribeMessage('driver:connect')
  async handleDriverConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      const driver = await this.prisma.driver.findUnique({
        where: { userId: data.userId },
      });

      if (!driver) {
        return { error: 'Driver not found' };
      }

      // Store connection mapping
      this.driverSockets.set(driver.id, client.id);
      this.socketToDriver.set(client.id, driver.id);

      console.log(`🚗 Driver ${driver.id} connected`);

      return { success: true, driverId: driver.id };
    } catch (error) {
      return { error: 'Connection failed' };
    }
  }

  /**
   * Driver broadcasts location update
   */
  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdate,
  ) {
    try {
      // Update location in database
      await this.prisma.liveLocation.upsert({
        where: { driverId: data.driverId },
        update: {
          lat: data.lat,
          lng: data.lng,
          heading: data.heading,
          speed: data.speed,
          updatedAt: new Date(),
        },
        create: {
          driverId: data.driverId,
          lat: data.lat,
          lng: data.lng,
          heading: data.heading,
          speed: data.speed,
        },
      });

      // Broadcast to all subscribers of this driver
      const subscribers = this.subscriptions.get(data.driverId);
      if (subscribers && subscribers.size > 0) {
        subscribers.forEach((socketId) => {
          this.server.to(socketId).emit('location:updated', {
            driverId: data.driverId,
            lat: data.lat,
            lng: data.lng,
            heading: data.heading,
            speed: data.speed,
            timestamp: new Date().toISOString(),
          });
        });
      }

      // Also broadcast to the 'drivers' room for map updates
      this.server.to('drivers').emit('driver:location', {
        driverId: data.driverId,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading,
        speed: data.speed,
      });

      return { success: true };
    } catch (error) {
      console.error('Location update error:', error);
      return { error: 'Update failed' };
    }
  }

  /**
   * Passenger subscribes to a specific driver's location
   */
  @SubscribeMessage('subscribe:driver')
  handleSubscribeToDriver(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeToDriver,
  ) {
    if (!this.subscriptions.has(data.driverId)) {
      this.subscriptions.set(data.driverId, new Set());
    }

    this.subscriptions.get(data.driverId)!.add(client.id);

    console.log(`👁 Client ${client.id} subscribed to driver ${data.driverId}`);

    return { success: true };
  }

  /**
   * Passenger unsubscribes from a driver's location
   */
  @SubscribeMessage('unsubscribe:driver')
  handleUnsubscribeFromDriver(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeToDriver,
  ) {
    const subscribers = this.subscriptions.get(data.driverId);
    if (subscribers) {
      subscribers.delete(client.id);
    }

    return { success: true };
  }

  /**
   * Subscribe to all driver locations (for map view)
   */
  @SubscribeMessage('subscribe:all-drivers')
  handleSubscribeToAllDrivers(@ConnectedSocket() client: Socket) {
    client.join('drivers');
    console.log(`👁 Client ${client.id} subscribed to all drivers`);
    return { success: true };
  }

  /**
   * Unsubscribe from all driver locations
   */
  @SubscribeMessage('unsubscribe:all-drivers')
  handleUnsubscribeFromAllDrivers(@ConnectedSocket() client: Socket) {
    client.leave('drivers');
    return { success: true };
  }

  /**
   * Get current locations of all online drivers
   */
  @SubscribeMessage('get:all-drivers')
  async handleGetAllDrivers() {
    const locations = await this.prisma.liveLocation.findMany({
      include: {
        driver: {
          include: {
            user: {
              select: { name: true, profilePic: true },
            },
            activeVehicle: true,
            routes: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
      where: {
        driver: {
          status: 'ONLINE',
        },
      },
    });

    return { drivers: locations };
  }

  /**
   * Emit ride event to specific driver
   */
  emitToDriver(driverId: string, event: string, data: any) {
    const socketId = this.driverSockets.get(driverId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  /**
   * Emit event to specific client
   */
  emitToClient(socketId: string, event: string, data: any) {
    this.server.to(socketId).emit(event, data);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
}
