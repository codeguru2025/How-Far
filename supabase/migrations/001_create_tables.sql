-- =============================================
-- NDEIP-ZTHIN Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing tables if they exist (be careful in production!)
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS wallets CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- =============================================
-- USERS TABLE
-- =============================================
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

-- Add columns if table exists but columns don't
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'first_name') THEN
        ALTER TABLE users ADD COLUMN first_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_name') THEN
        ALTER TABLE users ADD COLUMN last_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_number') THEN
        ALTER TABLE users ADD COLUMN phone_number TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'passenger';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'status') THEN
        ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- =============================================
-- WALLETS TABLE
-- =============================================
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

-- Add columns if table exists but columns don't
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'pending_balance') THEN
        ALTER TABLE wallets ADD COLUMN pending_balance DECIMAL(12, 2) DEFAULT 0.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'daily_topup_limit') THEN
        ALTER TABLE wallets ADD COLUMN daily_topup_limit DECIMAL(12, 2) DEFAULT 10000.00;
    END IF;
END $$;

-- =============================================
-- TRANSACTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    to_wallet_id UUID REFERENCES wallets(id),
    from_wallet_id UUID REFERENCES wallets(id),
    type TEXT NOT NULL CHECK (type IN ('topup', 'payment', 'transfer', 'refund', 'ride', 'withdrawal')),
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

-- Add columns if table exists but columns don't
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'paynow_reference') THEN
        ALTER TABLE transactions ADD COLUMN paynow_reference TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'paynow_poll_url') THEN
        ALTER TABLE transactions ADD COLUMN paynow_poll_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'paynow_status') THEN
        ALTER TABLE transactions ADD COLUMN paynow_status TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'metadata') THEN
        ALTER TABLE transactions ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'idempotency_key') THEN
        ALTER TABLE transactions ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;
END $$;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all for users" ON users;
DROP POLICY IF EXISTS "Allow all for wallets" ON wallets;
DROP POLICY IF EXISTS "Allow all for transactions" ON transactions;

-- Create permissive policies (for development - tighten for production)
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for wallets" ON wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- =============================================
-- DONE!
-- =============================================
SELECT 'Database schema created/updated successfully!' as message;


