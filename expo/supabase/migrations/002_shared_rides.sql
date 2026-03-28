-- ============================================
-- SHARED RIDES SYSTEM
-- inDrive-style carpooling model
-- Driver creates trip → Riders book seats → QR payment
-- ============================================

-- ============================================
-- STEP 1: DROP OLD RIDE TABLES
-- Keep users, wallets, transactions
-- ============================================

DROP TABLE IF EXISTS driver_locations CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS ride_requests CASCADE;

-- ============================================
-- STEP 2: ADD SUBSCRIPTION STATUS TO DRIVERS
-- ============================================

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' 
  CHECK (subscription_status IN ('inactive', 'active', 'expired'));
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- ============================================
-- STEP 3: CREATE TRIPS TABLE
-- A trip is created by a driver going somewhere
-- ============================================

CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    
    -- Route
    origin_latitude DECIMAL(10, 8) NOT NULL,
    origin_longitude DECIMAL(11, 8) NOT NULL,
    origin_address TEXT NOT NULL,
    destination_latitude DECIMAL(10, 8) NOT NULL,
    destination_longitude DECIMAL(11, 8) NOT NULL,
    destination_address TEXT NOT NULL,
    route_polyline TEXT, -- Encoded polyline for the route
    
    -- Trip details
    trip_type TEXT NOT NULL DEFAULT 'local' CHECK (trip_type IN ('local', 'long_distance')),
    total_seats INTEGER NOT NULL DEFAULT 4,
    available_seats INTEGER NOT NULL DEFAULT 4,
    
    -- Pricing (for local trips, single fare)
    base_fare DECIMAL(10, 2) NOT NULL,
    pickup_fee DECIMAL(10, 2) DEFAULT 0, -- Extra for pickup service
    dropoff_fee DECIMAL(10, 2) DEFAULT 0, -- Extra for door-to-door
    
    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',        -- Driver is setting up
        'scheduled',    -- Set for future time
        'active',       -- Currently accepting bookings
        'in_progress',  -- Trip has started
        'completed',    -- Trip finished
        'cancelled'     -- Trip cancelled
    )),
    
    -- Timing
    departure_time TIMESTAMPTZ, -- Scheduled departure (optional)
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Driver location during trip
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    last_location_update TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 4: CREATE TRIP WAYPOINTS TABLE
-- Stops along the route with optional different fares
-- ============================================

CREATE TABLE IF NOT EXISTS trip_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    
    -- Location
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT NOT NULL,
    
    -- Order in the route (0 = first stop after origin)
    waypoint_order INTEGER NOT NULL,
    
    -- Fare to this waypoint (for long-distance variable pricing)
    fare_to_here DECIMAL(10, 2), -- Null means use base_fare
    
    -- Timing
    estimated_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(trip_id, waypoint_order)
);

-- ============================================
-- STEP 5: CREATE BOOKINGS TABLE
-- Riders book seats on trips
-- ============================================

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Booking details
    seats_booked INTEGER NOT NULL DEFAULT 1,
    
    -- Pickup/Dropoff
    pickup_type TEXT NOT NULL DEFAULT 'at_origin' CHECK (pickup_type IN ('at_origin', 'custom_pickup')),
    pickup_latitude DECIMAL(10, 8),
    pickup_longitude DECIMAL(11, 8),
    pickup_address TEXT,
    
    dropoff_type TEXT NOT NULL DEFAULT 'at_destination' CHECK (dropoff_type IN ('at_destination', 'at_waypoint', 'custom_dropoff')),
    dropoff_waypoint_id UUID REFERENCES trip_waypoints(id),
    dropoff_latitude DECIMAL(10, 8),
    dropoff_longitude DECIMAL(11, 8),
    dropoff_address TEXT,
    
    -- Pricing
    base_amount DECIMAL(10, 2) NOT NULL, -- Fare for the ride
    pickup_fee DECIMAL(10, 2) DEFAULT 0, -- If custom pickup requested
    dropoff_fee DECIMAL(10, 2) DEFAULT 0, -- If custom dropoff requested
    total_amount DECIMAL(10, 2) NOT NULL, -- base + fees
    
    -- Platform fees
    rider_fee DECIMAL(10, 2) DEFAULT 0, -- 2.5% of total
    driver_fee DECIMAL(10, 2) DEFAULT 0, -- 7.5% of total
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Waiting for driver approval
        'confirmed',    -- Driver accepted
        'picked_up',    -- Rider is in vehicle
        'completed',    -- Ride finished, paid
        'cancelled',    -- Cancelled by either party
        'no_show'       -- Rider didn't show up
    )),
    
    -- Payment
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'paid', 'refunded', 'failed'
    )),
    qr_code_token TEXT UNIQUE, -- Token for QR code payment
    qr_scanned_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id)
);

