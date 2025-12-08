# RidePass - Transport Platform with Supabase

A comprehensive transport platform for drivers to broadcast routes and accept QR payments, and for passengers to find nearby vehicles and pay seamlessly. **Powered by Supabase**.

## 🚀 Tech Stack

- **Mobile App**: React Native / Expo
- **Backend**: NestJS
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (Phone OTP)
- **Real-time**: Supabase Realtime
- **Storage**: Supabase Storage
- **ORM**: Prisma

## 📱 Features

### For Drivers
- ✅ Create account & verify ID
- ✅ Register & verify vehicle
- ✅ Go online/offline
- ✅ Broadcast live GPS location
- ✅ Select & broadcast route
- ✅ Accept/reject passengers
- ✅ Display QR code for payment
- ✅ View earnings & settlements

### For Passengers
- ✅ Register & verify identity
- ✅ See nearby vehicles on map
- ✅ View vehicle routes & destinations
- ✅ Pay via QR code scan
- ✅ Pay via wallet
- ✅ View ride history
- ✅ Share trip with family

### Safety Features (Mandatory)
- ✅ Driver ID verification
- ✅ Vehicle verification
- ✅ Emergency SOS button
- ✅ Guardian accounts for minors
- ✅ Real-time trip sharing
- ✅ Ratings & behaviour scores
- ✅ Zero cash handling

## 🏗 Project Structure

```
workspace/
├── app/                    # Mobile app screens (Expo Router)
│   ├── (commuter)/        # Passenger screens
│   └── (operator)/        # Driver screens
├── services/
│   ├── api.ts             # REST API client
│   └── supabase.ts        # Supabase client
├── backend/               # NestJS backend
│   ├── src/
│   │   ├── auth/         # Auth with Supabase
│   │   ├── drivers/      # Driver management
│   │   ├── wallet/       # QR payments
│   │   └── ...
│   └── prisma/
│       └── schema.prisma  # Database schema
└── types/                 # TypeScript types
```

## 🛠 Quick Start

### 1. Setup Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Enable **Phone Auth** in Authentication settings
3. Create storage buckets: `avatars`, `licences`, `vehicles`
4. Get credentials from Settings > API

### 2. Configure Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - DATABASE_URL (from Supabase)
# - JWT_SECRET (from Supabase)

# Push database schema
npx prisma generate
npx prisma db push

# Seed test data
npx prisma db seed

# Start server
npm run start:dev
```

### 3. Configure Mobile App

Create `.env` in workspace root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

```bash
# Install dependencies
bun install
# or
npm install --legacy-peer-deps

# Start app
bun run start-web
```

## 🔑 Environment Variables

### Backend (.env)

```env
# Supabase
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# JWT (use Supabase JWT secret)
JWT_SECRET="your-jwt-secret"

# Server
PORT=3000
NODE_ENV=development
```

### Mobile App (.env)

```env
EXPO_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## 📡 Real-time Location Tracking

### Driver (Broadcasting)

```typescript
import { supabaseRealtime } from '@/services/supabase';

// Broadcast location every 5 seconds
setInterval(async () => {
  const location = await Location.getCurrentPositionAsync();
  
  await supabaseRealtime.broadcastLocation({
    driverId: driver.id,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    speed: location.coords.speed,
    heading: location.coords.heading,
  });
}, 5000);
```

### Passenger (Listening)

```typescript
import { supabaseRealtime } from '@/services/supabase';

// Subscribe to all driver locations
supabaseRealtime.subscribeToDriverLocations((location) => {
  // Update map markers
  updateDriverMarker(location.driverId, location.lat, location.lng);
});
```

## 💰 Payment Flow

### Driver Generates QR

```typescript
// 1. Driver generates QR for fare
const qr = await walletApi.generateQr(1.50); // $1.50

// 2. Display qr.qrData (base64 image)
<Image source={{ uri: qr.qrData }} />
```

### Passenger Scans & Pays

```typescript
// 1. Scan QR code
const result = await BarCodeScanner.scanFromURLAsync(imageUri);

// 2. Pay via API
const payment = await walletApi.payViaQr(result.data);
// { success: true, amount: 1.50, driverName: "John" }
```

## 🧪 Test Accounts

After seeding the database:

| Role | Phone | Password | Balance |
|------|-------|----------|---------|
| Admin | +263770000000 | OTP | - |
| Passenger | +263771111111 | OTP | $50.00 |
| Driver | +263772222222 | OTP | $0.00 |

**Note**: In development, OTPs are logged to the console.

## 📚 API Documentation

Access Swagger docs at: `http://localhost:3000/api/docs`

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /auth/send-otp` | Send OTP to phone |
| `POST /auth/login` | Login with OTP |
| `GET /drivers/nearby` | Get nearby drivers |
| `PUT /drivers/location` | Update driver location |
| `GET /routes/active` | Get active routes |
| `POST /wallet/generate-qr` | Generate payment QR |
| `POST /wallet/pay-qr` | Pay via QR |
| `POST /safety/sos` | Trigger SOS alert |

## 🔒 Security

- **Row Level Security (RLS)**: Enabled on all Supabase tables
- **JWT Validation**: All API requests validated
- **Phone OTP**: Secure authentication
- **Service Role**: Backend uses service role key (never expose to client)

## 📦 Deployment

### Backend (Railway/Render)

1. Connect GitHub repo
2. Set environment variables
3. Deploy

### Mobile App (EAS)

```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Build for iOS/Android
eas build --platform all

# Submit to stores
eas submit
```

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Commit changes
4. Open pull request

## 📄 License

MIT
