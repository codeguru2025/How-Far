// Trip Active Screen - Driver's view during an active trip with announcements
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { Button } from '../../components';
import { CONFIG } from '../../config';
import { getDriverActiveTrip, completeTrip } from '../../api/trips';
import { supabase } from '../../api/supabase';
import { 
  useAnnouncements, 
  PassengerInfo, 
  TripAnnouncementInfo 
} from '../../services/announcements';
import { useLanguage } from '../../context/LanguageContext';
import { optimizePickupRoute } from '../../utils/location';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface Passenger {
  id: string;
  name: string;
  seats: number;
  fare: number;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  dropoffAddress?: string;
  status: 'waiting' | 'onboard' | 'dropped_off';
}

interface TripData {
  id: string;
  origin: { latitude: number; longitude: number; address: string };
  destination: { latitude: number; longitude: number; address: string };
  passengers: Passenger[];
}

export function TripActiveScreen({ onNavigate }: Props) {
  const mapRef = useRef<MapView>(null);
  const { t } = useLanguage();
  const {
    settings: announcementSettings,
    initTrip,
    checkLocation,
    announceAllAboard,
    announceNextStop,
    stopAnnouncements,
    clearTrip,
  } = useAnnouncements();

  const [isLoading, setIsLoading] = useState(true);
  const [trip, setTrip] = useState<TripData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [allPassengersOnboard, setAllPassengersOnboard] = useState(false);
  const [tripStarted, setTripStarted] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [optimizedStops, setOptimizedStops] = useState<Passenger[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

  // Load trip data
  useEffect(() => {
    loadTripData();
    startLocationTracking();

    return () => {
      clearTrip();
      stopAnnouncements();
    };
  }, []);

  // Initialize announcements when trip loads
  useEffect(() => {
    if (trip && trip.passengers.length > 0) {
      // Optimize the route
      const onboardPassengers = trip.passengers.filter(p => p.status === 'onboard');
      
      if (driverLocation && onboardPassengers.length > 0) {
        const pickupPoints = onboardPassengers.map(p => ({
          id: p.id,
          latitude: p.dropoffLatitude || trip.destination.latitude,
          longitude: p.dropoffLongitude || trip.destination.longitude,
          riderName: p.name,
          seats: p.seats,
        }));

        const optimized = optimizePickupRoute(
          driverLocation,
          pickupPoints,
          trip.destination
        );

        // Map optimized order back to passengers
        const orderedPassengers = optimized.orderedPickups.map(p => 
          onboardPassengers.find(pass => pass.id === p.id)!
        );
        setOptimizedStops(orderedPassengers);
      }

      // Initialize announcement service
      const announcementInfo: TripAnnouncementInfo = {
        id: trip.id,
        destination: trip.destination,
        passengers: trip.passengers
          .filter(p => p.status === 'onboard')
          .map(p => ({
            id: p.id,
            name: p.name,
            dropoffLatitude: p.dropoffLatitude || trip.destination.latitude,
            dropoffLongitude: p.dropoffLongitude || trip.destination.longitude,
            dropoffAddress: p.dropoffAddress || trip.destination.address,
            seats: p.seats,
          })),
        hasStarted: tripStarted,
        hasAnnouncedAllAboard: allPassengersOnboard && tripStarted,
      };
      initTrip(announcementInfo);
    }
  }, [trip, driverLocation, tripStarted]);

  // Check announcements on location update
  useEffect(() => {
    if (driverLocation && tripStarted && announcementSettings.enabled) {
      checkLocation(driverLocation.latitude, driverLocation.longitude);
    }
  }, [driverLocation, tripStarted]);

  async function loadTripData() {
    try {
      const activeTrip = await getDriverActiveTrip(true);
      
      if (!activeTrip) {
        Alert.alert('No Active Trip', 'You don\'t have an active trip.');
        onNavigate('driver-home');
        return;
      }

      const origin = typeof activeTrip.origin === 'string' 
        ? JSON.parse(activeTrip.origin) 
        : activeTrip.origin;
      const destination = typeof activeTrip.destination === 'string' 
        ? JSON.parse(activeTrip.destination) 
        : activeTrip.destination;

      // Map bookings to passengers
      const passengers: Passenger[] = (activeTrip.bookings || [])
        .filter((b: any) => b.status === 'confirmed')
        .map((b: any) => ({
          id: b.id,
          name: b.rider?.first_name || 'Passenger',
          seats: b.seats || 1,
          fare: b.fare || 0,
          pickupLatitude: b.pickup_latitude,
          pickupLongitude: b.pickup_longitude,
          pickupAddress: b.pickup_address,
          dropoffLatitude: b.dropoff_latitude || destination.latitude,
          dropoffLongitude: b.dropoff_longitude || destination.longitude,
          dropoffAddress: b.dropoff_address || destination.address,
          status: 'waiting' as const,
        }));

      setTrip({
        id: activeTrip.id,
        origin,
        destination,
        passengers,
      });
    } catch (error) {
      console.error('Load trip error:', error);
      Alert.alert('Error', 'Failed to load trip data');
    } finally {
      setIsLoading(false);
    }
  }

  async function startLocationTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed for navigation.');
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({});
      setDriverLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Watch location
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 20, // Update every 20 meters
          timeInterval: 5000, // Or every 5 seconds
        },
        (newLocation) => {
          setDriverLocation({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          });
        }
      );
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  }

  function handlePassengerOnboard(passengerId: string) {
    if (!trip) return;

    const updatedPassengers = trip.passengers.map(p =>
      p.id === passengerId ? { ...p, status: 'onboard' as const } : p
    );
    setTrip({ ...trip, passengers: updatedPassengers });

    // Check if all passengers are now onboard
    const allOnboard = updatedPassengers.every(p => p.status === 'onboard');
    if (allOnboard && !allPassengersOnboard) {
      setAllPassengersOnboard(true);
    }
  }

  function handleStartTrip() {
    if (!allPassengersOnboard) {
      Alert.alert(
        'Start Trip?',
        'Not all passengers are marked as onboard. Start anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Start Anyway', 
            onPress: () => {
              setTripStarted(true);
              const onboardCount = trip?.passengers.filter(p => p.status === 'onboard').length || 0;
              if (onboardCount > 0) {
                announceAllAboard(onboardCount);
              }
            }
          },
        ]
      );
    } else {
      setTripStarted(true);
      announceAllAboard(trip?.passengers.length || 0);
    }
  }

  function handleDropOff(passenger: Passenger) {
    if (!trip) return;

    Alert.alert(
      'Confirm Drop-off',
      `Mark ${passenger.name} as dropped off?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            const updatedPassengers = trip.passengers.map(p =>
              p.id === passenger.id ? { ...p, status: 'dropped_off' as const } : p
            );
            setTrip({ ...trip, passengers: updatedPassengers });
            setCurrentStopIndex(prev => prev + 1);

            // Check if all passengers dropped off
            const allDroppedOff = updatedPassengers.every(p => p.status === 'dropped_off');
            if (allDroppedOff) {
              handleTripComplete();
            }
          },
        },
      ]
    );
  }

  function handleManualAnnounce(passenger: Passenger) {
    announceNextStop(passenger.name, passenger.dropoffAddress || 'destination');
  }

  async function handleTripComplete() {
    if (!trip) return;

    try {
      await completeTrip(trip.id);
      clearTrip();
      stopAnnouncements();
      Alert.alert(
        'Trip Complete! 🎉',
        'All passengers have been dropped off.',
        [{ text: 'OK', onPress: () => onNavigate('driver-home') }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to complete trip');
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🚗</Text>
        <Text style={styles.emptyTitle}>No Active Trip</Text>
        <Button title="Go Back" onPress={() => onNavigate('driver-home')} />
      </View>
    );
  }

  const onboardPassengers = trip.passengers.filter(p => p.status === 'onboard');
  const waitingPassengers = trip.passengers.filter(p => p.status === 'waiting');
  const droppedPassengers = trip.passengers.filter(p => p.status === 'dropped_off');
  const currentStop = optimizedStops[currentStopIndex] || onboardPassengers[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => onNavigate('trip-dashboard')}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {tripStarted ? 'Trip In Progress' : 'Boarding'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {onboardPassengers.length} onboard • {droppedPassengers.length} dropped off
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => onNavigate('language-settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          initialRegion={driverLocation ? {
            ...driverLocation,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          } : undefined}
        >
          {/* Current stop marker */}
          {currentStop && tripStarted && (
            <Marker
              coordinate={{
                latitude: currentStop.dropoffLatitude || trip.destination.latitude,
                longitude: currentStop.dropoffLongitude || trip.destination.longitude,
              }}
              title={`Next: ${currentStop.name}`}
            >
              <View style={styles.nextStopMarker}>
                <Text style={styles.nextStopNumber}>{currentStopIndex + 1}</Text>
              </View>
            </Marker>
          )}

          {/* Destination */}
          <Marker coordinate={trip.destination} title="Final Destination">
            <View style={styles.destMarker}>
              <Text style={styles.markerIcon}>🏁</Text>
            </View>
          </Marker>

          {/* Route to next stop or destination */}
          {driverLocation && CONFIG.GOOGLE_MAPS_API_KEY && (
            <MapViewDirections
              origin={driverLocation}
              destination={
                currentStop && tripStarted
                  ? {
                      latitude: currentStop.dropoffLatitude || trip.destination.latitude,
                      longitude: currentStop.dropoffLongitude || trip.destination.longitude,
                    }
                  : trip.destination
              }
              apikey={CONFIG.GOOGLE_MAPS_API_KEY}
              strokeWidth={5}
              strokeColor={tripStarted ? '#10B981' : COLORS.primary}
              mode="DRIVING"
              onReady={(result) => {
                setRouteInfo({ distance: result.distance, duration: result.duration });
              }}
            />
          )}
        </MapView>

        {/* Route info overlay */}
        {routeInfo && (
          <View style={styles.routeOverlay}>
            <Text style={styles.routeDistance}>{routeInfo.distance.toFixed(1)} km</Text>
            <Text style={styles.routeDuration}>~{Math.round(routeInfo.duration)} min</Text>
          </View>
        )}
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Current/Next Stop Info */}
        {tripStarted && currentStop && (
          <View style={styles.currentStopCard}>
            <View style={styles.currentStopHeader}>
              <View style={styles.stopBadge}>
                <Text style={styles.stopBadgeText}>NEXT STOP</Text>
              </View>
              <TouchableOpacity
                style={styles.announceButton}
                onPress={() => handleManualAnnounce(currentStop)}
              >
                <Text style={styles.announceButtonText}>🔊 Announce</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.currentStopInfo}>
              <View style={styles.passengerAvatar}>
                <Text style={styles.passengerAvatarText}>{currentStop.name[0]}</Text>
              </View>
              <View style={styles.passengerDetails}>
                <Text style={styles.passengerName}>{currentStop.name}</Text>
                <Text style={styles.passengerDropoff}>
                  📍 {currentStop.dropoffAddress || trip.destination.address}
                </Text>
              </View>
            </View>
            <Button
              title={`Drop Off ${currentStop.name}`}
              onPress={() => handleDropOff(currentStop)}
              size="large"
              style={styles.dropoffButton}
            />
          </View>
        )}

        {/* Waiting Passengers (before trip starts) */}
        {!tripStarted && waitingPassengers.length > 0 && (
          <View style={styles.waitingSection}>
            <Text style={styles.sectionTitle}>Waiting to Board</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {waitingPassengers.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.waitingCard}
                  onPress={() => handlePassengerOnboard(p.id)}
                >
                  <View style={styles.waitingAvatar}>
                    <Text style={styles.waitingAvatarText}>{p.name[0]}</Text>
                  </View>
                  <Text style={styles.waitingName}>{p.name}</Text>
                  <Text style={styles.waitingSeats}>{p.seats} seat(s)</Text>
                  <View style={styles.tapToBoard}>
                    <Text style={styles.tapToBoardText}>Tap when onboard</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Onboard Passengers */}
        {onboardPassengers.length > 0 && !tripStarted && (
          <View style={styles.onboardSection}>
            <Text style={styles.sectionTitle}>
              ✓ Onboard ({onboardPassengers.length})
            </Text>
            <View style={styles.onboardList}>
              {onboardPassengers.map((p) => (
                <View key={p.id} style={styles.onboardChip}>
                  <Text style={styles.onboardChipText}>{p.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Start Trip Button */}
        {!tripStarted && onboardPassengers.length > 0 && (
          <Button
            title={allPassengersOnboard ? "🚀 Start Trip" : "Start Trip (Not All Aboard)"}
            onPress={handleStartTrip}
            size="large"
            style={!allPassengersOnboard ? { ...styles.startButton, ...styles.startButtonWarning } : styles.startButton}
          />
        )}

        {/* Announcement Status */}
        <View style={styles.announcementStatus}>
          <Text style={styles.announcementIcon}>
            {announcementSettings.enabled ? '🔊' : '🔇'}
          </Text>
          <Text style={styles.announcementText}>
            {announcementSettings.enabled 
              ? `Announcements ON (${announcementSettings.language.toUpperCase()})` 
              : 'Announcements OFF'}
          </Text>
          <TouchableOpacity onPress={() => onNavigate('language-settings')}>
            <Text style={styles.announcementSettings}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  headerCenter: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  nextStopMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  nextStopNumber: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  destMarker: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 24,
  },
  markerIcon: {
    fontSize: 20,
  },
  routeOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  routeDistance: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  routeDuration: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.8,
    marginTop: 2,
  },
  bottomPanel: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '50%',
  },
  currentStopCard: {
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  currentStopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stopBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  announceButton: {
    backgroundColor: '#065F46',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  announceButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  currentStopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  passengerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 20,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065F46',
  },
  passengerDropoff: {
    fontSize: 13,
    color: '#047857',
    marginTop: 4,
  },
  dropoffButton: {
    backgroundColor: '#047857',
  },
  waitingSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  waitingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 110,
  },
  waitingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  waitingAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  waitingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  waitingSeats: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  tapToBoard: {
    marginTop: 10,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tapToBoardText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  onboardSection: {
    marginBottom: 16,
  },
  onboardList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  onboardChip: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  onboardChipText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 13,
  },
  startButton: {
    marginBottom: 16,
  },
  startButtonWarning: {
    backgroundColor: '#F59E0B',
  },
  announcementStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  announcementIcon: {
    fontSize: 16,
  },
  announcementText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  announcementSettings: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
});


