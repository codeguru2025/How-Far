-- SIMPLE CONVERSATIONS SETUP
-- Run this in Supabase SQL Editor

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID,
  booking_id UUID,
  driver_id UUID NOT NULL,
  rider_id UUID NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  driver_unread_count INTEGER DEFAULT 0,
  rider_unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message_type TEXT DEFAULT 'text',
  content TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_driver ON conversations(driver_id);
CREATE INDEX IF NOT EXISTS idx_conversations_rider ON conversations(rider_id);
CREATE INDEX IF NOT EXISTS idx_conversations_booking ON conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "conversations_all" ON conversations;
DROP POLICY IF EXISTS "messages_all" ON messages;

-- Simple permissive policies (allow all for authenticated users)
CREATE POLICY "conversations_all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "messages_all" ON messages FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT 'SUCCESS! Conversations and messages tables created.' as result;

