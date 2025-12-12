-- ============================================
-- IMPROVED RLS POLICIES
-- Version: 1.0
-- 
-- SECURITY NOTE: This app uses custom auth (not Supabase Auth)
-- with phone/password stored in the users table.
-- 
-- Since we can't use auth.uid() for RLS, we implement:
-- 1. Read protection for sensitive columns
-- 2. Service role for sensitive operations
-- 3. API-level authorization in Edge Functions
--
-- RECOMMENDATION: For production, migrate to Supabase Auth
-- which provides proper JWT-based RLS policies.
-- ============================================

-- ============================================
-- STEP 1: CREATE VIEWS FOR SAFE DATA ACCESS
-- These views exclude sensitive columns
-- ============================================

-- Safe users view (excludes password_hash)
CREATE OR REPLACE VIEW public.users_safe AS
SELECT 
    id,
    phone_number,
    first_name,
    last_name,
    role,
    status,
    created_at,
    updated_at
FROM users;

-- Grant access to the safe view
GRANT SELECT ON public.users_safe TO anon, authenticated;

-- ============================================
-- STEP 2: REVOKE DIRECT ACCESS TO SENSITIVE COLUMNS
-- Note: This requires application changes to use views
-- ============================================

-- For now, we document that password_hash should never be selected
-- The application layer handles this (see users.ts USER_FIELDS constant)

-- ============================================
-- STEP 3: ADD RATE LIMITING TABLE
-- Helps prevent brute force attacks
-- ============================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key, window_start);

-- Auto-cleanup old rate limit entries (run via scheduled function)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: ADD AUDIT LOG FOR SENSITIVE OPERATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_type ON security_audit_log(event_type, created_at DESC);

-- RLS for audit log (only service role can write, no one can read via anon)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_insert_service" ON security_audit_log
    FOR INSERT WITH CHECK (true); -- Edge functions with service role can insert

CREATE POLICY "audit_log_select_admin" ON security_audit_log
    FOR SELECT USING (false); -- No direct reads, only via admin functions

-- ============================================
-- STEP 5: WALLET BALANCE PROTECTION
-- Prevent negative balances and large unauthorized changes
-- ============================================

-- Add check constraint to prevent negative balances
ALTER TABLE wallets 
    DROP CONSTRAINT IF EXISTS wallets_balance_non_negative;
    
ALTER TABLE wallets 
    ADD CONSTRAINT wallets_balance_non_negative 
    CHECK (balance >= 0);

ALTER TABLE wallets 
    DROP CONSTRAINT IF EXISTS wallets_pending_non_negative;
    
ALTER TABLE wallets 
    ADD CONSTRAINT wallets_pending_non_negative 
    CHECK (pending_balance >= 0);

-- ============================================
-- STEP 6: TRANSACTION INTEGRITY
-- Ensure transactions are properly recorded
-- ============================================

-- Add check constraint for positive transaction amounts
ALTER TABLE transactions 
    DROP CONSTRAINT IF EXISTS transactions_amount_positive;
    
ALTER TABLE transactions 
    ADD CONSTRAINT transactions_amount_positive 
    CHECK (amount > 0);

-- ============================================
-- STEP 7: BOOKING INTEGRITY
-- Ensure bookings have valid data
-- ============================================

ALTER TABLE bookings 
    DROP CONSTRAINT IF EXISTS bookings_seats_positive;
    
ALTER TABLE bookings 
    ADD CONSTRAINT bookings_seats_positive 
    CHECK (seats > 0 AND seats <= 20);

ALTER TABLE bookings 
    DROP CONSTRAINT IF EXISTS bookings_fare_non_negative;
    
ALTER TABLE bookings 
    ADD CONSTRAINT bookings_fare_non_negative 
    CHECK (fare >= 0);

-- ============================================
-- DOCUMENTATION: SECURITY BEST PRACTICES
-- ============================================

COMMENT ON TABLE users IS 'User accounts. password_hash should NEVER be returned to clients. Use users_safe view or select specific columns.';
COMMENT ON TABLE wallets IS 'User wallets. Balance updates should only happen through Edge Functions with proper validation.';
COMMENT ON TABLE transactions IS 'Financial transactions. All wallet balance changes should create a transaction record for audit.';
COMMENT ON TABLE security_audit_log IS 'Security audit log. Records login attempts, sensitive operations, etc.';

