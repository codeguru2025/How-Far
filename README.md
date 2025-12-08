# RidePass - Hybrid Route-Broadcast + QR Payment Transport Platform

A comprehensive transport platform for drivers to broadcast routes and accept QR payments, and for passengers to find nearby vehicles and pay seamlessly.

## 🚀 Overview

RidePass is a full-stack transport platform featuring:

- **Drivers**: Create account, verify ID + vehicle, broadcast live GPS & routes, display QR for payments
- **Passengers**: Find nearby vehicles, see routes on map, pay via QR/wallet, share trips with family
- **Admin**: Verify users/vehicles, manage reports, control payouts, view analytics

## 📱 Mobile App (React Native / Expo)

The mobile app is built with:
- **Expo Router** - File-based navigation
- **React Native** - Cross-platform iOS/Android/Web
- **React Query** - Server state management
- **Zustand** - Client state management
- **expo-location** - GPS tracking
- **expo-camera** - QR code scanning

### App Structure

```
app/
├── (commuter)/           # Passenger screens
│   ├── home.tsx         # Dashboard with wallet, nearby drivers
│   ├── auth.tsx         # Registration/login
│   ├── plans.tsx        # Subscription plans
│   ├── payment.tsx      # Payment flow
│   ├── history.tsx      # Ride history
│   ├── wallet.tsx       # Wallet management
│   └── map.tsx          # Live map with drivers
├── (operator)/           # Driver screens  
│   ├── home.tsx         # Driver dashboard with QR, stats
│   ├── auth.tsx         # Driver registration
│   ├── routes.tsx       # Route management
│   └── earnings.tsx     # Earnings & settlements
├── index.tsx            # Entry point
├── onboarding.tsx       # Onboarding screens
└── role-select.tsx      # Role selection
```

### Running the Mobile App

```bash
# Install dependencies
bun install

# Start development server
bun run start

# Start with web preview
bun run start-web
```

## 🖥 Backend API (NestJS)

A production-ready NestJS backend with:
- **PostgreSQL** database with Prisma ORM
- **WebSockets** for real-time location updates
- **JWT Authentication** with OTP verification
- **Modular Architecture** - Clean, scalable code structure

### Backend Structure

```
backend/
├── src/
│   ├── auth/            # Authentication (OTP, JWT)
│   ├── users/           # User management
│   ├── drivers/         # Driver profiles & verification
│   ├── vehicles/        # Vehicle registration
│   ├── routes/          # Route broadcasting
│   ├── rides/           # Ride lifecycle
│   ├── wallet/          # Wallet & QR payments
│   ├── transactions/    # Transaction history
│   ├── settlements/     # Driver payouts
│   ├── safety/          # SOS & reports
│   ├── notifications/   # Push notifications
│   ├── admin/           # Admin panel
│   └── websockets/      # Real-time location
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data
└── docker-compose.yml   # Docker setup
```

### Running the Backend

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Start development server
npm run start:dev
```

### Using Docker

```bash
cd backend

# Start all services (PostgreSQL, Redis, API)
docker-compose up -d

# Run migrations
docker-compose exec api npx prisma migrate deploy

# Seed database
docker-compose exec api npx prisma db seed
```

## 📊 Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| Users | All users (passengers, drivers, admins) |
| Drivers | Driver profiles with licence info |
| Vehicles | Registered vehicles |
| Routes | Broadcasted routes with polylines |
| LiveLocation | Real-time GPS data |
| Rides | Ride requests and history |
| Wallet | User wallet balances |
| Transactions | All financial transactions |
| Settlements | Driver payouts |
| SafetyReports | Safety incident reports |
| SosAlerts | Emergency SOS alerts |

## 🔐 Safety Features (Mandatory)

All safety features are built-in and non-negotiable:

- ✅ Driver ID verification (photo + ID upload)
- ✅ Vehicle verification (plate + licence)
- ✅ Passenger emergency SOS button
- ✅ Driver emergency SOS button
- ✅ Guardian/parent linked accounts for minors
- ✅ Real-time trip sharing link for family
- ✅ Automatic flagging of unusual patterns
- ✅ Ratings and behaviour score system
- ✅ Zero cash handling (QR + wallet only)

## 💰 Wallet & Payment System

### Passenger Flow
1. Top-up wallet using EcoCash, InnBucks, or bank transfer
2. Find a vehicle on the map
3. Scan driver's QR code to pay
4. Amount deducted from wallet

### Driver Flow
1. Go online and broadcast route
2. Accept passengers
3. Generate QR code for fare amount
4. Receive payment in wallet
5. Get automated daily/weekly/monthly settlements

## 🌐 API Endpoints

### Authentication
- `POST /api/v1/auth/send-otp` - Send OTP
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register

### Drivers
- `GET /api/v1/drivers/nearby` - Get nearby drivers
- `PUT /api/v1/drivers/status` - Go online/offline
- `PUT /api/v1/drivers/location` - Update location

### Routes
- `GET /api/v1/routes/active` - Get active routes
- `GET /api/v1/routes/nearby` - Get nearby routes
- `POST /api/v1/routes` - Create route

### Rides
- `POST /api/v1/rides/request` - Request ride
- `PUT /api/v1/rides/:id/status` - Update status
- `POST /api/v1/rides/:id/share` - Share trip

### Wallet
- `GET /api/v1/wallet` - Get wallet
- `POST /api/v1/wallet/top-up` - Top up
- `POST /api/v1/wallet/generate-qr` - Generate payment QR
- `POST /api/v1/wallet/pay-qr` - Pay via QR

### Safety
- `POST /api/v1/safety/sos` - Trigger SOS
- `POST /api/v1/safety/report` - Submit report

## 📡 WebSocket Events

Connect to `/location` namespace for real-time updates:

```javascript
// Driver: Update location
socket.emit('location:update', {
  driverId: 'driver-id',
  lat: -17.8292,
  lng: 31.0522,
  speed: 45.5,
  heading: 90
});

// Passenger: Subscribe to driver
socket.emit('subscribe:driver', { driverId: 'driver-id' });

// Receive location updates
socket.on('location:updated', (data) => {
  console.log('Driver location:', data);
});
```

## 🧪 Test Accounts

After seeding the database:

| Role | Phone | Description |
|------|-------|-------------|
| Admin | +263770000000 | System admin |
| Passenger | +263771111111 | Test passenger ($50 balance) |
| Driver | +263772222222 | Verified driver with vehicle |

## 🛠 Technology Stack

### Mobile
- React Native 0.81
- Expo 54
- Expo Router 6
- TypeScript
- React Query
- Zustand

### Backend
- NestJS 10
- PostgreSQL 15
- Prisma ORM 5
- Socket.io 4
- JWT + Passport
- Docker

## 📁 Project Structure

```
workspace/
├── app/                  # Mobile app screens
├── assets/               # Images and icons
├── constants/            # Colors, config
├── contexts/             # React contexts
├── services/             # API services
├── types/                # TypeScript types
├── utils/                # Utility functions
├── backend/              # NestJS backend
│   ├── src/             # Source code
│   ├── prisma/          # Database schema
│   └── docker-compose.yml
├── package.json          # Mobile dependencies
└── README.md            # This file
```

## 🚀 Deployment

### Mobile App
1. Build with EAS: `eas build --platform all`
2. Submit to stores: `eas submit`

### Backend
1. Build Docker image: `docker build -t ridepass-api .`
2. Deploy to cloud (AWS, GCP, DigitalOcean)
3. Set environment variables
4. Run migrations: `prisma migrate deploy`

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request