-- ============================================
-- STEP 6: CREATE QR PAYMENTS TABLE
-- Records of QR code scans and payments
-- ============================================

CREATE TABLE IF NOT EXISTS qr_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Amounts
    total_amount DECIMAL(10, 2) NOT NULL,
    rider_fee DECIMAL(10, 2) NOT NULL, -- 2.5%
    driver_fee DECIMAL(10, 2) NOT NULL, -- 7.5%
    platform_revenue DECIMAL(10, 2) NOT NULL, -- rider_fee + driver_fee
    driver_payout DECIMAL(10, 2) NOT NULL, -- total - driver_fee
    
    -- Wallets affected
    rider_wallet_id UUID REFERENCES wallets(id),
    driver_wallet_id UUID REFERENCES wallets(id),
    
    -- Transaction records
    rider_transaction_id UUID REFERENCES transactions(id),
    driver_transaction_id UUID REFERENCES transactions(id),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- ============================================
-- STEP 7: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_active ON trips(status) WHERE status IN ('active', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_trips_location ON trips(origin_latitude, origin_longitude);
CREATE INDEX IF NOT EXISTS idx_trips_destination ON trips(destination_latitude, destination_longitude);

CREATE INDEX IF NOT EXISTS idx_waypoints_trip ON trip_waypoints(trip_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_order ON trip_waypoints(trip_id, waypoint_order);

CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings(rider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_qr ON bookings(qr_code_token);

CREATE INDEX IF NOT EXISTS idx_qr_payments_booking ON qr_payments(booking_id);

-- ============================================
-- STEP 8: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 9: CREATE RLS POLICIES
-- ============================================

-- Trips policies
CREATE POLICY "trips_select" ON trips FOR SELECT USING (true);
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (true);
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (true);
CREATE POLICY "trips_delete" ON trips FOR DELETE USING (true);

-- Waypoints policies
CREATE POLICY "waypoints_select" ON trip_waypoints FOR SELECT USING (true);
CREATE POLICY "waypoints_insert" ON trip_waypoints FOR INSERT WITH CHECK (true);
CREATE POLICY "waypoints_update" ON trip_waypoints FOR UPDATE USING (true);
CREATE POLICY "waypoints_delete" ON trip_waypoints FOR DELETE USING (true);

-- Bookings policies
CREATE POLICY "bookings_select" ON bookings FOR SELECT USING (true);
CREATE POLICY "bookings_insert" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings_update" ON bookings FOR UPDATE USING (true);

-- QR Payments policies
CREATE POLICY "qr_payments_select" ON qr_payments FOR SELECT USING (true);
CREATE POLICY "qr_payments_insert" ON qr_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "qr_payments_update" ON qr_payments FOR UPDATE USING (true);

-- ============================================
-- STEP 10: CREATE FUNCTIONS
-- ============================================

-- Function to find trips going towards a destination
CREATE OR REPLACE FUNCTION find_trips_by_direction(
    p_origin_lat DECIMAL,
    p_origin_lng DECIMAL,
    p_dest_lat DECIMAL,
    p_dest_lng DECIMAL,
    p_radius_km DECIMAL DEFAULT 5
)
RETURNS TABLE (
    trip_id UUID,
    driver_name TEXT,
    driver_rating DECIMAL,
    origin_address TEXT,
    destination_address TEXT,
    base_fare DECIMAL,
    available_seats INTEGER,
    departure_time TIMESTAMPTZ,
    distance_to_origin_km DECIMAL,
    vehicle_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        d.first_name || ' ' || d.last_name,
        d.rating,
        t.origin_address,
        t.destination_address,
        t.base_fare,
        t.available_seats,
        t.departure_time,
        (6371 * acos(
            cos(radians(p_origin_lat)) * cos(radians(t.origin_latitude)) *
            cos(radians(t.origin_longitude) - radians(p_origin_lng)) +
            sin(radians(p_origin_lat)) * sin(radians(t.origin_latitude))
        ))::DECIMAL AS distance_to_origin_km,
        jsonb_build_object(
            'id', v.id,
            'type', v.type,
            'make', v.make,
            'model', v.model,
            'color', v.color,
            'registration_number', v.registration_number
        )
    FROM trips t
    JOIN drivers d ON t.driver_id = d.id
    JOIN vehicles v ON t.vehicle_id = v.id
    WHERE t.status = 'active'
        AND t.available_seats > 0
        -- Trip origin is within radius of rider's origin
        AND (6371 * acos(
            cos(radians(p_origin_lat)) * cos(radians(t.origin_latitude)) *
            cos(radians(t.origin_longitude) - radians(p_origin_lng)) +
            sin(radians(p_origin_lat)) * sin(radians(t.origin_latitude))
        )) <= p_radius_km
        -- Trip is going towards rider's destination (angle check)
        AND (
            -- Calculate if trip direction is similar to rider's direction
            -- Using dot product of direction vectors
            ((t.destination_latitude - t.origin_latitude) * (p_dest_lat - p_origin_lat) +
             (t.destination_longitude - t.origin_longitude) * (p_dest_lng - p_origin_lng)) > 0
        )
    ORDER BY distance_to_origin_km ASC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate QR token
CREATE OR REPLACE FUNCTION generate_booking_qr_token(p_booking_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
BEGIN
    -- Generate unique token
    v_token := 'QR-' || UPPER(SUBSTRING(MD5(p_booking_id::TEXT || NOW()::TEXT || RANDOM()::TEXT) FROM 1 FOR 12));
    
    -- Update booking with token
    UPDATE bookings SET qr_code_token = v_token WHERE id = p_booking_id;
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process QR payment
CREATE OR REPLACE FUNCTION process_qr_payment(p_qr_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_booking bookings%ROWTYPE;
    v_rider_wallet wallets%ROWTYPE;
    v_driver_wallet wallets%ROWTYPE;
    v_driver drivers%ROWTYPE;
    v_total DECIMAL;
    v_rider_fee DECIMAL;
    v_driver_fee DECIMAL;
    v_driver_payout DECIMAL;
    v_result JSONB;
BEGIN
    -- Get booking by QR token
    SELECT * INTO v_booking FROM bookings WHERE qr_code_token = p_qr_token;
    
    IF v_booking.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code');
    END IF;
    
    IF v_booking.payment_status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already paid');
    END IF;
    
    IF v_booking.status != 'confirmed' AND v_booking.status != 'picked_up' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking not confirmed');
    END IF;
    
    -- Calculate fees
    v_total := v_booking.total_amount;
    v_rider_fee := ROUND(v_total * 0.025, 2); -- 2.5%
    v_driver_fee := ROUND(v_total * 0.075, 2); -- 7.5%
    v_driver_payout := v_total - v_driver_fee;
    
    -- Get rider wallet
    SELECT * INTO v_rider_wallet FROM wallets WHERE user_id = v_booking.rider_id;
    
    IF v_rider_wallet.balance < (v_total + v_rider_fee) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 
            'required', v_total + v_rider_fee, 'available', v_rider_wallet.balance);
    END IF;
    
    -- Get driver info and wallet
    SELECT d.* INTO v_driver FROM drivers d
    JOIN trips t ON t.driver_id = d.id
    WHERE t.id = v_booking.trip_id;
    
    SELECT * INTO v_driver_wallet FROM wallets WHERE user_id = v_driver.user_id;
    
    -- Deduct from rider (total + rider fee)
    UPDATE wallets 
    SET balance = balance - (v_total + v_rider_fee), updated_at = NOW()
    WHERE id = v_rider_wallet.id;
    
    -- Credit driver (total - driver fee)
    UPDATE wallets 
    SET balance = balance + v_driver_payout, updated_at = NOW()
    WHERE id = v_driver_wallet.id;
    
    -- Create transaction for rider
    INSERT INTO transactions (user_id, type, amount, status, reference, description)
    VALUES (v_booking.rider_id, 'ride_payment', v_total + v_rider_fee, 'completed',
            'RIDE-' || UPPER(SUBSTRING(v_booking.id::TEXT FROM 1 FOR 8)),
            'Ride payment');
    
    -- Create transaction for driver
    INSERT INTO transactions (user_id, type, amount, status, reference, description)
    VALUES (v_driver.user_id, 'ride_earnings', v_driver_payout, 'completed',
            'EARN-' || UPPER(SUBSTRING(v_booking.id::TEXT FROM 1 FOR 8)),
            'Ride earnings');
    
    -- Update booking
    UPDATE bookings 
    SET status = 'completed', 
        payment_status = 'paid',
        rider_fee = v_rider_fee,
        driver_fee = v_driver_fee,
        qr_scanned_at = NOW(),
        paid_at = NOW()
    WHERE id = v_booking.id;
    
    -- Update trip available seats
    UPDATE trips 
    SET available_seats = available_seats + v_booking.seats_booked
    WHERE id = v_booking.trip_id;
    
    -- Create QR payment record
    INSERT INTO qr_payments (booking_id, total_amount, rider_fee, driver_fee, 
        platform_revenue, driver_payout, rider_wallet_id, driver_wallet_id, status, processed_at)
    VALUES (v_booking.id, v_total, v_rider_fee, v_driver_fee,
        v_rider_fee + v_driver_fee, v_driver_payout, v_rider_wallet.id, v_driver_wallet.id, 
        'completed', NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking.id,
        'amount_paid', v_total + v_rider_fee,
        'driver_received', v_driver_payout,
        'rider_fee', v_rider_fee,
        'driver_fee', v_driver_fee
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 11: ENABLE REALTIME
-- ============================================

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE trips;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DONE!
-- ============================================

SELECT 'Shared rides schema created successfully!' AS message;

