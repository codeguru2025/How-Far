// Trip Dashboard Screen - Driver manages active trip
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen, Trip, Booking } from '../../types';
import { Button } from '../../components';
import { getDriverActiveTrip, completeTrip } from '../../api/trips';
import { supabase } from '../../api/supabase';
import { getOrCreateConversation } from '../../api/messaging';
import { useAuthStore } from '../../stores';

interface Props {
  onNavigate: (screen: Screen, params?: any) => void;
}

export function TripDashboardScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function handleMessageRider(booking: Booking) {
    if (!trip || !user || !booking.commuter_id) {
      Alert.alert('Error', 'Cannot open chat');
      return;
    }

    try {
      const { conversation, error } = await getOrCreateConversation(
        booking.id,
        trip.id,
        user.id,
        booking.commuter_id
      );

      if (error || !conversation) {
        console.error('Chat error:', error);
        Alert.alert('Error', error || 'Could not open chat');
        return;
      }

      const riderName = booking.rider?.first_name || 'Rider';
      onNavigate('chat', {
        conversationId: conversation.id,
        otherUserName: riderName,
        isDriver: true,
      });
    } catch (error) {
      console.error('Open chat error:', error);
      Alert.alert('Error', 'Failed to open chat');
    }
  }

  useEffect(() => {
    loadTrip();
    
    // Subscribe to booking updates
    const subscription = supabase
      .channel('trip-bookings')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings' 
      }, () => {
        loadTrip();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadTrip() {
    try {
      const activeTrip = await getDriverActiveTrip();
      setTrip(activeTrip);
    } catch (error) {
      console.error('Load trip error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadTrip();
    setRefreshing(false);
  }

  async function handleConfirmBooking(bookingId: string) {
    try {
      // Get booking details first
      const { data: booking } = await supabase
        .from('bookings')
        .select('seats, trip_id')
        .eq('id', bookingId)
        .single();

      if (!booking) {
        Alert.alert('Error', 'Booking not found');
        return;
      }

      // Update booking status
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (bookingError) {
        Alert.alert('Error', 'Failed to confirm booking');
        return;
      }

      // Reduce available seats on the trip
      const { error: tripError } = await supabase
        .from('trips')
        .update({ 
          seats_available: (trip?.seats_available || 0) - (booking.seats || 1)
        })
        .eq('id', booking.trip_id);

      if (tripError) {
        console.error('Error updating seats:', tripError);
      }

      Alert.alert('Confirmed! ✅', `${booking.seats} seat(s) have been confirmed.`);
      loadTrip();
    } catch (error) {
      console.error('Confirm booking error:', error);
      Alert.alert('Error', 'Something went wrong');
    }
  }

  async function handleRejectBooking(bookingId: string) {
    Alert.alert(
      'Reject Booking',
      'Are you sure you want to reject this booking?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Get booking to check if it was confirmed (seats were deducted)
              const { data: booking } = await supabase
                .from('bookings')
                .select('seats, trip_id, status')
                .eq('id', bookingId)
                .single();

              const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

              if (!error) {
                // If booking was confirmed, restore the seats
                if (booking && booking.status === 'confirmed' && trip) {
                  await supabase
                    .from('trips')
                    .update({ 
                      seats_available: (trip.seats_available || 0) + (booking.seats || 1)
                    })
                    .eq('id', booking.trip_id);
                }
                loadTrip();
              }
            } catch (error) {
              console.error('Reject booking error:', error);
            }
          }
        },
      ]
    );
  }

  async function handleEndTrip() {
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Trip', 
          onPress: async () => {
            if (trip) {
              await completeTrip(trip.id);
              onNavigate('driver-home');
            }
          }
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🚗</Text>
        <Text style={styles.emptyTitle}>No Active Trip</Text>
        <Text style={styles.emptyText}>Create a new trip to start accepting riders</Text>
        <Button
          title="Create Trip"
          onPress={() => onNavigate('create-trip')}
          style={styles.createButton}
        />
      </View>
    );
  }

  const pendingBookings = trip.bookings?.filter(b => b.status === 'pending') || [];
  const confirmedBookings = trip.bookings?.filter(b => b.status === 'confirmed' || b.status === 'picked_up') || [];
  const origin = typeof trip.origin === 'string' ? JSON.parse(trip.origin) : trip.origin;
  const destination = typeof trip.destination === 'string' ? JSON.parse(trip.destination) : trip.destination;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('driver-home')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Dashboard</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => onNavigate('driver-map')} style={styles.mapButton}>
            <Text style={styles.mapIcon}>🗺️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate('scan-qr')} style={styles.scanButton}>
            <Text style={styles.scanIcon}>📷</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Trip Info Card */}
        <View style={styles.tripCard}>
          <View style={[styles.statusBadge, trip.status === 'pending' && styles.statusBadgePending]}>
            <Text style={[styles.statusText, trip.status === 'pending' && styles.statusTextPending]}>
              {trip.status === 'active' ? '🟢 Live' : 
               trip.status === 'pending' ? '🟡 Not Live Yet' : '🔵 In Progress'}
            </Text>
          </View>
          
          {trip.status === 'pending' && (
            <TouchableOpacity 
              style={styles.goLiveButton}
              onPress={async () => {
                const { startTrip } = await import('../../api/trips');
                const success = await startTrip(trip.id);
                if (success) {
                  loadTrip();
                }
              }}
            >
              <Text style={styles.goLiveText}>🚀 Go Live Now</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.routeInfo}>
            <View style={styles.routePoint}>
              <Text style={styles.routeIcon}>📍</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>{origin?.address}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <Text style={styles.routeIcon}>🎯</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>{destination?.address}</Text>
            </View>
          </View>

          <View style={styles.tripStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>${(trip.base_fare || 0).toFixed(2)}</Text>
              <Text style={styles.statLabel}>per seat</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{trip.seats_available || 0}</Text>
              <Text style={styles.statLabel}>seats left</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{confirmedBookings.length}</Text>
              <Text style={styles.statLabel}>confirmed</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: COLORS.success || '#10B981' }]}>${(trip.totalEarnings || 0).toFixed(2)}</Text>
              <Text style={styles.statLabel}>earnings</Text>
            </View>
          </View>
        </View>

        {/* Pending Bookings */}
        {pendingBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔔 Pending Requests ({pendingBookings.length})</Text>
            {pendingBookings.map((booking) => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingName}>
                    {booking.rider?.first_name || 'Rider'} {booking.rider?.last_name || ''}
                  </Text>
                  <Text style={styles.bookingDetails}>
                    {booking.seats || 1} seat(s) • ${(booking.fare || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.bookingActions}>
                  <TouchableOpacity 
                    style={styles.rejectButton}
                    onPress={() => handleRejectBooking(booking.id)}
                  >
                    <Text style={styles.rejectText}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.confirmButton}
                    onPress={() => handleConfirmBooking(booking.id)}
                  >
                    <Text style={styles.confirmText}>✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Confirmed Bookings */}
        {confirmedBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Confirmed ({confirmedBookings.length})</Text>
            {confirmedBookings.map((booking) => (
              <View key={booking.id} style={styles.confirmedCard}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingName}>
                    {booking.rider?.first_name || 'Rider'} {booking.rider?.last_name || ''}
                  </Text>
                  <Text style={styles.bookingDetails}>
                    {booking.seats || 1} seat(s) • ${(booking.fare || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.bookingStatus}>
                    {booking.status === 'picked_up' ? '🚗 Picked up' : '⏳ Waiting for pickup'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.messageButton}
                  onPress={() => handleMessageRider(booking)}
                >
                  <Text style={styles.messageButtonText}>💬</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* No Bookings */}
        {pendingBookings.length === 0 && confirmedBookings.length === 0 && (
          <View style={styles.noBookings}>
            <Text style={styles.noBookingsIcon}>👀</Text>
            <Text style={styles.noBookingsText}>Waiting for riders...</Text>
            <Text style={styles.noBookingsSubtext}>
              Riders in your direction will see your trip and can book seats
            </Text>
          </View>
        )}

        {/* End Trip Button */}
        <TouchableOpacity style={styles.endTripButton} onPress={handleEndTrip}>
          <Text style={styles.endTripText}>End Trip</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    minWidth: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1E3A5F',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapIcon: {
    fontSize: 18,
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tripCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusTextPending: {
    color: '#92400E',
  },
  goLiveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  goLiveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  routeInfo: {
    marginBottom: 20,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIcon: {
    fontSize: 16,
    marginRight: 12,
    marginTop: 2,
  },
  routeAddress: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 7,
    marginVertical: 4,
  },
  tripStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  bookingDetails: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bookingStatus: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectText: {
    fontSize: 20,
    color: '#DC2626',
  },
  confirmButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 20,
    color: '#047857',
  },
  confirmedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  messageButtonText: {
    fontSize: 20,
  },
  noBookings: {
    alignItems: 'center',
    padding: 40,
  },
  noBookingsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noBookingsText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  noBookingsSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  endTripButton: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  endTripText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  bottomPadding: {
    height: 40,
  },
});

