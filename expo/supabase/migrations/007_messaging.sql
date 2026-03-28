-- In-app messaging between drivers and riders
-- Real-time chat for trip coordination
-- NOTE: Run migrations 001 and 002 first if not already done

-- Conversations table (one per booking/trip pair)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID, -- Optional reference to trips
  booking_id UUID, -- Optional reference to bookings
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

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'location', 'image', 'system')),
  content TEXT NOT NULL,
  metadata JSONB, -- For location coords, image URLs, etc.
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_driver ON conversations(driver_id);
CREATE INDEX IF NOT EXISTS idx_conversations_rider ON conversations(rider_id);
CREATE INDEX IF NOT EXISTS idx_conversations_trip ON conversations(trip_id);
CREATE INDEX IF NOT EXISTS idx_conversations_booking ON conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;

-- Users can view conversations they're part of
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (auth.uid() = driver_id OR auth.uid() = rider_id);

-- Anyone can create conversations (for booking flow)
CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (true);

-- Users can update their own conversation settings
CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (auth.uid() = driver_id OR auth.uid() = rider_id);

-- Users can view messages in their conversations
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (c.driver_id = auth.uid() OR c.rider_id = auth.uid())
    )
  );

-- Users can send messages to their conversations
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.driver_id = auth.uid() OR c.rider_id = auth.uid())
    )
  );

-- Users can update messages (mark as read)
CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND (c.driver_id = auth.uid() OR c.rider_id = auth.uid())
    )
  );

-- Function to get or create conversation for a booking
CREATE OR REPLACE FUNCTION get_or_create_conversation(
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
  -- Check if conversation exists for this booking
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE booking_id = p_booking_id
  LIMIT 1;
  
  IF v_conversation_id IS NULL THEN
    -- Check if conversation exists between these users for this trip
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE driver_id = p_driver_id 
      AND rider_id = p_rider_id
      AND (trip_id = p_trip_id OR trip_id IS NULL)
    LIMIT 1;
  END IF;
  
  IF v_conversation_id IS NULL THEN
    -- Create new conversation
    INSERT INTO conversations (booking_id, trip_id, driver_id, rider_id)
    VALUES (p_booking_id, p_trip_id, p_driver_id, p_rider_id)
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$;

-- Function to send a message and update conversation
CREATE OR REPLACE FUNCTION send_message(
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
  -- Get conversation details
  SELECT * INTO v_conversation FROM conversations WHERE id = p_conversation_id;
  
  IF v_conversation IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  -- Insert message
  INSERT INTO messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (p_conversation_id, p_sender_id, p_content, p_message_type, p_metadata)
  RETURNING id INTO v_message_id;
  
  -- Update conversation
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

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(
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
  
  -- Mark all messages as read
  UPDATE messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND is_read = false;
  
  -- Reset unread count
  IF p_user_id = v_conversation.driver_id THEN
    UPDATE conversations SET driver_unread_count = 0 WHERE id = p_conversation_id;
  ELSIF p_user_id = v_conversation.rider_id THEN
    UPDATE conversations SET rider_unread_count = 0 WHERE id = p_conversation_id;
  END IF;
END;
$$;

-- Enable realtime for messages (try, ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN OTHERS THEN
  -- Table might already be in publication
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION WHEN OTHERS THEN
  -- Table might already be in publication
  NULL;
END $$;
