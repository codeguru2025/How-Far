-- ============================================
-- ADMIN SETTLEMENT SYSTEM
-- Secure daily auto-settlements with admin approval
-- ============================================

-- ============================================
-- 1. ADMIN USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'finance')),
    pin_hash TEXT NOT NULL, -- Hashed 6-digit PIN for payment approvals
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"can_approve_settlements": true, "can_view_reports": true}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- 2. DAILY SETTLEMENTS TABLE
-- Auto-generated settlements for admin approval
-- ============================================

CREATE TABLE IF NOT EXISTS daily_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_date DATE NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    driver_user_id UUID NOT NULL REFERENCES users(id),
    
    -- Driver details (snapshot at settlement time)
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    ecocash_number TEXT, -- Phone number for EcoCash payment
    
    -- Amounts
    gross_earnings DECIMAL(12, 2) NOT NULL,
    platform_fee DECIMAL(12, 2) NOT NULL DEFAULT 0, -- 7.5% already deducted during rides
    payout_amount DECIMAL(12, 2) NOT NULL, -- Amount to send to driver
    
    -- Status workflow: pending -> approved -> processing -> completed/failed
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Waiting for admin approval
        'approved',     -- Admin approved, waiting to process
        'processing',   -- Payment being sent
        'completed',    -- Payment successful
        'failed',       -- Payment failed
        'cancelled'     -- Cancelled by admin
    )),
    
    -- Approval details
    approved_by UUID REFERENCES admins(id),
    approved_at TIMESTAMPTZ,
    approval_note TEXT,
    
    -- Payment details
    payment_reference TEXT,
    payment_provider TEXT DEFAULT 'ecocash',
    payment_sent_at TIMESTAMPTZ,
    payment_confirmed_at TIMESTAMPTZ,
    payment_error TEXT,
    
    -- Booking references (for audit)
    booking_ids UUID[] DEFAULT '{}',
    booking_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(settlement_date, driver_id)
);

-- ============================================
-- 3. SETTLEMENT BATCHES TABLE
-- Groups settlements for batch processing
-- ============================================

