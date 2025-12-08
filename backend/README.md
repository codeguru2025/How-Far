# RidePass Backend API

A comprehensive NestJS backend for the RidePass transport platform with real-time location tracking, QR payments, and safety features.

## 🚀 Features

- **Authentication**: Phone + OTP based authentication with JWT
- **User Management**: Passengers, Drivers, and Admin roles
- **Driver Verification**: ID and licence verification workflow
- **Vehicle Management**: Vehicle registration and verification
- **Route Broadcasting**: Drivers broadcast their routes with polylines
- **Live Location**: Real-time GPS tracking via WebSockets
- **Ride Management**: Request, accept, track, and complete rides
- **Wallet System**: Top-up, QR payments, and transfers
- **Settlements**: Automated daily/weekly/monthly driver settlements
- **Safety Features**: SOS alerts, safety reports, behaviour scores
- **Admin Panel**: Dashboard, analytics, and system management

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (optional, for caching)
- Docker & Docker Compose (optional)

## 🛠 Installation

### Option 1: Local Development

1. **Clone and install dependencies**
```bash
cd backend
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Set up the database**
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database with test data
npx prisma db seed
```

4. **Start development server**
```bash
npm run start:dev
```

### Option 2: Docker

```bash
# Start all services (PostgreSQL, Redis, API)
docker-compose up -d

# Run migrations
docker-compose exec api npx prisma migrate deploy

# Seed database
docker-compose exec api npx prisma db seed
```

## 📚 API Documentation

Once running, access the Swagger documentation at:
- http://localhost:3000/api/docs

## 🗂 Project Structure

```
backend/
├── src/
│   ├── auth/           # Authentication module
│   ├── users/          # User management
│   ├── drivers/        # Driver profiles & verification
│   ├── vehicles/       # Vehicle management
│   ├── routes/         # Route broadcasting
│   ├── rides/          # Ride lifecycle
│   ├── wallet/         # Wallet & QR payments
│   ├── transactions/   # Transaction history
│   ├── settlements/    # Driver settlements
│   ├── safety/         # SOS & safety reports
│   ├── notifications/  # Push notifications
│   ├── admin/          # Admin panel
│   ├── websockets/     # Real-time location
│   └── common/         # Shared utilities
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.ts         # Seed data
├── docker-compose.yml
└── Dockerfile
```

## 🔌 WebSocket Events

Connect to `/location` namespace:

### Driver Events
- `driver:connect` - Register driver connection
- `location:update` - Broadcast location update

### Passenger Events
- `subscribe:driver` - Subscribe to specific driver
- `subscribe:all-drivers` - Subscribe to all online drivers
- `get:all-drivers` - Get current online drivers

### Server Events
- `location:updated` - Location update from subscribed driver
- `driver:location` - Broadcast from any driver

## 🧪 Test Accounts

After seeding:

| Role | Phone | Description |
|------|-------|-------------|
| Admin | +263770000000 | System administrator |
| Passenger | +263771111111 | Test passenger with $50 balance |
| Driver | +263772222222 | Verified driver with vehicle |

## 📱 API Endpoints Overview

### Authentication
- `POST /api/v1/auth/send-otp` - Send OTP
- `POST /api/v1/auth/login` - Login with OTP
- `POST /api/v1/auth/register` - Register new user

### Drivers
- `POST /api/v1/drivers/profile` - Create driver profile
- `PUT /api/v1/drivers/status` - Go online/offline
- `PUT /api/v1/drivers/location` - Update location
- `GET /api/v1/drivers/nearby` - Get nearby drivers

### Routes
- `POST /api/v1/routes` - Create route
- `GET /api/v1/routes/active` - Get active routes
- `GET /api/v1/routes/nearby` - Get nearby routes

### Rides
- `POST /api/v1/rides/request` - Request ride
- `PUT /api/v1/rides/:id/respond` - Accept/reject
- `PUT /api/v1/rides/:id/status` - Update status
- `POST /api/v1/rides/:id/share` - Share trip link

### Wallet
- `GET /api/v1/wallet` - Get wallet details
- `POST /api/v1/wallet/top-up` - Top up wallet
- `POST /api/v1/wallet/generate-qr` - Generate QR (Driver)
- `POST /api/v1/wallet/pay-qr` - Pay via QR (Passenger)

### Safety
- `POST /api/v1/safety/sos` - Trigger SOS
- `POST /api/v1/safety/report` - Submit report

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | - |
| JWT_SECRET | JWT signing secret | - |
| JWT_REFRESH_SECRET | Refresh token secret | - |
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development |

## 📦 Scripts

```bash
npm run start:dev    # Development with hot reload
npm run start:prod   # Production
npm run build        # Build for production
npm run lint         # Lint code
npm run test         # Run tests
npm run prisma:studio # Open Prisma Studio
```

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

## 📄 License

MIT
