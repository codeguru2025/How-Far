// Conversations List Screen - View all chats
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { useAuthStore } from '../../stores';
import { Conversation, getConversations, subscribeToConversations } from '../../api/messaging';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Props {
  onNavigate: (screen: Screen, params?: any) => void;
}

export function ConversationsScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = React.useRef<RealtimeChannel | null>(null);

  const isDriver = user?.role === 'driver';

  useEffect(() => {
    loadConversations();
    setupRealtime();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  async function loadConversations() {
    if (!user?.id) return;

    try {
      const { conversations: data } = await getConversations(user.id);
      setConversations(data);
    } catch (error) {
      console.error('Load conversations error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function setupRealtime() {
    if (!user?.id) return;

    channelRef.current = subscribeToConversations(user.id, (updated) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }

  function handleOpenChat(conversation: Conversation) {
    const otherUser = isDriver ? conversation.rider : conversation.driver;
    const otherName = otherUser?.first_name || 'User';

    // Navigate to chat with params
    onNavigate('chat', {
      conversationId: conversation.id,
      otherUserName: otherName,
      isDriver,
    });
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  }

  function renderConversation({ item }: { item: Conversation }) {
    const otherUser = isDriver ? item.rider : item.driver;
    const otherName = otherUser?.first_name || 'User';
    const unreadCount = isDriver ? item.driver_unread_count : item.rider_unread_count;
    
    // Get trip info
    const tripOrigin = typeof item.trip?.origin === 'string' 
      ? JSON.parse(item.trip.origin) 
      : item.trip?.origin;

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => handleOpenChat(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherName[0].toUpperCase()}</Text>
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>{otherName}</Text>
            {item.last_message_at && (
              <Text style={styles.conversationTime}>
                {formatTime(item.last_message_at)}
              </Text>
            )}
          </View>

          <Text style={styles.conversationPreview} numberOfLines={1}>
            {item.last_message_preview || 'No messages yet'}
          </Text>

          {tripOrigin && (
            <Text style={styles.tripInfo} numberOfLines={1}>
              📍 {tripOrigin.address?.split(',')[0]}
            </Text>
          )}
        </View>

        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onNavigate(isDriver ? 'driver-home' : 'commuter-home')}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Conversations List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                {isDriver
                  ? 'Your passenger chats will appear here'
                  : 'Your driver chats will appear here'}
              </Text>
            </View>
          }
        />
      )}
    </View>
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
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 14,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  conversationTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  conversationPreview: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  tripInfo: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 10,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});

