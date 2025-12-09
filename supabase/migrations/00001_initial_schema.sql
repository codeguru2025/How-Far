-- ============================================
-- Ndeip - Zthin Database Schema
-- Version: 1.0.0
-- Phone + Password Authentication Only
-- PayNow Integration for Payments
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM TYPES (Create only if not exists)
-- ============================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_verification', 'deactivated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('topup', 'ride_payment', 'refund', 'settlement', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'reconciling');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('sedan', 'suv', 'minivan', 'motorcycle', 'bicycle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE settlement_status AS ENUM ('pending', 'processing', 'processed', 'failed', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sos_status AS ENUM ('active', 'resolved', 'false_alarm', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- USERS TABLE (Phone-based Authentication)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL UNIQUE, -- E.164 format, primary auth identifier
    phone_verified BOOLEAN DEFAULT FALSE,
    email VARCHAR(255), -- Optional, not used for auth
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hashed
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    date_of_birth DATE,
    
    -- Role & Status
    role user_role DEFAULT 'passenger',
    status user_status DEFAULT 'active',
    
    -- Settings
    preferred_language VARCHAR(10) DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{"sms": true, "push": true}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT phone_e164_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- PASSWORD RESET TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- SHA256 hash of the token
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Rate limiting
    attempt_count INTEGER DEFAULT 0,
    
    CONSTRAINT token_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

-- ============================================
-- USER SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- WALLETS
-- ============================================

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'ZWL', -- Zimbabwe Dollar or USD
    pending_balance DECIMAL(15, 2) DEFAULT 0.00, -- For drivers awaiting settlement
    
    -- Limits
    daily_topup_limit DECIMAL(15, 2) DEFAULT 1000.00,
    daily_spend_limit DECIMAL(15, 2) DEFAULT 500.00,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT positive_pending CHECK (pending_balance >= 0)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- ============================================
-- TRANSACTIONS (All Financial)
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parties
    from_wallet_id UUID REFERENCES wallets(id),
    to_wallet_id UUID REFERENCES wallets(id),
    user_id UUID NOT NULL REFERENCES users(id), -- Primary user for the transaction
    
    -- Transaction details
    type transaction_type NOT NULL,
    status transaction_status DEFAULT 'pending',
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ZWL',
    fee DECIMAL(15, 2) DEFAULT 0.00,
    net_amount DECIMAL(15, 2) GENERATED ALWAYS AS (amount - fee) STORED,
    
    -- References
    reference VARCHAR(100) UNIQUE, -- Internal reference
    external_reference VARCHAR(100), -- PayNow or other external reference
    ride_id UUID, -- If this is a ride payment
    
    -- PayNow specific
    paynow_reference VARCHAR(100),
    paynow_poll_url TEXT,
    paynow_status VARCHAR(50),
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Idempotency
    idempotency_key VARCHAR(100) UNIQUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT positive_amount CHECK (amount > 0),
    CONSTRAINT valid_fee CHECK (fee >= 0 AND fee <= amount)
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_transactions_paynow_ref ON transactions(paynow_reference);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ============================================
-- DRIVERS
-- ============================================

CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- License
    license_number VARCHAR(50) NOT NULL,
    license_expiry DATE NOT NULL,
    license_verified BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT FALSE,
    current_location GEOGRAPHY(POINT, 4326),
    last_location_update TIMESTAMPTZ,
    
    -- Ratings
    rating_average DECIMAL(3, 2) DEFAULT 5.00,
    rating_count INTEGER DEFAULT 0,
    total_rides INTEGER DEFAULT 0,
    
    -- QR Code
    qr_code_data TEXT, -- Encrypted QR payload
    qr_session_token VARCHAR(255), -- Current session token for QR
    qr_session_expires TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_rating CHECK (rating_average >= 1.00 AND rating_average <= 5.00)
);

CREATE INDEX idx_drivers_user ON drivers(user_id);
CREATE INDEX idx_drivers_online ON drivers(is_online, is_available);
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location);

-- ============================================
-- DRIVER BANK DETAILS (Encrypted)
-- ============================================

