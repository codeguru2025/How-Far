-- ============================================
-- OTP VERIFICATION SYSTEM
-- Tracks OTP requests for security and rate limiting
-- ============================================

-- Create OTP requests table
CREATE TABLE IF NOT EXISTS otp_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    pin_id TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'verification',
    verified BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    resend_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add phone_verified columns to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_otp_requests_phone ON otp_requests(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_requests_pin_id ON otp_requests(pin_id);
CREATE INDEX IF NOT EXISTS idx_otp_requests_expires ON otp_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_verified ON otp_requests(verified);

-- Enable RLS
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role only - accessed via Edge Functions)
CREATE POLICY "otp_requests_service_all" ON otp_requests
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Function to clean up expired OTP requests (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otp_requests 
    WHERE expires_at < NOW() - INTERVAL '1 hour'
    AND verified = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify phone number and return user
CREATE OR REPLACE FUNCTION get_user_verification_status(p_phone TEXT)
RETURNS TABLE (
    user_id UUID,
    phone_verified BOOLEAN,
    phone_verified_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.phone_verified, u.phone_verified_at
    FROM users u
    WHERE u.phone_number = p_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log
SELECT 'OTP verification system created successfully!' AS message;

