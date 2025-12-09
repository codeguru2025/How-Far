-- ============================================
-- Ndeip - Zthin Database Schema
-- Consolidated SQL Migration File
-- Version: 1.0.0
-- 
-- Features:
-- - Phone + Password Authentication Only
-- - PayNow Integration for Payments
-- - Encrypted Bank Details for Drivers
-- - Wallet & Transaction Management
-- - Ride Booking & Tracking
-- - Safety Features (Guardians, SOS)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_verification', 'deactivated');
CREATE TYPE transaction_type AS ENUM ('topup', 'ride_payment', 'refund', 'settlement', 'adjustment');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'reconciling');
CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled');
CREATE TYPE vehicle_type AS ENUM ('sedan', 'suv', 'minivan', 'motorcycle', 'bicycle');
CREATE TYPE settlement_status AS ENUM ('pending', 'processing', 'processed', 'failed', 'paid');
CREATE TYPE sos_status AS ENUM ('active', 'resolved', 'false_alarm', 'escalated');

-- ============================================
-- USERS TABLE (Phone-based Authentication)
-- ============================================
-- Primary authentication is phone + password
-- Email is optional and NOT used for auth

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL UNIQUE, -- E.164 format, primary auth identifier
    phone_verified BOOLEAN DEFAULT FALSE,
    email VARCHAR(255), -- Optional, not used for auth
    password_hash VARCHAR(255) NOT NULL, -- bcrypt/PBKDF2 hashed
    
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
    
    -- Phone format constraint (E.164)
    CONSTRAINT phone_e164_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- PASSWORD RESET TOKENS (SMS-based)
-- ============================================

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- SHA256 hash of the token
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    attempt_count INTEGER DEFAULT 0,
    
    CONSTRAINT token_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

-- ============================================
-- USER SESSIONS
-- ============================================

CREATE TABLE user_sessions (
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

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    pending_balance DECIMAL(15, 2) DEFAULT 0.00, -- For drivers awaiting settlement
    daily_topup_limit DECIMAL(15, 2) DEFAULT 1000.00,
    daily_spend_limit DECIMAL(15, 2) DEFAULT 500.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT positive_pending CHECK (pending_balance >= 0)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- ============================================
-- TRANSACTIONS (PayNow & Ride Payments)
-- ============================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_wallet_id UUID REFERENCES wallets(id),
    to_wallet_id UUID REFERENCES wallets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    type transaction_type NOT NULL,
    status transaction_status DEFAULT 'pending',
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    fee DECIMAL(15, 2) DEFAULT 0.00,
    net_amount DECIMAL(15, 2) GENERATED ALWAYS AS (amount - fee) STORED,
    reference VARCHAR(100) UNIQUE,
    external_reference VARCHAR(100),
    ride_id UUID,
    
    -- PayNow specific fields
    paynow_reference VARCHAR(100),
    paynow_poll_url TEXT,
    paynow_status VARCHAR(50),
    
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
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

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(50) NOT NULL,
    license_expiry DATE NOT NULL,
    license_verified BOOLEAN DEFAULT FALSE,
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT FALSE,
    current_location GEOGRAPHY(POINT, 4326),
    last_location_update TIMESTAMPTZ,
    rating_average DECIMAL(3, 2) DEFAULT 5.00,
    rating_count INTEGER DEFAULT 0,
    total_rides INTEGER DEFAULT 0,
    
    -- QR Session for payments
    qr_code_data TEXT,
    qr_session_token VARCHAR(255),
    qr_session_expires TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    
    CONSTRAINT valid_rating CHECK (rating_average >= 1.00 AND rating_average <= 5.00)
);

CREATE INDEX idx_drivers_user ON drivers(user_id);
CREATE INDEX idx_drivers_online ON drivers(is_online, is_available);
CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location);

-- ============================================
-- DRIVER BANK DETAILS (Encrypted at Rest)
-- ============================================
-- All bank detail fields are encrypted using AES-256-GCM
-- Format: {iv}:{ciphertext} in base64
-- Encryption key stored in BANK_DETAILS_ENCRYPTION_KEY env var

