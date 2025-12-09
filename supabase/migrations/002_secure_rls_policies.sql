-- =============================================
-- SECURE RLS POLICIES
-- Since we use custom phone auth (not Supabase Auth),
-- we restrict what the anon key can do
-- =============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow all for users" ON users;
DROP POLICY IF EXISTS "Allow all for wallets" ON wallets;
DROP POLICY IF EXISTS "Allow all for transactions" ON transactions;

-- =============================================
-- USERS TABLE POLICIES
-- =============================================
-- Allow reading users (needed for login/signup check)
CREATE POLICY "Anyone can read users" ON users
    FOR SELECT USING (true);

-- Allow inserting new users (signup)
CREATE POLICY "Anyone can create users" ON users
    FOR INSERT WITH CHECK (true);

-- Only service role can update/delete users (via Edge Functions)
CREATE POLICY "Service role can update users" ON users
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete users" ON users
    FOR DELETE USING (auth.role() = 'service_role');

-- =============================================
-- WALLETS TABLE POLICIES
-- =============================================
-- Allow reading wallets (needed for balance display)
CREATE POLICY "Anyone can read wallets" ON wallets
    FOR SELECT USING (true);

-- Allow inserting wallets (when user signs up)
CREATE POLICY "Anyone can create wallets" ON wallets
    FOR INSERT WITH CHECK (true);

-- CRITICAL: Only service role can UPDATE wallets (prevents client-side balance manipulation)
CREATE POLICY "Only service role can update wallets" ON wallets
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete wallets" ON wallets
    FOR DELETE USING (auth.role() = 'service_role');

-- =============================================
-- TRANSACTIONS TABLE POLICIES
-- =============================================
-- Allow reading all transactions (user filters on client)
CREATE POLICY "Anyone can read transactions" ON transactions
    FOR SELECT USING (true);

-- Allow creating transactions (initiating payments)
CREATE POLICY "Anyone can create transactions" ON transactions
    FOR INSERT WITH CHECK (true);

-- CRITICAL: Only service role can UPDATE transactions (prevents status manipulation)
CREATE POLICY "Only service role can update transactions" ON transactions
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete transactions" ON transactions
    FOR DELETE USING (auth.role() = 'service_role');

-- =============================================
-- VERIFICATION
-- =============================================
-- Run this to verify policies are set
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'wallets', 'transactions');

