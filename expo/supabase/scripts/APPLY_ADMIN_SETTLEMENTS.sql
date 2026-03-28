-- ============================================
-- ADMIN SETTLEMENT SYSTEM (Run in Supabase SQL Editor)
-- ============================================

-- 1. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'finance')),
    pin_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"can_approve_settlements": true, "can_view_reports": true}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. DAILY SETTLEMENTS TABLE
CREATE TABLE IF NOT EXISTS daily_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_date DATE NOT NULL,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    driver_user_id UUID NOT NULL REFERENCES users(id),
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    ecocash_number TEXT,
    gross_earnings DECIMAL(12, 2) NOT NULL,
    platform_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payout_amount DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'
    )),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    approval_note TEXT,
    payment_reference TEXT,
    payment_provider TEXT DEFAULT 'ecocash',
    payment_sent_at TIMESTAMPTZ,
    payment_confirmed_at TIMESTAMPTZ,
    payment_error TEXT,
    booking_ids UUID[] DEFAULT '{}',
    booking_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(settlement_date, driver_id)
);

-- 3. SETTLEMENT BATCHES TABLE
CREATE TABLE IF NOT EXISTS settlement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_settlements INTEGER DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'completed', 'partial'
    )),
    processed_by UUID,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ADMIN AUDIT LOG
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ADMIN NOTIFICATIONS
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'settlement' CHECK (type IN ('settlement', 'alert', 'system')),
    data JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_admins_user ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_date ON daily_settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_daily_settlements_status ON daily_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_date ON settlement_batches(batch_date);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin ON admin_notifications(admin_id);

-- 7. RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES (using IF NOT EXISTS pattern)
DO $$ BEGIN
  CREATE POLICY "admins_all" ON admins FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "settlements_all" ON daily_settlements FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "batches_all" ON settlement_batches FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "audit_all" ON admin_audit_log FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "notifications_all" ON admin_notifications FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'Admin settlement tables created successfully!' AS result;

