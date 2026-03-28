// Messaging API - In-app chat between drivers and riders
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { apiCache } from '../utils/apiCache';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: 'text' | 'location' | 'image' | 'system';
  content: string;
  metadata?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    image_url?: string;
  };
  is_read: boolean;
  created_at: string;
  sender?: {
    first_name: string;
    last_name?: string;
  };
}

export interface Conversation {
  id: string;
  trip_id: string;
  booking_id: string;
  driver_id: string;
  rider_id: string;
  last_message_at: string;
  last_message_preview: string;
  driver_unread_count: number;
  rider_unread_count: number;
  status: 'active' | 'archived' | 'blocked';
  created_at: string;
  // Joined data
  driver?: { first_name: string; last_name?: string };
  rider?: { first_name: string; last_name?: string };
  trip?: { origin: any; destination: any };
}

// Get or create conversation for a booking
export async function getOrCreateConversation(
  bookingId: string,
  tripId: string,
  driverId: string,
  riderId: string
): Promise<{ conversation: Conversation | null; error: string | null }> {
  try {
    // Fast path: check cache first
    const cacheKey = `conversation_${bookingId}`;
    const cached = apiCache.get<Conversation>(cacheKey);
    if (cached) {
      return { conversation: cached, error: null };
    }
    
    // First, try to find existing conversation by booking
    let { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (existing) {
      apiCache.set(cacheKey, existing, 60000); // Cache for 1 minute
      return { conversation: existing, error: null };
    }

    // Try to find by driver + rider + trip
    const { data: existingByUsers } = await supabase
      .from('conversations')
      .select('*')
      .eq('driver_id', driverId)
      .eq('rider_id', riderId)
      .eq('trip_id', tripId)
      .maybeSingle();

    if (existingByUsers) {
      apiCache.set(cacheKey, existingByUsers, 60000); // Cache for 1 minute
      return { conversation: existingByUsers, error: null };
    }

    // Create new conversation
    const { data: newConv, error: insertError } = await supabase
      .from('conversations')
      .insert({
        booking_id: bookingId,
        trip_id: tripId,
        driver_id: driverId,
        rider_id: riderId,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert conversation error:', insertError);
      throw insertError;
    }

    apiCache.set(cacheKey, newConv, 60000); // Cache for 1 minute
    return { conversation: newConv, error: null };
  } catch (error: any) {
    console.error('getOrCreateConversation error:', error);
    return { conversation: null, error: error.message };
  }
}

// Get user's conversations
export async function getConversations(
  userId: string
): Promise<{ conversations: Conversation[]; error: string | null }> {
  const cacheKey = `conversations_${userId}`;
  
  // Check cache first (10 second TTL)
  const cached = apiCache.get<Conversation[]>(cacheKey);
  if (cached) {
    return { conversations: cached, error: null };
  }

  try {
    // Simple query without joins for speed
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`driver_id.eq.${userId},rider_id.eq.${userId}`)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    const conversations = data || [];
    
    // Cache the result
    apiCache.set(cacheKey, conversations, 10000); // 10 seconds
    
    return { conversations, error: null };
  } catch (error: any) {
    console.error('getConversations error:', error);
    return { conversations: [], error: error.message };
  }
}

// Get messages for a conversation
export async function getMessages(
  conversationId: string,
  limit: number = 50
): Promise<{ messages: Message[]; error: string | null }> {
  const cacheKey = `messages_${conversationId}`;
  
  // Check cache first
  const cached = apiCache.get<Message[]>(cacheKey);
  if (cached) {
    return { messages: cached, error: null };
  }

  // Use dedupe to prevent concurrent identical requests
  return apiCache.dedupe(`fetch_${cacheKey}`, async () => {
    try {
      // Simple query without joins for speed
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, message_type, content, metadata, is_read, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Reverse to show oldest first
      const messages = (data || []).reverse();
      
      // Cache the result (10 seconds - real-time updates will invalidate)
      apiCache.set(cacheKey, messages, 10000);
      
      return { messages, error: null };
    } catch (error: any) {
      console.error('getMessages error:', error);
      return { messages: [], error: error.message };
    }
  });
}

// Send a text message
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'location' | 'image' | 'system' = 'text',
  metadata?: any
): Promise<{ messageId: string | null; error: string | null }> {
  try {
    // Direct insert instead of RPC
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: messageType,
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert message error:', insertError);
      throw insertError;
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // Invalidate cache for this conversation
    apiCache.invalidate(`messages_${conversationId}`);
    apiCache.invalidatePrefix('conversations_');

    return { messageId: message?.id || null, error: null };
  } catch (error: any) {
    console.error('sendMessage error:', error);
    return { messageId: null, error: error.message };
  }
}

