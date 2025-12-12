-- ============================================
-- INSTALL SCRIPT - Run on CORRECT database
-- CLEAN INSTALL - Drops existing tables first
-- ============================================

-- ============================================
-- CLEANUP FIRST - Remove any existing tables
-- ============================================
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;

DROP FUNCTION IF EXISTS get_or_create_conversation(UUID, UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS send_message(UUID, UUID, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS mark_messages_read(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS update_payouts_updated_at() CASCADE;

-- ============================================
-- PART 1: PAYOUTS TABLE
-- ============================================

CREATE TABLE payouts (
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

CREATE INDEX idx_payouts_user ON payouts(user_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created ON payouts(created_at DESC);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts_select" ON payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payouts_insert" ON payouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payouts_update" ON payouts
  FOR UPDATE USING (true);

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


-- ============================================
-- PART 2: CONVERSATIONS TABLE
-- ============================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID,
  booking_id UUID,
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  rider_id UUID NOT NULL REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  driver_unread_count INTEGER DEFAULT 0,
  rider_unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_driver ON conversations(driver_id);
CREATE INDEX idx_conversations_rider ON conversations(rider_id);
CREATE INDEX idx_conversations_trip ON conversations(trip_id);
CREATE INDEX idx_conversations_booking ON conversations(booking_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (auth.uid() = driver_id OR auth.uid() = rider_id);

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (auth.uid() = driver_id OR auth.uid() = rider_id);


-- ============================================
-- PART 3: MESSAGES TABLE
-- ============================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'location', 'image', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (c.driver_id = auth.uid() OR c.rider_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.driver_id = auth.uid() OR c.rider_id = auth.uid())
    )
  );

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (c.driver_id = auth.uid() OR c.rider_id = auth.uid())
    )
  );


-- ============================================
-- PART 4: FUNCTIONS
-- ============================================

CREATE FUNCTION get_or_create_conversation(
  p_booking_id UUID,
  p_trip_id UUID,
  p_driver_id UUID,
  p_rider_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE booking_id = p_booking_id
  LIMIT 1;
  
  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE driver_id = p_driver_id 
      AND rider_id = p_rider_id
      AND (trip_id = p_trip_id OR trip_id IS NULL)
    LIMIT 1;
  END IF;
  
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (booking_id, trip_id, driver_id, rider_id)
    VALUES (p_booking_id, p_trip_id, p_driver_id, p_rider_id)
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$;

CREATE FUNCTION send_message(
  p_conversation_id UUID,
  p_sender_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_conversation RECORD;
BEGIN
  SELECT * INTO v_conversation FROM conversations WHERE id = p_conversation_id;
  
  IF v_conversation IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  INSERT INTO messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (p_conversation_id, p_sender_id, p_content, p_message_type, p_metadata)
  RETURNING id INTO v_message_id;
  
  UPDATE conversations
  SET 
    last_message_at = NOW(),
    last_message_preview = LEFT(p_content, 100),
    driver_unread_count = CASE 
      WHEN p_sender_id = v_conversation.driver_id THEN driver_unread_count 
      ELSE driver_unread_count + 1 
    END,
    rider_unread_count = CASE 
      WHEN p_sender_id = v_conversation.rider_id THEN rider_unread_count 
      ELSE rider_unread_count + 1 
    END,
    updated_at = NOW()
  WHERE id = p_conversation_id;
  
  RETURN v_message_id;
END;
$$;

CREATE FUNCTION mark_messages_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation RECORD;
BEGIN
  SELECT * INTO v_conversation FROM conversations WHERE id = p_conversation_id;
  
  IF v_conversation IS NULL THEN
    RETURN;
  END IF;
  
  UPDATE messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND is_read = false;
  
  IF p_user_id = v_conversation.driver_id THEN
    UPDATE conversations SET driver_unread_count = 0 WHERE id = p_conversation_id;
  ELSIF p_user_id = v_conversation.rider_id THEN
    UPDATE conversations SET rider_unread_count = 0 WHERE id = p_conversation_id;
  END IF;
END;
$$;


-- ============================================
-- PART 5: ENABLE REALTIME
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'SUCCESS! Tables created:' as result;
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('messages', 'conversations', 'payouts')
ORDER BY table_name;
