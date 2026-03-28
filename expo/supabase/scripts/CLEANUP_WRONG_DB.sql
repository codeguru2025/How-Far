-- ============================================
-- CLEANUP SCRIPT - Run on WRONG database
-- This will remove the messaging & payouts tables
-- ============================================

-- Drop tables first (CASCADE will drop triggers and dependent objects)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;

-- Drop functions with CASCADE
DROP FUNCTION IF EXISTS get_or_create_conversation(UUID, UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS send_message(UUID, UUID, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS mark_messages_read(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_driver_available_earnings(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_payouts_updated_at() CASCADE;

-- Remove from realtime publication (ignore errors if not there)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE conversations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Verify cleanup
SELECT 'Cleanup complete!' as status;