// Send location message
export async function sendLocationMessage(
  conversationId: string,
  senderId: string,
  latitude: number,
  longitude: number,
  address?: string
): Promise<{ messageId: string | null; error: string | null }> {
  // Guard against undefined coordinates
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return { messageId: null, error: 'Invalid location coordinates' };
  }
  
  const content = address || `📍 Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  return sendMessage(conversationId, senderId, content, 'location', {
    latitude,
    longitude,
    address,
  });
}

// Mark messages as read
export async function markAsRead(
  conversationId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Guard against undefined userId
    if (!conversationId || !userId) {
      if (__DEV__) console.log('markAsRead skipped - missing conversationId or userId');
      return { success: false, error: 'Missing conversationId or userId' };
    }

    // Direct update instead of RPC
    const { error: msgError } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (msgError) {
      console.error('Mark messages read error:', msgError);
    }

    // Get conversation to check if user is driver or rider
    const { data: conv } = await supabase
      .from('conversations')
      .select('driver_id, rider_id')
      .eq('id', conversationId)
      .single();

    if (conv) {
      const updateField = conv.driver_id === userId 
        ? { driver_unread_count: 0 } 
        : { rider_unread_count: 0 };
      
      await supabase
        .from('conversations')
        .update(updateField)
        .eq('id', conversationId);
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('markAsRead error:', error);
    return { success: false, error: error.message };
  }
}

// Subscribe to new messages in a conversation
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        // Fetch full message with sender info
        const { data } = await supabase
          .from('messages')
          .select('*, sender:sender_id(first_name, last_name)')
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onMessage(data as Message);
        }
      }
    )
    .subscribe();

  return channel;
}

// Subscribe to conversation updates (for unread counts)
export function subscribeToConversations(
  userId: string,
  onUpdate: (conversation: Conversation) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
      },
      async (payload) => {
        const conv = payload.new as Conversation;
        if (conv.driver_id === userId || conv.rider_id === userId) {
          onUpdate(conv);
        }
      }
    )
    .subscribe();

  return channel;
}

// Get total unread count for a user
export async function getUnreadCount(
  userId: string,
  isDriver: boolean
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(isDriver ? 'driver_unread_count' : 'rider_unread_count')
      .eq(isDriver ? 'driver_id' : 'rider_id', userId)
      .eq('status', 'active');

    if (error) throw error;

    return data?.reduce((sum, c) => {
      const count = isDriver 
        ? (c as { driver_unread_count?: number }).driver_unread_count 
        : (c as { rider_unread_count?: number }).rider_unread_count;
      return sum + (count || 0);
    }, 0) || 0;
  } catch (error) {
    console.error('getUnreadCount error:', error);
    return 0;
  }
}

// Quick messages for common scenarios
export const QUICK_MESSAGES = {
  driver: [
    "I'm on my way to pick you up",
    "I've arrived at the pickup point",
    "Please come to the vehicle",
    "Running a few minutes late",
    "What's your exact location?",
    "I'm the one in the [vehicle description]",
  ],
  rider: [
    "I'm at the pickup point",
    "On my way, 2 minutes",
    "Can you wait a moment please?",
    "Where exactly are you?",
    "I can see you, coming now",
    "Thank you!",
  ],
};

