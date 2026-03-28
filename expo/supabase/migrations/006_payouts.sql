-- Payouts table for driver withdrawals
-- Self-service payout system

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('ecocash', 'onemoney', 'innbucks', 'bank')),
  account_number TEXT NOT NULL,
  account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  failure_reason TEXT,
  reference TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payouts_user ON payouts(user_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created ON payouts(created_at DESC);

-- RLS Policies
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Users can view their own payouts
CREATE POLICY "payouts_select" ON payouts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own payout requests
CREATE POLICY "payouts_insert" ON payouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only system can update payouts (for processing)
CREATE POLICY "payouts_update" ON payouts
  FOR UPDATE USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_payouts_updated_at();

-- Function to get driver's available earnings
CREATE OR REPLACE FUNCTION get_driver_available_earnings(driver_user_id UUID)
RETURNS TABLE(total_earned DECIMAL, total_paid DECIMAL, pending_payout DECIMAL, available DECIMAL)
LANGUAGE plpgsql
AS $$
DECLARE
  v_driver_id UUID;
  v_total_earned DECIMAL := 0;
  v_total_paid DECIMAL := 0;
  v_pending DECIMAL := 0;
BEGIN
  -- Get driver ID
  SELECT id INTO v_driver_id FROM drivers WHERE user_id = driver_user_id;
  
  IF v_driver_id IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
    RETURN;
  END IF;
  
  -- Get total earned from completed bookings
  SELECT COALESCE(SUM(b.fare), 0) INTO v_total_earned
  FROM bookings b
  JOIN trips t ON b.trip_id = t.id
  WHERE t.driver_id = v_driver_id
    AND b.payment_status = 'completed';
  
  -- Get total already paid out
  SELECT COALESCE(SUM(net_amount), 0) INTO v_total_paid
  FROM payouts
  WHERE user_id = driver_user_id
    AND status = 'completed';
  
  -- Get pending payouts
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM payouts
  WHERE user_id = driver_user_id
    AND status IN ('pending', 'processing');
  
  RETURN QUERY SELECT 
    v_total_earned,
    v_total_paid,
    v_pending,
    GREATEST(0, v_total_earned - v_total_paid - v_pending);
END;
$$;