CREATE TABLE driver_bank_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
    
    -- Encrypted fields (AES-256-GCM)
    bank_name_encrypted TEXT NOT NULL,
    account_number_encrypted TEXT NOT NULL,
    account_holder_name_encrypted TEXT NOT NULL,
    branch_code_encrypted TEXT NOT NULL,
    
    -- Non-sensitive metadata
    country VARCHAR(3) DEFAULT 'ZWE',
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_details_driver ON driver_bank_details(driver_id);

-- ============================================
-- VEHICLES
-- ============================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    type vehicle_type NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(50) NOT NULL,
    registration_number VARCHAR(20) NOT NULL UNIQUE,
    registration_expiry DATE,
    passenger_capacity INTEGER DEFAULT 4,
    insurance_policy_number VARCHAR(100),
    insurance_expiry DATE,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    photo_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_year CHECK (year >= 1990 AND year <= EXTRACT(YEAR FROM NOW()) + 1)
);

CREATE INDEX idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX idx_vehicles_registration ON vehicles(registration_number);

-- ============================================
-- RIDES
-- ============================================

CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passenger_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID REFERENCES drivers(id),
    vehicle_id UUID REFERENCES vehicles(id),
    status ride_status DEFAULT 'requested',
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address TEXT,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_address TEXT,
    route_polyline TEXT,
    estimated_distance_km DECIMAL(10, 2),
    actual_distance_km DECIMAL(10, 2),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    pickup_at TIMESTAMPTZ,
    dropoff_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    estimated_fare DECIMAL(15, 2),
    actual_fare DECIMAL(15, 2),
    fare_breakdown JSONB,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(20) DEFAULT 'wallet',
    payment_transaction_id UUID REFERENCES transactions(id),
    is_paid BOOLEAN DEFAULT FALSE,
    passenger_rating INTEGER,
    driver_rating INTEGER,
    passenger_feedback TEXT,
    driver_feedback TEXT,
    is_shared_trip BOOLEAN DEFAULT FALSE,
    shared_trip_url TEXT,
    guardian_notified BOOLEAN DEFAULT FALSE,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(15, 2),
    metadata JSONB DEFAULT '{}'::jsonb,
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

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    gross_amount DECIMAL(15, 2) NOT NULL,
    fees DECIMAL(15, 2) DEFAULT 0.00,
    net_amount DECIMAL(15, 2) GENERATED ALWAYS AS (gross_amount - fees) STORED,
    currency VARCHAR(3) DEFAULT 'USD',
    status settlement_status DEFAULT 'pending',
    bank_details_snapshot TEXT, -- Encrypted copy
    batch_id VARCHAR(100),
    export_generated_at TIMESTAMPTZ,
    export_file_url TEXT,
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    transaction_count INTEGER DEFAULT 0,
    notes TEXT,
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

CREATE TABLE guardians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    relationship VARCHAR(50),
    is_primary BOOLEAN DEFAULT FALSE,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_given_at TIMESTAMPTZ,
    notify_on_ride_start BOOLEAN DEFAULT TRUE,
    notify_on_ride_end BOOLEAN DEFAULT TRUE,
    notify_on_sos BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT guardian_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

CREATE INDEX idx_guardians_user ON guardians(user_id);
CREATE UNIQUE INDEX idx_guardians_primary ON guardians(user_id) WHERE is_primary = TRUE;

-- ============================================
-- SOS ALERTS
-- ============================================

CREATE TABLE sos_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    ride_id UUID REFERENCES rides(id),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT,
    status sos_status DEFAULT 'active',
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    guardians_notified BOOLEAN DEFAULT FALSE,
    emergency_services_notified BOOLEAN DEFAULT FALSE,
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

CREATE TABLE trip_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    share_token VARCHAR(100) NOT NULL UNIQUE,
    shared_with_phone VARCHAR(20),
    shared_with_email VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trip_shares_ride ON trip_shares(ride_id);
CREATE INDEX idx_trip_shares_token ON trip_shares(share_token);

-- ============================================
-- FARE RULES
-- ============================================

CREATE TABLE fare_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type vehicle_type NOT NULL,
    city VARCHAR(100),
    country VARCHAR(3) DEFAULT 'ZWE',
    base_fare DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    per_km_rate DECIMAL(15, 2) NOT NULL,
    min_distance_km DECIMAL(5, 2) DEFAULT 0,
    per_minute_rate DECIMAL(15, 2) DEFAULT 0,
    surge_multiplier_max DECIMAL(3, 2) DEFAULT 3.00,
    minimum_fare DECIMAL(15, 2) NOT NULL,
    cancellation_fee DECIMAL(15, 2) DEFAULT 0,
    free_cancellation_minutes INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fare_rules_vehicle ON fare_rules(vehicle_type);
