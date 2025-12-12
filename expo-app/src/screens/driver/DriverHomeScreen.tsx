// Driver Home Screen - For drivers offering rides
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Switch,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen, Trip } from '../../types';
import { useAuthStore, useWalletStore } from '../../stores';
import { getDriverActiveTrip } from '../../api/trips';
import { supabase } from '../../api/supabase';
import { Button } from '../../components';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface DriverStats {
  totalRides: number;
  totalEarnings: number;
  rating: number;
}

export function DriverHomeScreen({ onNavigate }: Props) {
  const { user, signOut } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState<DriverStats>({ totalRides: 0, totalEarnings: 0, rating: 5.0 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadData() {
    try {
      if (user?.id) {
        await fetchWallet(user.id);
      }
      
      // Get driver info
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, is_online, total_rides, rating')
        .eq('user_id', user?.id)
        .single();
      
      if (driver) {
        setIsOnline(driver.is_online);
        
        // Get trips for this driver
        const { data: driverTrips } = await supabase
          .from('trips')
          .select('id')
          .eq('driver_id', driver.id);
        
        const tripIds = driverTrips?.map(t => t.id) || [];
        
        let totalEarned = 0;
        let ridesCount = 0;
        
        if (tripIds.length > 0) {
          // Calculate actual earnings from paid bookings
          const { data: paidBookings } = await supabase
            .from('bookings')
            .select('fare, status')
            .in('trip_id', tripIds)
            .eq('payment_status', 'paid');
          
          totalEarned = paidBookings?.reduce((sum, b) => sum + (b.fare || 0), 0) || 0;
          
          // Get completed rides count
          const { data: completedBookings } = await supabase
            .from('bookings')
            .select('id')
            .in('trip_id', tripIds)
            .in('status', ['completed', 'picked_up']);
          
          ridesCount = completedBookings?.length || 0;
        }
        
        setStats({
          totalRides: ridesCount || driver.total_rides || 0,
          totalEarnings: totalEarned,
          rating: driver.rating || 5.0,
        });
      }

      // Get active trip
      const trip = await getDriverActiveTrip();
      if (__DEV__) console.log('DriverHomeScreen - activeTrip:', trip?.id, trip?.status);
      setActiveTrip(trip);
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

  async function toggleOnline(value: boolean) {
    setIsOnline(value);
    try {
      await supabase
        .from('drivers')
        .update({ is_online: value })
        .eq('user_id', user?.id);
    } catch (error) {
      console.error('Toggle online error:', error);
      setIsOnline(!value); // Revert
    }
  }

  const pendingBookings = activeTrip?.bookings?.filter(b => b.status === 'pending').length || 0;
  const confirmedBookings = activeTrip?.bookings?.filter(b => 
    b.status === 'confirmed' || b.status === 'picked_up'
  ).length || 0;

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
          <Text style={styles.greeting}>Hello, {user?.first_name || 'Driver'}! 🚗</Text>
          <Text style={styles.subtitle}>Ready to earn today?</Text>
        </View>
        <View style={styles.onlineToggle}>
          <Text style={styles.onlineLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: '#9CA3AF', true: COLORS.success }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${stats.totalEarnings.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalRides}</Text>
          <Text style={styles.statLabel}>Total Rides</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>⭐ {stats.rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Active Trip Card */}
      {activeTrip ? (
        <View style={styles.activeCard}>
          <View style={styles.activeCardHeader}>
            <Text style={styles.activeCardIcon}>🚗</Text>
            <View style={styles.activeCardHeaderText}>
              <Text style={styles.activeCardTitle}>Active Trip</Text>
              <Text style={styles.activeCardSubtitle}>
                {activeTrip.status === 'active' ? 'Accepting bookings' :
                 activeTrip.status === 'in_progress' ? 'Trip in progress' : activeTrip.status}
              </Text>
            </View>
          </View>
          
          <View style={styles.activeCardDetails}>
            <Text style={styles.activeCardRoute}>
              📍 {typeof activeTrip.origin === 'object' ? activeTrip.origin?.address : 'Origin'}
            </Text>
            <Text style={styles.activeCardRoute}>
              🎯 {typeof activeTrip.destination === 'object' ? activeTrip.destination?.address : 'Destination'}
            </Text>
            <Text style={styles.activeCardPrice}>
              ${activeTrip.base_fare?.toFixed(2)} per seat • {activeTrip.seats_available || activeTrip.available_seats} seats left
            </Text>
          </View>

          {/* Booking Stats */}
          <View style={styles.bookingStats}>
            {pendingBookings > 0 && (
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>🔔 {pendingBookings} pending</Text>
              </View>
            )}
            {confirmedBookings > 0 && (
              <View style={[styles.statBadge, styles.statBadgeSuccess]}>
                <Text style={styles.statBadgeText}>✅ {confirmedBookings} confirmed</Text>
              </View>
            )}
          </View>

          <View style={styles.activeCardButtons}>
            <Button
              title="Manage Trip"
              onPress={() => onNavigate('trip-dashboard')}
              style={styles.activeCardButton}
            />
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={() => onNavigate('scan-qr')}
            >
              <Text style={styles.scanButtonText}>📷 Scan QR</Text>
            </TouchableOpacity>
          </View>
          
          {/* Start Trip Button - shown when passengers confirmed */}
          {confirmedBookings > 0 && (
            <TouchableOpacity 
              style={styles.startTripButton}
              onPress={() => onNavigate('trip-active')}
            >
              <Text style={styles.startTripIcon}>🚀</Text>
              <Text style={styles.startTripText}>Start Trip with {confirmedBookings} Passenger(s)</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* Create Trip Card */
        <View style={styles.createCard}>
          <Text style={styles.createIcon}>🛣️</Text>
          <Text style={styles.createTitle}>Start a Trip</Text>
          <Text style={styles.createSubtitle}>
            Set your destination and pick up passengers along the way
          </Text>
          <Button
            title="Create New Trip"
            onPress={() => onNavigate('create-trip')}
            size="large"
            style={styles.createButton}
          />
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => onNavigate('create-trip')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
            <Text style={styles.quickActionEmoji}>➕</Text>
          </View>
          <Text style={styles.quickActionText}>New Trip</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => onNavigate('scan-qr')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.quickActionEmoji}>📷</Text>
          </View>
          <Text style={styles.quickActionText}>Scan QR</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => onNavigate('withdraw')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.quickActionEmoji}>💵</Text>
          </View>
          <Text style={styles.quickActionText}>Withdraw</Text>
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

      {/* Settings Row */}
      <View style={styles.settingsRow}>
        <TouchableOpacity 
          style={styles.settingsAction}
          onPress={() => onNavigate('language-settings')}
        >
          <Text style={styles.settingsActionIcon}>🌍</Text>
          <View style={styles.settingsActionInfo}>
            <Text style={styles.settingsActionTitle}>Language & Announcements</Text>
            <Text style={styles.settingsActionSubtitle}>Shona, Ndebele, English • Voice settings</Text>
          </View>
          <Text style={styles.settingsArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Earnings Card */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsHeader}>
          <Text style={styles.earningsTitle}>💰 Your Wallet</Text>
          <TouchableOpacity onPress={() => onNavigate('wallet')}>
            <Text style={styles.earningsLink}>View Details →</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.earningsBalance}>${(wallet?.balance || 0).toFixed(2)}</Text>
        <Text style={styles.earningsNote}>Available for withdrawal</Text>
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
    backgroundColor: '#1E3A5F', // Different color for driver
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
  onlineToggle: {
    alignItems: 'center',
  },
  onlineLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: -20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  activeCard: {
    margin: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  activeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  activeCardHeaderText: {
    flex: 1,
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
    gap: 6,
  },
  activeCardRoute: {
    fontSize: 14,
    color: COLORS.text,
  },
  activeCardPrice: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  bookingStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statBadgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  activeCardButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  activeCardButton: {
    flex: 1,
  },
  scanButton: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  createCard: {
    margin: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  createIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  createSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createButton: {
    width: '100%',
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
  earningsCard: {
    margin: 20,
    backgroundColor: '#1E3A5F',
    borderRadius: 20,
    padding: 20,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  earningsLink: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  earningsBalance: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  earningsNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
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
  startTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    gap: 10,
  },
  startTripIcon: {
    fontSize: 20,
  },
  startTripText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  settingsRow: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  settingsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsActionIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  settingsActionInfo: {
    flex: 1,
  },
  settingsActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  settingsActionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  settingsArrow: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
});