CREATE TABLE IF NOT EXISTS settlement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Totals
    total_settlements INTEGER DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Created, waiting for admin
        'in_progress',  -- Admin is processing
        'completed',    -- All payments sent
        'partial'       -- Some payments failed
    )),
    
    -- Processing
    processed_by UUID REFERENCES admins(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Stats
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ADMIN AUDIT LOG
-- Track all admin actions for security
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admins(id),
    action TEXT NOT NULL,
    entity_type TEXT, -- 'settlement', 'batch', 'driver', etc.
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ADMIN PUSH NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admins(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'settlement' CHECK (type IN ('settlement', 'alert', 'system')),
    data JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_admins_user ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(is_active);

CREATE INDEX IF NOT EXISTS idx_daily_settlements_date ON daily_settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_driver ON daily_settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_status ON daily_settlements(status);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_pending ON daily_settlements(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_settlement_batches_date ON settlement_batches(batch_date);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_status ON settlement_batches(status);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_date ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin ON admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(admin_id) WHERE read_at IS NULL;

-- ============================================
-- 7. RLS POLICIES
-- ============================================

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins table - only admins can see admins
CREATE POLICY "admins_select" ON admins FOR SELECT USING (true);
CREATE POLICY "admins_insert" ON admins FOR INSERT WITH CHECK (true);
CREATE POLICY "admins_update" ON admins FOR UPDATE USING (true);

-- Settlements - admins can manage
CREATE POLICY "settlements_all" ON daily_settlements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "batches_all" ON settlement_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "audit_all" ON admin_audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "notifications_all" ON admin_notifications FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 8. FUNCTIONS
-- ============================================

-- Function to generate daily settlements (run at midnight)
CREATE OR REPLACE FUNCTION generate_daily_settlements()
RETURNS TABLE (
    settlements_created INTEGER,
    total_amount DECIMAL,
    batch_id UUID
) AS $$
DECLARE
    v_batch_id UUID;
    v_count INTEGER := 0;
    v_total DECIMAL := 0;
    v_settlement_date DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    -- Create batch for today
    INSERT INTO settlement_batches (batch_date, status)
    VALUES (CURRENT_DATE, 'pending')
    RETURNING id INTO v_batch_id;
    
    -- Find all drivers with completed bookings from yesterday that haven't been settled
    INSERT INTO daily_settlements (
        settlement_date,
        driver_id,
        driver_user_id,
        driver_name,
        driver_phone,
        ecocash_number,
        gross_earnings,
        platform_fee,
        payout_amount,
        booking_ids,
        booking_count,
        status
    )
    SELECT 
        v_settlement_date,
        d.id,
        d.user_id,
        COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''),
        u.phone_number,
        u.phone_number, -- EcoCash number same as phone
        COALESCE(SUM(b.fare), 0),
        COALESCE(SUM(b.driver_fee), 0),
        COALESCE(SUM(b.fare - COALESCE(b.driver_fee, 0)), 0),
        ARRAY_AGG(b.id),
        COUNT(b.id)::INTEGER,
        'pending'
    FROM drivers d
    JOIN users u ON d.user_id = u.id
    JOIN trips t ON t.driver_id = d.id
    JOIN bookings b ON b.trip_id = t.id
    WHERE b.payment_status = 'paid'
        AND b.paid_at >= v_settlement_date
        AND b.paid_at < v_settlement_date + INTERVAL '1 day'
        AND NOT EXISTS (
            SELECT 1 FROM daily_settlements ds 
            WHERE ds.driver_id = d.id 
            AND ds.settlement_date = v_settlement_date
        )
    GROUP BY d.id, d.user_id, u.first_name, u.last_name, u.phone_number
    HAVING SUM(b.fare) > 0;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Calculate total
    SELECT COALESCE(SUM(payout_amount), 0) INTO v_total
    FROM daily_settlements
    WHERE settlement_date = v_settlement_date;
    
    -- Update batch totals
    UPDATE settlement_batches
    SET total_settlements = v_count,
        total_amount = v_total
    WHERE id = v_batch_id;
    
    RETURN QUERY SELECT v_count, v_total, v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify admin PIN
CREATE OR REPLACE FUNCTION verify_admin_pin(
    p_user_id UUID,
    p_pin TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_pin_hash TEXT;
    v_stored_hash TEXT;
BEGIN
    -- Get stored hash
    SELECT pin_hash INTO v_stored_hash
    FROM admins
    WHERE user_id = p_user_id AND is_active = true;
    
    IF v_stored_hash IS NULL THEN
        RETURN false;
    END IF;
    
    -- Hash the provided PIN and compare
    v_pin_hash := encode(sha256(p_pin::bytea), 'hex');
    
    RETURN v_pin_hash = v_stored_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash a PIN (for setting/updating)
CREATE OR REPLACE FUNCTION hash_admin_pin(p_pin TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(sha256(p_pin::bytea), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to approve a settlement
CREATE OR REPLACE FUNCTION approve_settlement(
    p_settlement_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE daily_settlements
    SET status = 'approved',
        approved_by = p_admin_id,
        approved_at = NOW(),
        approval_note = p_note,
        updated_at = NOW()
    WHERE id = p_settlement_id
        AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark settlement as completed (after EcoCash payment)
CREATE OR REPLACE FUNCTION complete_settlement(
    p_settlement_id UUID,
    p_payment_reference TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE daily_settlements
    SET status = 'completed',
        payment_reference = p_payment_reference,
        payment_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_settlement_id
        AND status = 'processing';
    
    -- Update batch stats
    UPDATE settlement_batches sb
    SET successful_count = (
        SELECT COUNT(*) FROM daily_settlements ds 
        WHERE ds.settlement_date = sb.batch_date AND ds.status = 'completed'
    )
    WHERE batch_date = (SELECT settlement_date FROM daily_settlements WHERE id = p_settlement_id);
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. REALTIME
-- ============================================

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE daily_settlements;
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DONE
-- ============================================

SELECT 'Admin settlement system created successfully!' AS message;

