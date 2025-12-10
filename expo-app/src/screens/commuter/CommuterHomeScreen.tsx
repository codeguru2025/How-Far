// Commuter Home Screen - For passengers looking for rides
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen, Booking } from '../../types';
import { useAuthStore, useWalletStore, useTripStore } from '../../stores';
import { getRiderActiveBooking } from '../../api/trips';
import { Button } from '../../components';
import { getActiveBookingWithValidation } from '../../utils/bookingCleanup';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function CommuterHomeScreen({ onNavigate }: Props) {
  const { user, signOut } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  const { setActiveBooking: setStoreBooking } = useTripStore();
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      if (user?.id) {
        await fetchWallet(user.id);
        // Use validated booking fetch that cleans up stale bookings
        const booking = await getActiveBookingWithValidation(user.id);
        setActiveBooking(booking);
        // Also update the store so ShowQRScreen can access it
        setStoreBooking(booking);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.first_name || 'Commuter'}! 👋</Text>
          <Text style={styles.subtitle}>Find your ride today</Text>
        </View>
        <TouchableOpacity 
          style={styles.walletBadge}
          onPress={() => onNavigate('wallet')}
        >
          <Text style={styles.walletIcon}>💳</Text>
          <Text style={styles.walletAmount}>${(wallet?.balance || 0).toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      {/* Active Booking Card */}
      {activeBooking && (
        <View style={styles.activeCard}>
          <View style={styles.activeCardHeader}>
            <Text style={styles.activeCardIcon}>🎫</Text>
            <View>
              <Text style={styles.activeCardTitle}>Active Booking</Text>
              <Text style={styles.activeCardSubtitle}>
                {activeBooking.status === 'pending' ? 'Waiting for driver' :
                 activeBooking.status === 'confirmed' ? 'Confirmed! Show QR' :
                 activeBooking.status === 'picked_up' ? 'On the way' : 'In progress'}
              </Text>
            </View>
          </View>
          
          <View style={styles.activeCardDetails}>
            <Text style={styles.activeCardRoute}>
              {activeBooking.trip?.origin?.address} → {activeBooking.trip?.destination?.address}
            </Text>
            <Text style={styles.activeCardPrice}>
              ${(activeBooking.fare || 0).toFixed(2)} • {activeBooking.seats || 1} seat(s)
            </Text>
          </View>

          <View style={styles.activeCardButtons}>
            <Button
              title="🗺️ View Map"
              onPress={() => onNavigate('rider-map')}
              variant="outline"
              style={styles.activeCardMapButton}
            />
            <Button
              title={activeBooking.status === 'confirmed' ? '📱 QR Code' : 'View'}
              onPress={() => onNavigate(activeBooking.status === 'confirmed' ? 'show-qr' : 'booking-active')}
              style={styles.activeCardQRButton}
            />
          </View>
        </View>
      )}

      {/* Main Search Card */}
      <View style={styles.searchCard}>
        <Text style={styles.searchTitle}>Where are you going?</Text>
        <TouchableOpacity 
          style={styles.searchBox}
          onPress={() => onNavigate('find-rides')}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Enter your destination</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => onNavigate('find-rides')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
            <Text style={styles.quickActionEmoji}>🚗</Text>
          </View>
          <Text style={styles.quickActionText}>Find Ride</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => onNavigate('wallet')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.quickActionEmoji}>💰</Text>
          </View>
          <Text style={styles.quickActionText}>Top Up</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => onNavigate('history')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.quickActionEmoji}>📜</Text>
          </View>
          <Text style={styles.quickActionText}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => onNavigate('profile')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
            <Text style={styles.quickActionEmoji}>👤</Text>
          </View>
          <Text style={styles.quickActionText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* How It Works */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <View style={styles.infoStep}>
          <Text style={styles.infoNumber}>1</Text>
          <Text style={styles.infoText}>Enter your destination to find available rides</Text>
        </View>
        <View style={styles.infoStep}>
          <Text style={styles.infoNumber}>2</Text>
          <Text style={styles.infoText}>Book a seat on a trip going your way</Text>
        </View>
        <View style={styles.infoStep}>
          <Text style={styles.infoNumber}>3</Text>
          <Text style={styles.infoText}>Show your QR code to the driver to pay</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  walletIcon: {
    fontSize: 16,
  },
  walletAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeCard: {
    margin: 20,
    marginTop: -20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  activeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  activeCardIcon: {
    fontSize: 32,
  },
  activeCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  activeCardSubtitle: {
    fontSize: 13,
    color: COLORS.success,
    marginTop: 2,
    fontWeight: '500',
  },
  activeCardDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  activeCardRoute: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  activeCardPrice: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  activeCardButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  activeCardMapButton: {
    flex: 1,
  },
  activeCardQRButton: {
    flex: 1,
  },
  searchCard: {
    margin: 20,
    marginTop: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  searchIcon: {
    fontSize: 20,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 0,
  },
  quickAction: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoCard: {
    margin: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  infoNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '15',
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  signOutButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '500',
  },
});

