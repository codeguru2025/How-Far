// Chat Screen - Real-time messaging between driver and rider
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { useAuthStore } from '../../stores';
import {
  Message,
  Conversation,
  getMessages,
  sendMessage,
  sendLocationMessage,
  markAsRead,
  subscribeToMessages,
  QUICK_MESSAGES,
} from '../../api/messaging';
import { getCurrentLocation } from '../../utils/location';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Props {
  onNavigate: (screen: Screen) => void;
  conversationId: string;
  otherUserName: string;
  isDriver: boolean;
}

export function ChatScreen({ 
  onNavigate, 
  conversationId, 
  otherUserName,
  isDriver 
}: Props) {
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);

  useEffect(() => {
    if (conversationId && user?.id) {
      loadMessages();
      setupRealtime();
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [conversationId, user?.id]);

  async function loadMessages() {
    setIsLoading(true);
    try {
      const { messages: loadedMessages } = await getMessages(conversationId);
      setMessages(loadedMessages);
      setIsLoading(false); // Show messages immediately
      
      // Mark as read in background (don't block UI)
      if (user?.id) {
        markAsRead(conversationId, user.id).catch(() => {}); // Fire and forget
      }
    } catch (error) {
      console.error('Load messages error:', error);
      setIsLoading(false);
    }
  }

  function setupRealtime() {
    channelRef.current = subscribeToMessages(conversationId, (newMessage) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });

      // Mark as read if message is from other user
      if (newMessage.sender_id !== user?.id && user?.id) {
        markAsRead(conversationId, user.id);
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
  }

  async function handleSend() {
    if (!inputText.trim() || isSending || !user?.id) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const { error } = await sendMessage(conversationId, user.id, text);
      if (error) {
        Alert.alert('Error', 'Failed to send message');
        setInputText(text); // Restore text
      }
    } catch (error) {
      console.error('Send error:', error);
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  }

  async function handleSendLocation() {
    if (!user?.id) return;
    
    try {
      const result = await getCurrentLocation();
      if (result.success && result.location) {
        await sendLocationMessage(
          conversationId,
          user.id,
          result.location.latitude,
          result.location.longitude,
          result.location.address
        );
      } else {
        Alert.alert('Error', result.error || 'Could not get your location');
      }
    } catch (error) {
      console.error('Send location error:', error);
      Alert.alert('Error', 'Failed to send location');
    }
  }

  function handleQuickMessage(text: string) {
    setInputText(text);
    setShowQuickMessages(false);
  }

  const quickMessages = isDriver ? QUICK_MESSAGES.driver : QUICK_MESSAGES.rider;

  function renderMessage({ item }: { item: Message }) {
    const isMe = item.sender_id === user?.id;
    const isSystem = item.message_type === 'system';
    const isLocation = item.message_type === 'location';

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {isLocation && (
            <View style={styles.locationBadge}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationLabel}>Location</Text>
            </View>
          )}
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => onNavigate(isDriver ? 'trip-dashboard' : 'booking-active')} 
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherUserName}</Text>
          <Text style={styles.headerSubtitle}>
            {isDriver ? 'Passenger' : 'Driver'}
          </Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start the conversation with a quick message!
              </Text>
            </View>
          }
        />
      )}

      {/* Quick Messages */}
      {showQuickMessages && (
        <View style={styles.quickMessagesContainer}>
          <View style={styles.quickMessagesHeader}>
            <Text style={styles.quickMessagesTitle}>Quick Messages</Text>
            <TouchableOpacity onPress={() => setShowQuickMessages(false)}>
              <Text style={styles.quickMessagesClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickMessagesList}>
            {quickMessages.map((msg, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickMessageChip}
                onPress={() => handleQuickMessage(msg)}
              >
                <Text style={styles.quickMessageText}>{msg}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => setShowQuickMessages(!showQuickMessages)}
        >
          <Text style={styles.quickButtonText}>⚡</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleSendLocation}
        >
          <Text style={styles.locationButtonText}>📍</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.text,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  locationLabel: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  quickMessagesContainer: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 14,
    maxHeight: 200,
  },
  quickMessagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickMessagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  quickMessagesClose: {
    fontSize: 18,
    color: COLORS.textSecondary,
    padding: 4,
  },
  quickMessagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickMessageChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickMessageText: {
    fontSize: 14,
    color: COLORS.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  quickButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 18,
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
});