CREATE TABLE IF NOT EXISTS driver_bank_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
    
    -- Encrypted fields (AES-256-GCM)
    -- These store: {iv}:{ciphertext}:{auth_tag} in base64
    bank_name_encrypted TEXT NOT NULL,
    account_number_encrypted TEXT NOT NULL,
    account_holder_name_encrypted TEXT NOT NULL,
    branch_code_encrypted TEXT NOT NULL,
    
    -- Non-sensitive metadata
    country VARCHAR(3) DEFAULT 'ZWE', -- ISO 3166-1 alpha-3
    currency VARCHAR(3) DEFAULT 'ZWL',
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_details_driver ON driver_bank_details(driver_id);

-- ============================================
-- VEHICLES
-- ============================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    
    -- Vehicle info
    type vehicle_type NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(50) NOT NULL,
    
    -- Registration
    registration_number VARCHAR(20) NOT NULL UNIQUE,
    registration_expiry DATE,
    
    -- Capacity
    passenger_capacity INTEGER DEFAULT 4,
    
    -- Insurance
    insurance_policy_number VARCHAR(100),
    insurance_expiry DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- Photos
    photo_urls TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_year CHECK (year >= 1990 AND year <= EXTRACT(YEAR FROM NOW()) + 1)
);

CREATE INDEX idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX idx_vehicles_registration ON vehicles(registration_number);

-- ============================================
-- RIDES
-- ============================================

CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parties
    passenger_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID REFERENCES drivers(id),
    vehicle_id UUID REFERENCES vehicles(id),
    
    -- Status
    status ride_status DEFAULT 'requested',
    
    -- Locations
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address TEXT,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_address TEXT,
    
    -- Route
    route_polyline TEXT, -- Encoded polyline
    estimated_distance_km DECIMAL(10, 2),
    actual_distance_km DECIMAL(10, 2),
    
    -- Timing
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    pickup_at TIMESTAMPTZ,
    dropoff_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Fare
    estimated_fare DECIMAL(15, 2),
    actual_fare DECIMAL(15, 2),
    fare_breakdown JSONB, -- {base, distance, time, surge, etc.}
    currency VARCHAR(3) DEFAULT 'ZWL',
    
    -- Payment
    payment_method VARCHAR(20) DEFAULT 'wallet',
    payment_transaction_id UUID REFERENCES transactions(id),
    is_paid BOOLEAN DEFAULT FALSE,
    
    -- Rating
    passenger_rating INTEGER,
    driver_rating INTEGER,
    passenger_feedback TEXT,
    driver_feedback TEXT,
    
    -- Safety
    is_shared_trip BOOLEAN DEFAULT FALSE,
    shared_trip_url TEXT,
    guardian_notified BOOLEAN DEFAULT FALSE,
    
    -- Cancellation
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(15, 2),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_rating_passenger CHECK (passenger_rating IS NULL OR (passenger_rating >= 1 AND passenger_rating <= 5)),
    CONSTRAINT valid_rating_driver CHECK (driver_rating IS NULL OR (driver_rating >= 1 AND driver_rating <= 5))
);

CREATE INDEX idx_rides_passenger ON rides(passenger_id);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created ON rides(created_at DESC);
CREATE INDEX idx_rides_pickup ON rides USING GIST(pickup_location);

-- ============================================
-- SETTLEMENTS (Driver Payouts)
-- ============================================

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Driver
    driver_id UUID NOT NULL REFERENCES drivers(id),
    
    -- Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Amounts
    gross_amount DECIMAL(15, 2) NOT NULL,
    fees DECIMAL(15, 2) DEFAULT 0.00,
    net_amount DECIMAL(15, 2) GENERATED ALWAYS AS (gross_amount - fees) STORED,
    currency VARCHAR(3) DEFAULT 'ZWL',
    
    -- Status
    status settlement_status DEFAULT 'pending',
    
    -- Bank details snapshot (encrypted, at time of settlement)
    bank_details_snapshot TEXT, -- Encrypted copy of bank details
    
    -- Processing
    batch_id VARCHAR(100), -- For grouping settlements
    export_generated_at TIMESTAMPTZ,
    export_file_url TEXT,
    
    -- Confirmation
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    
    -- Metadata
    transaction_count INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT positive_gross CHECK (gross_amount >= 0)
);

