-- ============================================
-- NDEIP-ZTHIN Complete Database Schema
-- Version: 2.0 - Uses Custom Auth (users table)
-- PRESERVES existing users and wallets!
-- ============================================

-- ============================================
-- STEP 1: DROP ONLY RIDE-RELATED TABLES
-- Keeps users and wallets intact!
-- ============================================

DROP TABLE IF EXISTS driver_locations CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS ride_requests CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS find_nearby_drivers(DECIMAL, DECIMAL, TEXT, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS update_driver_location(DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS get_ride_history(INTEGER, INTEGER) CASCADE;

-- ============================================
-- STEP 2: ENSURE USERS TABLE EXISTS
-- (Your existing table - won't recreate if exists)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'passenger' CHECK (role IN ('passenger', 'driver', 'admin')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: ENSURE WALLETS TABLE EXISTS
-- (Your existing table - won't recreate if exists)
-- ============================================

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(12, 2) DEFAULT 0.00,
    pending_balance DECIMAL(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    daily_topup_limit DECIMAL(12, 2) DEFAULT 10000.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- STEP 4: ENSURE TRANSACTIONS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    to_wallet_id UUID REFERENCES wallets(id),
    from_wallet_id UUID REFERENCES wallets(id),
    type TEXT NOT NULL CHECK (type IN ('topup', 'payment', 'transfer', 'refund', 'ride_payment', 'ride_earnings', 'withdrawal')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    amount DECIMAL(12, 2) NOT NULL,
    fee DECIMAL(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    reference TEXT UNIQUE,
    description TEXT,
    paynow_reference TEXT,
    paynow_poll_url TEXT,
    paynow_status TEXT,
    idempotency_key TEXT UNIQUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 5: CREATE DRIVERS TABLE
-- ============================================

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    profile_image_url TEXT,
    license_number TEXT,
    -- Status
    is_online BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    -- Location (simple lat/lng)
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    last_location_update TIMESTAMPTZ,
    -- Stats
    rating DECIMAL(3, 2) DEFAULT 5.00 CHECK (rating >= 1.00 AND rating <= 5.00),
    total_rides INTEGER DEFAULT 0,
    total_earnings DECIMAL(12, 2) DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 6: CREATE VEHICLES TABLE
-- ============================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sedan', 'suv', 'minivan', 'motorcycle')),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1990),
    color TEXT NOT NULL,
    registration_number TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 7: CREATE RIDE REQUESTS TABLE
-- ============================================

CREATE TABLE ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Locations
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_latitude DECIMAL(10, 8) NOT NULL,
    dropoff_longitude DECIMAL(11, 8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    -- Details
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sedan', 'suv', 'minivan', 'motorcycle')),
    estimated_distance DECIMAL(10, 2),
    estimated_duration INTEGER,
    estimated_price DECIMAL(10, 2) NOT NULL,
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matching', 'matched', 'cancelled', 'expired')),
    matched_driver_id UUID REFERENCES drivers(id),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
    matched_at TIMESTAMPTZ
);

-- ============================================
-- STEP 8: CREATE RIDES TABLE
-- ============================================

CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES ride_requests(id),
    user_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    -- Locations
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_latitude DECIMAL(10, 8) NOT NULL,
    dropoff_longitude DECIMAL(11, 8) NOT NULL,
    dropoff_address TEXT NOT NULL,
    -- Ride details
    vehicle_type TEXT NOT NULL,
    distance DECIMAL(10, 2),
    duration INTEGER,
    -- Pricing
    base_price DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2),
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    -- Status
    status TEXT DEFAULT 'driver_assigned' CHECK (status IN (
        'driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress', 'completed', 'cancelled'
    )),
    -- Payment
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    payment_method TEXT DEFAULT 'wallet',
    -- Driver location tracking
    driver_latitude DECIMAL(10, 8),
    driver_longitude DECIMAL(11, 8),
    driver_eta INTEGER,
    -- Ratings
    rider_rating INTEGER CHECK (rider_rating IS NULL OR (rider_rating >= 1 AND rider_rating <= 5)),
    driver_rating INTEGER CHECK (driver_rating IS NULL OR (driver_rating >= 1 AND driver_rating <= 5)),
    rider_review TEXT,
    driver_review TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    driver_arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT
);

-- ============================================
-- STEP 9: CREATE DRIVER LOCATIONS TABLE
-- ============================================

CREATE TABLE driver_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 10: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_drivers_online ON drivers(is_online, is_available);
CREATE INDEX idx_drivers_location ON drivers(current_latitude, current_longitude);
CREATE INDEX idx_drivers_user ON drivers(user_id);
CREATE INDEX idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX idx_ride_requests_status ON ride_requests(status, created_at);
CREATE INDEX idx_rides_user ON rides(user_id, created_at DESC);
CREATE INDEX idx_rides_driver ON rides(driver_id, created_at DESC);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_driver_locations_ride ON driver_locations(ride_id, recorded_at DESC);

-- ============================================
-- STEP 11: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 12: CREATE RLS POLICIES
-- Using permissive policies for custom auth
-- ============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Allow all for users" ON users;
DROP POLICY IF EXISTS "Allow all for wallets" ON wallets;
DROP POLICY IF EXISTS "Allow all for transactions" ON transactions;

-- Users - permissive for custom auth
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true);

-- Wallets - permissive for custom auth
CREATE POLICY "wallets_select" ON wallets FOR SELECT USING (true);
CREATE POLICY "wallets_insert" ON wallets FOR INSERT WITH CHECK (true);
CREATE POLICY "wallets_update_service" ON wallets FOR UPDATE USING (true);

-- Transactions
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "transactions_update_service" ON transactions FOR UPDATE USING (true);

-- Drivers
CREATE POLICY "drivers_select" ON drivers FOR SELECT USING (true);
CREATE POLICY "drivers_insert" ON drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "drivers_update" ON drivers FOR UPDATE USING (true);

-- Vehicles
CREATE POLICY "vehicles_select" ON vehicles FOR SELECT USING (true);
CREATE POLICY "vehicles_insert" ON vehicles FOR INSERT WITH CHECK (true);
CREATE POLICY "vehicles_update" ON vehicles FOR UPDATE USING (true);

-- Ride Requests
CREATE POLICY "ride_requests_select" ON ride_requests FOR SELECT USING (true);
CREATE POLICY "ride_requests_insert" ON ride_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "ride_requests_update" ON ride_requests FOR UPDATE USING (true);

-- Rides
CREATE POLICY "rides_select" ON rides FOR SELECT USING (true);
CREATE POLICY "rides_insert" ON rides FOR INSERT WITH CHECK (true);
CREATE POLICY "rides_update" ON rides FOR UPDATE USING (true);

-- Driver Locations
CREATE POLICY "driver_locations_select" ON driver_locations FOR SELECT USING (true);
CREATE POLICY "driver_locations_insert" ON driver_locations FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 13: CREATE FUNCTIONS
-- ============================================

-- Find nearby drivers
CREATE OR REPLACE FUNCTION find_nearby_drivers(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_vehicle_type TEXT,
    p_radius_km DECIMAL DEFAULT 10
)
RETURNS TABLE (
    driver_id UUID,
    first_name TEXT,
    last_name TEXT,
    rating DECIMAL,
    total_rides INTEGER,
    distance_km DECIMAL,
    vehicle_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.first_name,
        d.last_name,
        d.rating,
        d.total_rides,
        (6371 * acos(
            cos(radians(p_latitude)) * cos(radians(d.current_latitude)) *
            cos(radians(d.current_longitude) - radians(p_longitude)) +
            sin(radians(p_latitude)) * sin(radians(d.current_latitude))
        ))::DECIMAL AS distance_km,
        jsonb_build_object(
            'id', v.id,
            'type', v.type,
            'make', v.make,
            'model', v.model,
            'color', v.color,
            'registration_number', v.registration_number
        )
    FROM drivers d
    JOIN vehicles v ON v.driver_id = d.id AND v.is_active = true
    WHERE d.is_online = true 
        AND d.is_available = true
        AND v.type = p_vehicle_type
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND (6371 * acos(
            cos(radians(p_latitude)) * cos(radians(d.current_latitude)) *
            cos(radians(d.current_longitude) - radians(p_longitude)) +
            sin(radians(p_latitude)) * sin(radians(d.current_latitude))
        )) <= p_radius_km
    ORDER BY distance_km ASC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get ride history for a user
CREATE OR REPLACE FUNCTION get_ride_history(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
    ride_id UUID,
    pickup_address TEXT,
    dropoff_address TEXT,
    distance DECIMAL,
    duration INTEGER,
    final_price DECIMAL,
    status TEXT,
    driver_name TEXT,
    driver_rating DECIMAL,
    vehicle_info JSONB,
    created_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.pickup_address,
        r.dropoff_address,
        r.distance,
        r.duration,
        r.final_price,
        r.status,
        d.first_name || ' ' || d.last_name,
        d.rating,
        jsonb_build_object('make', v.make, 'model', v.model, 'color', v.color, 'registration_number', v.registration_number),
        r.created_at,
        r.completed_at
    FROM rides r
    JOIN drivers d ON r.driver_id = d.id
    LEFT JOIN vehicles v ON v.driver_id = d.id AND v.is_active = true
    WHERE r.user_id = p_user_id
    ORDER BY r.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 14: ENABLE REALTIME
-- ============================================

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE rides;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- VERIFY DATA IS PRESERVED
-- ============================================

SELECT 'Users count: ' || COUNT(*)::TEXT FROM users;
SELECT 'Wallets count: ' || COUNT(*)::TEXT FROM wallets;
SELECT 'Schema updated successfully! Your data is preserved.' AS message;
