import { PrismaClient, UserRole, VehicleType, DriverStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { phone: '+263770000000' },
    update: {},
    create: {
      phone: '+263770000000',
      email: 'admin@ridepass.app',
      name: 'Admin User',
      role: UserRole.ADMIN,
      isVerified: true,
      idVerifiedAt: new Date(),
    },
  });
  console.log('✅ Created admin user:', admin.name);

  // Create test passenger
  const passenger = await prisma.user.upsert({
    where: { phone: '+263771111111' },
    update: {},
    create: {
      phone: '+263771111111',
      email: 'passenger@test.com',
      name: 'Test Passenger',
      role: UserRole.PASSENGER,
      isVerified: true,
    },
  });

  // Create wallet for passenger
  await prisma.wallet.upsert({
    where: { userId: passenger.id },
    update: {},
    create: {
      userId: passenger.id,
      balance: 50.0, // Starting balance for testing
    },
  });
  console.log('✅ Created test passenger:', passenger.name);

  // Create test driver
  const driverUser = await prisma.user.upsert({
    where: { phone: '+263772222222' },
    update: {},
    create: {
      phone: '+263772222222',
      email: 'driver@test.com',
      name: 'Test Driver',
      role: UserRole.DRIVER,
      isVerified: true,
      idVerifiedAt: new Date(),
    },
  });

  // Create driver profile
  const driver = await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      licenceNumber: 'DL123456',
      licenceImage: 'https://example.com/licence.jpg',
      licenceVerifiedAt: new Date(),
      verificationStatus: VerificationStatus.VERIFIED,
      status: DriverStatus.OFFLINE,
      rating: 4.8,
    },
  });

  // Create wallet for driver
  await prisma.wallet.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      balance: 0,
    },
  });

  // Create vehicle for driver
  const vehicle = await prisma.vehicle.upsert({
    where: { plateNumber: 'ABC 1234' },
    update: {},
    create: {
      driverId: driver.id,
      plateNumber: 'ABC 1234',
      make: 'Toyota',
      model: 'Hiace',
      year: 2020,
      color: 'White',
      vehicleType: VehicleType.KOMBI,
      capacity: 15,
      images: ['https://example.com/vehicle1.jpg'],
      verified: true,
      verificationStatus: VerificationStatus.VERIFIED,
    },
  });

  // Set vehicle as active
  await prisma.driver.update({
    where: { id: driver.id },
    data: { activeVehicleId: vehicle.id },
  });
  console.log('✅ Created test driver:', driverUser.name);

  // Create sample routes
  const routes = [
    {
      driverId: driver.id,
      name: 'CBD - Chitungwiza',
      originName: 'Harare CBD',
      originLat: -17.8292,
      originLng: 31.0522,
      destinationName: 'Chitungwiza',
      destinationLat: -18.0127,
      destinationLng: 31.0756,
      polyline: 'encoded_polyline_here',
      distance: 25.5,
      duration: 45,
      baseFare: 1.5,
    },
    {
      driverId: driver.id,
      name: 'CBD - Warren Park',
      originName: 'Harare CBD',
      originLat: -17.8292,
      originLng: 31.0522,
      destinationName: 'Warren Park',
      destinationLat: -17.8508,
      destinationLng: 30.9875,
      polyline: 'encoded_polyline_here',
      distance: 8.2,
      duration: 20,
      baseFare: 1.0,
    },
    {
      driverId: driver.id,
      name: 'CBD - Glen View',
      originName: 'Harare CBD',
      originLat: -17.8292,
      originLng: 31.0522,
      destinationName: 'Glen View',
      destinationLat: -17.8917,
      destinationLng: 30.9833,
      polyline: 'encoded_polyline_here',
      distance: 12.0,
      duration: 25,
      baseFare: 1.2,
    },
  ];

  for (const route of routes) {
    await prisma.route.create({ data: route });
  }
  console.log('✅ Created sample routes');

  // Create system config
  const configs = [
    { key: 'PLATFORM_FEE_PERCENT', value: 10 },
    { key: 'MIN_WALLET_TOPUP', value: 1 },
    { key: 'MAX_WALLET_TOPUP', value: 1000 },
    { key: 'QR_CODE_EXPIRY_MINUTES', value: 5 },
    { key: 'DRIVER_RADIUS_KM', value: 5 },
    { key: 'SETTLEMENT_DAY', value: 'SUNDAY' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }
  console.log('✅ Created system config');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
