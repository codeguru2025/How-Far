// Shared Home Screen - Mode switching between Driver and Rider
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen, AppMode, Trip, Booking } from '../../types';
import { useTripStore, useAuthStore, useWalletStore } from '../../stores';
import { getDriverActiveTrip, getRiderActiveBooking } from '../../api/trips';
import { Button } from '../../components';
import { supabase } from '../../api/supabase';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function SharedHomeScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const { wallet } = useWalletStore();
  const { 
    mode, setMode, 
    currentTrip, setCurrentTrip,
    activeBooking, setActiveBooking,
  } = useTripStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);
  const [driverCheckDone, setDriverCheckDone] = useState(false);

  // Check if user is registered as driver
  useEffect(() => {
    async function checkDriverStatus() {
      if (!user?.id) {
        console.log('No user ID, skipping driver check');
        setDriverCheckDone(true);
        return;
      }
      
      console.log('Checking driver status for user:', user.id);
      
      try {
        const { data, error } = await supabase
          .from('drivers')
          .select('id, first_name')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle to avoid error on no match
        
        console.log('Driver check result:', { data, error });
        
        if (error) {
          console.error('Driver check error:', error);
          setIsDriver(false);
        } else {
          setIsDriver(!!data);
          console.log('Is driver:', !!data);
        }
      } catch (e) {
        console.error('Driver check exception:', e);
        setIsDriver(false);
      }
      setDriverCheckDone(true);
    }
    checkDriverStatus();
  }, [user?.id]);

  useEffect(() => {
    loadActiveData();
  }, [mode]);

  async function loadActiveData() {
    setIsLoading(true);
    try {
      if (mode === 'driver') {
        const trip = await getDriverActiveTrip();
        setCurrentTrip(trip);
      } else {
        const booking = await getRiderActiveBooking();
        setActiveBooking(booking);
      }
    } catch (error) {
      console.error('Load active data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleModeSwitch(newMode: AppMode) {
    if (newMode === 'driver') {
      // Re-check driver status in case it changed
      const { data, error } = await supabase
        .from('drivers')
        .select('id, first_name')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      console.log('Mode switch driver check:', { userId: user?.id, data, error });
      
      if (data) {
        setIsDriver(true);
        setMode('driver');
      } else {
        // Not registered as driver - prompt to register
        Alert.alert(
          'Become a Driver',
          'You need to register as a driver to create trips and earn money.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Register Now', onPress: () => onNavigate('register-driver') },
          ]
        );
      }
    } else {
      setMode('rider');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.first_name || 'there'}! 👋</Text>
          <Text style={styles.subtitle}>Where are you headed today?</Text>
          {/* Debug: Show user ID and driver status */}
          <Text style={styles.debugText}>
            {isDriver ? '✅ Driver' : '❌ Not Driver'} | ID: {user?.id?.slice(0, 8)}...
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.walletBadge}
          onPress={() => onNavigate('wallet')}
        >
          <Text style={styles.walletAmount}>${(wallet?.balance || 0).toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Switcher */}
      <View style={styles.modeSwitcher}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'rider' && styles.modeTabActive]}
          onPress={() => handleModeSwitch('rider')}
        >
          <Text style={styles.modeIcon}>🚶</Text>
          <Text style={[styles.modeText, mode === 'rider' && styles.modeTextActive]}>
            Rider
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'driver' && styles.modeTabActive]}
          onPress={() => handleModeSwitch('driver')}
        >
          <Text style={styles.modeIcon}>🚗</Text>
          <Text style={[styles.modeText, mode === 'driver' && styles.modeTextActive]}>
            Driver
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content based on mode */}
      {mode === 'rider' ? (
        <RiderHomeContent 
          activeBooking={activeBooking}
          onNavigate={onNavigate}
          isLoading={isLoading}
        />
      ) : (
        <DriverHomeContent 
          activeTrip={currentTrip}
          onNavigate={onNavigate}
          isLoading={isLoading}
        />
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction} onPress={() => onNavigate('history')}>
          <Text style={styles.quickActionIcon}>📜</Text>
          <Text style={styles.quickActionText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => onNavigate('wallet')}>
          <Text style={styles.quickActionIcon}>💳</Text>
          <Text style={styles.quickActionText}>Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => onNavigate('profile')}>
          <Text style={styles.quickActionIcon}>👤</Text>
          <Text style={styles.quickActionText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Rider Home Content
function RiderHomeContent({ 
  activeBooking, 
  onNavigate, 
  isLoading 
}: { 
  activeBooking: Booking | null;
  onNavigate: (screen: Screen) => void;
  isLoading: boolean;
}) {
  if (activeBooking) {
    return (
      <View style={styles.activeCard}>
        <View style={styles.activeCardHeader}>
          <Text style={styles.activeCardIcon}>🎫</Text>
          <View>
            <Text style={styles.activeCardTitle}>Active Booking</Text>
            <Text style={styles.activeCardSubtitle}>
              {activeBooking.status === 'pending' ? 'Waiting for driver approval' :
               activeBooking.status === 'confirmed' ? 'Confirmed! Show QR to driver' :
               activeBooking.status === 'picked_up' ? 'On the way' : 'In progress'}
            </Text>
          </View>
        </View>
        
        <View style={styles.activeCardDetails}>
          <Text style={styles.activeCardRoute}>
            {activeBooking.trip?.origin?.address} → {activeBooking.trip?.destination?.address}
          </Text>
          <Text style={styles.activeCardPrice}>
            ${activeBooking.total_amount?.toFixed(2)} • {activeBooking.seats_booked} seat(s)
          </Text>
        </View>

        <Button
          title={activeBooking.status === 'confirmed' ? 'Show QR Code' : 'View Booking'}
          onPress={() => onNavigate(activeBooking.status === 'confirmed' ? 'show-qr' : 'booking-active')}
          style={styles.activeCardButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.searchCard}>
      <Text style={styles.searchTitle}>Find a Ride</Text>
      <Text style={styles.searchSubtitle}>
        Search for trips going your way
      </Text>
      
      <TouchableOpacity 
        style={styles.searchBox}
        onPress={() => onNavigate('find-rides')}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Where to?</Text>
      </TouchableOpacity>

      <View style={styles.recentDestinations}>
        <Text style={styles.recentTitle}>Popular Destinations</Text>
        {['Harare CBD', 'Bulawayo', 'Mutare', 'Gweru'].map((place) => (
          <TouchableOpacity key={place} style={styles.recentItem}>
            <Text style={styles.recentIcon}>📍</Text>
            <Text style={styles.recentText}>{place}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Driver Home Content
function DriverHomeContent({ 
  activeTrip, 
  onNavigate, 
  isLoading 
}: { 
  activeTrip: Trip | null;
  onNavigate: (screen: Screen) => void;
  isLoading: boolean;
}) {
  if (activeTrip) {
    const confirmedBookings = activeTrip.bookings?.filter(b => 
      b.status === 'confirmed' || b.status === 'picked_up'
    ).length || 0;
    const pendingBookings = activeTrip.bookings?.filter(b => b.status === 'pending').length || 0;

    return (
      <View style={styles.activeCard}>
        <View style={styles.activeCardHeader}>
          <Text style={styles.activeCardIcon}>🚗</Text>
          <View>
            <Text style={styles.activeCardTitle}>Active Trip</Text>
            <Text style={styles.activeCardSubtitle}>
              {activeTrip.status === 'active' ? 'Accepting bookings' :
               activeTrip.status === 'in_progress' ? 'Trip in progress' : activeTrip.status}
            </Text>
          </View>
        </View>
        
        <View style={styles.activeCardDetails}>
          <Text style={styles.activeCardRoute}>
            {activeTrip.origin?.address} → {activeTrip.destination?.address}
          </Text>
          <Text style={styles.activeCardPrice}>
            ${activeTrip.base_fare?.toFixed(2)} per seat • {activeTrip.available_seats} seats left
          </Text>
        </View>

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

        <Button
          title="Manage Trip"
          onPress={() => onNavigate('trip-dashboard')}
          style={styles.activeCardButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.searchCard}>
      <Text style={styles.searchTitle}>Start a Trip</Text>
      <Text style={styles.searchSubtitle}>
        Create a trip and let riders find you
      </Text>
      
      <View style={styles.driverSteps}>
        <View style={styles.driverStep}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>Set your destination</Text>
        </View>
        <View style={styles.driverStep}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>Add stops & set fares</Text>
        </View>
        <View style={styles.driverStep}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>Go live & accept riders</Text>
        </View>
      </View>

      <Button
        title="Create New Trip"
        onPress={() => onNavigate('create-trip')}
        size="large"
        style={styles.createTripButton}
      />
      
      <TouchableOpacity
        style={styles.addVehicleLink}
        onPress={() => onNavigate('add-vehicle')}
      >
        <Text style={styles.addVehicleLinkText}>🚗 Add or manage your vehicle</Text>
      </TouchableOpacity>
    </View>
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
    paddingBottom: 20,
    backgroundColor: COLORS.primary,
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
  debugText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  walletBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  walletAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modeSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: -25,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
  },
  modeIcon: {
    fontSize: 18,
  },
  modeText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  searchCard: {
    margin: 20,
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
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  searchSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  searchIcon: {
    fontSize: 20,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  recentDestinations: {
    marginTop: 24,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  recentIcon: {
    fontSize: 16,
  },
  recentText: {
    fontSize: 15,
    color: COLORS.text,
  },
  driverSteps: {
    marginBottom: 24,
  },
  driverStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  stepText: {
    fontSize: 15,
    color: COLORS.text,
  },
  createTripButton: {
    marginTop: 8,
  },
  addVehicleLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  addVehicleLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  activeCard: {
    margin: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
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
    color: COLORS.textSecondary,
    marginTop: 2,
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
  activeCardButton: {
    marginTop: 8,
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
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
    marginHorizontal: 20,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 90,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
});