CREATE INDEX idx_fare_rules_active ON fare_rules(is_active);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_bank_details_updated_at BEFORE UPDATE ON driver_bank_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guardians_updated_at BEFORE UPDATE ON guardians FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sos_alerts_updated_at BEFORE UPDATE ON sos_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fare_rules_updated_at BEFORE UPDATE ON fare_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create wallet for new user
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id, balance, currency) VALUES (NEW.id, 0.00, 'USD');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_wallet_on_user_insert AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_user_wallet();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

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
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Service role can manage all users" ON users FOR ALL USING (auth.role() = 'service_role');

-- Wallets policies
CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage wallets" ON wallets FOR ALL USING (auth.role() = 'service_role');

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage transactions" ON transactions FOR ALL USING (auth.role() = 'service_role');

-- Driver bank details (STRICT - encrypted, only service role and owner)
CREATE POLICY "Drivers can view own bank details" ON driver_bank_details FOR SELECT 
    USING (EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_bank_details.driver_id AND drivers.user_id = auth.uid()));
CREATE POLICY "Drivers can insert own bank details" ON driver_bank_details FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_bank_details.driver_id AND drivers.user_id = auth.uid()));
CREATE POLICY "Drivers can update own bank details" ON driver_bank_details FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM drivers WHERE drivers.id = driver_bank_details.driver_id AND drivers.user_id = auth.uid()));
CREATE POLICY "Service role can manage bank details" ON driver_bank_details FOR ALL USING (auth.role() = 'service_role');

-- Settlements (read only for drivers)
CREATE POLICY "Drivers can view own settlements" ON settlements FOR SELECT 
    USING (EXISTS (SELECT 1 FROM drivers WHERE drivers.id = settlements.driver_id AND drivers.user_id = auth.uid()));
CREATE POLICY "Service role can manage settlements" ON settlements FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- INITIAL DATA
-- ============================================

INSERT INTO fare_rules (vehicle_type, city, country, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, currency)
VALUES 
    ('sedan', 'Harare', 'ZWE', 2.00, 1.50, 0.20, 3.00, 1.50, 'USD'),
    ('sedan', 'Bulawayo', 'ZWE', 1.80, 1.30, 0.15, 2.50, 1.00, 'USD'),
    ('suv', 'Harare', 'ZWE', 3.00, 2.00, 0.25, 5.00, 2.00, 'USD'),
    ('minivan', 'Harare', 'ZWE', 4.00, 2.50, 0.30, 6.00, 2.50, 'USD'),
    ('motorcycle', 'Harare', 'ZWE', 1.00, 0.80, 0.10, 1.50, 0.50, 'USD');

-- ============================================
-- SCHEMA DOCUMENTATION
-- ============================================

COMMENT ON TABLE users IS 'User accounts with phone-based authentication. Phone is primary identifier.';
COMMENT ON COLUMN users.phone IS 'Primary auth identifier in E.164 format (e.g., +263771234567)';
COMMENT ON COLUMN users.password_hash IS 'Password hashed with bcrypt or PBKDF2-SHA256';
COMMENT ON COLUMN users.email IS 'Optional email, NOT used for authentication';

COMMENT ON TABLE driver_bank_details IS 'Encrypted bank details for driver settlements. Uses AES-256-GCM.';
COMMENT ON COLUMN driver_bank_details.bank_name_encrypted IS 'AES-256-GCM encrypted: {iv}:{ciphertext} in base64';
COMMENT ON COLUMN driver_bank_details.account_number_encrypted IS 'AES-256-GCM encrypted: {iv}:{ciphertext} in base64';

COMMENT ON TABLE transactions IS 'All financial transactions including PayNow top-ups and ride payments';
COMMENT ON COLUMN transactions.paynow_reference IS 'PayNow transaction reference for webhook reconciliation';
COMMENT ON COLUMN transactions.idempotency_key IS 'Unique key to prevent duplicate transactions';

COMMENT ON TABLE settlements IS 'Driver payout batches for bank transfers. CSV exports generated by settleDriverPayout function.';



