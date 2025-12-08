# RidePass Backend API (Supabase Edition)

A comprehensive NestJS backend for the RidePass transport platform, integrated with **Supabase** for database, authentication, storage, and real-time features.

## 🚀 Features

- **Supabase PostgreSQL** - Managed database with automatic backups
- **Supabase Auth** - Phone OTP authentication
- **Supabase Realtime** - Live location tracking
- **Supabase Storage** - Image uploads (IDs, licences, vehicles)
- **NestJS API** - Type-safe REST API with Swagger docs

## 📋 Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned

### 2. Get Your Credentials

From your Supabase Dashboard:

1. **Settings > API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT Secret` → `JWT_SECRET`

2. **Settings > Database**:
   - `Connection string (URI)` → `DATABASE_URL`
   - Use `Transaction pooler` for `DATABASE_URL`
   - Use `Session pooler` for `DIRECT_URL`

### 3. Enable Phone Auth

1. Go to **Authentication > Providers**
2. Enable **Phone** provider
3. Configure your SMS provider (Twilio, MessageBird, etc.)

### 4. Create Storage Buckets

Go to **Storage** and create these buckets:

| Bucket | Public | Description |
|--------|--------|-------------|
| `avatars` | Yes | User profile pictures |
| `licences` | No | Driver licence images |
| `vehicles` | Yes | Vehicle images |
| `evidence` | No | Safety report evidence |

### 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
# Supabase
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
JWT_SECRET="your-jwt-secret"
```

## 🛠 Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to Supabase (creates tables)
npx prisma db push

# OR run migrations
npx prisma migrate deploy

# Seed database with test data
npx prisma db seed

# Start development server
npm run start:dev
```

## 📡 Real-time Location (Supabase Realtime)

### Enable Realtime

1. Go to **Database > Replication**
2. Enable replication for `LiveLocation` table
3. Optionally enable for `Ride` table for status updates

### Driver Broadcasting Location

```typescript
// Driver broadcasts location
const channel = supabase.channel('driver-locations');

await channel.send({
  type: 'broadcast',
  event: 'location-update',
  payload: {
    driverId: 'driver-id',
    lat: -17.8292,
    lng: 31.0522,
    speed: 45,
    heading: 90,
  },
});
```

### Passenger Listening to Locations

```typescript
// Passenger subscribes to driver locations
supabase
  .channel('driver-locations')
  .on('broadcast', { event: 'location-update' }, ({ payload }) => {
    console.log('Driver location:', payload);
    // Update map marker
  })
  .subscribe();
```

## 🗄 Database Schema

The schema is defined in `prisma/schema.prisma` and includes:

- **Users** - All users with role-based access
- **Drivers** - Driver profiles with verification
- **Vehicles** - Registered vehicles
- **Routes** - Broadcasted routes with polylines
- **LiveLocation** - Real-time GPS data
- **Rides** - Complete ride lifecycle
- **Wallet** - User wallet balances
- **Transactions** - Payment history
- **Settlements** - Driver payouts
- **SafetyReports** - Safety incident reports

### Optional: PostGIS Extension

For better location queries, enable PostGIS:

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create function for nearby drivers
CREATE OR REPLACE FUNCTION get_nearby_drivers(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 5
)
RETURNS TABLE (
  driver_id UUID,
  distance_km FLOAT,
  lat FLOAT,
  lng FLOAT
)
LANGUAGE sql
AS $$
  SELECT 
    ll."driverId" as driver_id,
    (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(ll.lat)) *
        cos(radians(ll.lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(ll.lat))
      )
    ) as distance_km,
    ll.lat,
    ll.lng
  FROM "LiveLocation" ll
  JOIN "Driver" d ON d.id = ll."driverId"
  WHERE d.status = 'ONLINE'
  HAVING distance_km <= radius_km
  ORDER BY distance_km;
$$;
```

## 📱 Mobile App Integration

### Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### Configure Environment

Create `.env` in the mobile app root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## 🔐 Row Level Security (RLS)

Supabase uses RLS for security. Example policies:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own data"
ON "User"
FOR SELECT
USING (auth.uid() = "supabaseId"::uuid);

-- Drivers can update their own location
CREATE POLICY "Drivers can update own location"
ON "LiveLocation"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "Driver" d
    JOIN "User" u ON u.id = d."userId"
    WHERE d.id = "LiveLocation"."driverId"
    AND u."supabaseId"::uuid = auth.uid()
  )
);
```

## 📚 API Documentation

Access Swagger docs at: `http://localhost:3000/api/docs`

## 🧪 Test Accounts

After seeding:

| Role | Phone | Description |
|------|-------|-------------|
| Admin | +263770000000 | System admin |
| Passenger | +263771111111 | Test passenger ($50) |
| Driver | +263772222222 | Verified driver |

## 📦 Deployment

### Deploy to Railway/Render/Fly.io

1. Connect your repo
2. Set environment variables
3. Deploy

### Database Migrations

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy
```

## 🔧 Useful Commands

```bash
# Prisma Studio (database UI)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to DB (dev only)
npx prisma db push

# Reset database
npx prisma migrate reset
```

## 📄 License

MIT