CREATE INDEX idx_settlements_driver ON settlements(driver_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_period ON settlements(period_start, period_end);
CREATE INDEX idx_settlements_batch ON settlements(batch_id);

-- ============================================
-- GUARDIANS (Safety Feature)
-- ============================================

CREATE TABLE IF NOT EXISTS guardians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Guardian info
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    relationship VARCHAR(50),
    
    -- Consent (for minors)
    is_primary BOOLEAN DEFAULT FALSE,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_given_at TIMESTAMPTZ,
    
    -- Notifications
    notify_on_ride_start BOOLEAN DEFAULT TRUE,
    notify_on_ride_end BOOLEAN DEFAULT TRUE,
    notify_on_sos BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT guardian_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

CREATE INDEX idx_guardians_user ON guardians(user_id);
CREATE UNIQUE INDEX idx_guardians_primary ON guardians(user_id) WHERE is_primary = TRUE;

-- ============================================
-- SOS ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS sos_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Alert source
    user_id UUID NOT NULL REFERENCES users(id),
    ride_id UUID REFERENCES rides(id),
    
    -- Location
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT,
    
    -- Status
    status sos_status DEFAULT 'active',
    
    -- Response
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    
    -- Notifications sent
    guardians_notified BOOLEAN DEFAULT FALSE,
    emergency_services_notified BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_sos_user ON sos_alerts(user_id);
CREATE INDEX idx_sos_status ON sos_alerts(status);
CREATE INDEX idx_sos_created ON sos_alerts(created_at DESC);

-- ============================================
-- TRIP SHARES
-- ============================================

CREATE TABLE IF NOT EXISTS trip_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    
    -- Share token
    share_token VARCHAR(100) NOT NULL UNIQUE,
    
    -- Access
    shared_with_phone VARCHAR(20),
    shared_with_email VARCHAR(255),
    
    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trip_shares_ride ON trip_shares(ride_id);
CREATE INDEX idx_trip_shares_token ON trip_shares(share_token);

-- ============================================
-- FARE RULES
-- ============================================

CREATE TABLE IF NOT EXISTS fare_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scope
    vehicle_type vehicle_type NOT NULL,
    city VARCHAR(100),
    country VARCHAR(3) DEFAULT 'ZWE',
    
    -- Base fare
    base_fare DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ZWL',
    
    -- Distance
    per_km_rate DECIMAL(15, 2) NOT NULL,
    min_distance_km DECIMAL(5, 2) DEFAULT 0,
    
    -- Time
    per_minute_rate DECIMAL(15, 2) DEFAULT 0,
    
    -- Surge
    surge_multiplier_max DECIMAL(3, 2) DEFAULT 3.00,
    
    -- Minimum fare
    minimum_fare DECIMAL(15, 2) NOT NULL,
    
    -- Cancellation
    cancellation_fee DECIMAL(15, 2) DEFAULT 0,
    free_cancellation_minutes INTEGER DEFAULT 5,
    
    -- Active period
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fare_rules_vehicle ON fare_rules(vehicle_type);
CREATE INDEX idx_fare_rules_active ON fare_rules(is_active);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Actor
    user_id UUID REFERENCES users(id),
    
    -- Action
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_bank_details_updated_at BEFORE UPDATE ON driver_bank_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardians_updated_at BEFORE UPDATE ON guardians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sos_alerts_updated_at BEFORE UPDATE ON sos_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fare_rules_updated_at BEFORE UPDATE ON fare_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create wallet for new user
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (NEW.id, 0.00, 'ZWL');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_wallet_on_user_insert
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_wallet();

-- Function to generate unique reference
CREATE OR REPLACE FUNCTION generate_transaction_reference()
RETURNS TEXT AS $$
DECLARE
    ref TEXT;
BEGIN
    ref := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all users" ON users
    FOR ALL USING (auth.role() = 'service_role');

-- Wallets policies
CREATE POLICY "Users can view own wallet" ON wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage wallets" ON wallets
    FOR ALL USING (auth.role() = 'service_role');

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Drivers policies
CREATE POLICY "Drivers can view own profile" ON drivers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update own profile" ON drivers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view online drivers" ON drivers
    FOR SELECT USING (is_online = TRUE AND is_available = TRUE);

CREATE POLICY "Service role can manage drivers" ON drivers
    FOR ALL USING (auth.role() = 'service_role');

-- Driver bank details policies (STRICT - only service role and owner)
CREATE POLICY "Drivers can view own bank details" ON driver_bank_details
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_bank_details.driver_id AND drivers.user_id = auth.uid())
    );

CREATE POLICY "Drivers can insert own bank details" ON driver_bank_details
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_bank_details.driver_id AND drivers.user_id = auth.uid())
    );

CREATE POLICY "Drivers can update own bank details" ON driver_bank_details
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_bank_details.driver_id AND drivers.user_id = auth.uid())
    );

CREATE POLICY "Service role can manage bank details" ON driver_bank_details
    FOR ALL USING (auth.role() = 'service_role');

-- Vehicles policies
CREATE POLICY "Drivers can manage own vehicles" ON vehicles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM drivers WHERE drivers.id = vehicles.driver_id AND drivers.user_id = auth.uid())
    );

CREATE POLICY "Anyone can view active vehicles" ON vehicles
    FOR SELECT USING (is_active = TRUE);

-- Rides policies
CREATE POLICY "Users can view own rides as passenger" ON rides
    FOR SELECT USING (auth.uid() = passenger_id);

CREATE POLICY "Drivers can view assigned rides" ON rides
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM drivers WHERE drivers.id = rides.driver_id AND drivers.user_id = auth.uid())
    );

CREATE POLICY "Service role can manage rides" ON rides
    FOR ALL USING (auth.role() = 'service_role');

-- Settlements policies (drivers can only view, not modify)
CREATE POLICY "Drivers can view own settlements" ON settlements
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM drivers WHERE drivers.id = settlements.driver_id AND drivers.user_id = auth.uid())
    );

CREATE POLICY "Service role can manage settlements" ON settlements
    FOR ALL USING (auth.role() = 'service_role');

-- Guardians policies
CREATE POLICY "Users can manage own guardians" ON guardians
    FOR ALL USING (auth.uid() = user_id);

-- SOS alerts policies
CREATE POLICY "Users can view own SOS alerts" ON sos_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create SOS alerts" ON sos_alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage SOS alerts" ON sos_alerts
    FOR ALL USING (auth.role() = 'service_role');

-- Trip shares policies
CREATE POLICY "Anyone can view trip shares by token" ON trip_shares
    FOR SELECT USING (TRUE); -- Token validation happens in application

-- Password reset tokens (service role only)
CREATE POLICY "Service role can manage password reset tokens" ON password_reset_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- User sessions (service role only)
CREATE POLICY "Service role can manage user sessions" ON user_sessions
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default fare rules
INSERT INTO fare_rules (vehicle_type, city, country, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, currency)
VALUES 
    ('sedan', 'Harare', 'ZWE', 2.00, 1.50, 0.20, 3.00, 1.50, 'USD'),
    ('sedan', 'Bulawayo', 'ZWE', 1.80, 1.30, 0.15, 2.50, 1.00, 'USD'),
    ('suv', 'Harare', 'ZWE', 3.00, 2.00, 0.25, 5.00, 2.00, 'USD'),
    ('minivan', 'Harare', 'ZWE', 4.00, 2.50, 0.30, 6.00, 2.50, 'USD'),
    ('motorcycle', 'Harare', 'ZWE', 1.00, 0.80, 0.10, 1.50, 0.50, 'USD');

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'User accounts with phone-based authentication';
COMMENT ON COLUMN users.phone IS 'Primary auth identifier in E.164 format';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password';

COMMENT ON TABLE driver_bank_details IS 'Encrypted bank details for driver settlements';
COMMENT ON COLUMN driver_bank_details.bank_name_encrypted IS 'AES-256-GCM encrypted: {iv}:{ciphertext}:{auth_tag}';
COMMENT ON COLUMN driver_bank_details.account_number_encrypted IS 'AES-256-GCM encrypted: {iv}:{ciphertext}:{auth_tag}';

COMMENT ON TABLE transactions IS 'All financial transactions including PayNow top-ups and ride payments';
COMMENT ON COLUMN transactions.paynow_reference IS 'PayNow transaction reference for reconciliation';

COMMENT ON TABLE settlements IS 'Driver payout batches for bank transfers';



