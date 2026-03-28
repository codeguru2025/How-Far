// Trip Details Screen - Rider views trip details and books a seat
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapType } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { COLORS } from '../../theme';
import { Screen, Location } from '../../types';
import { Button } from '../../components';
import { useTripStore, useWalletStore, useAuthStore } from '../../stores';
import { bookSeat } from '../../api/trips';
import { CONFIG } from '../../config';
import { useMapContext, MapStyle } from '../../context/MapContext';
import { getCurrentLocation } from '../../utils/location';

const MAP_STYLES: { key: MapStyle; label: string; icon: string }[] = [
  { key: 'standard', label: 'Map', icon: '🗺️' },
  { key: 'satellite', label: 'Satellite', icon: '🛰️' },
  { key: 'hybrid', label: 'Hybrid', icon: '🌍' },
  { key: 'terrain', label: 'Terrain', icon: '⛰️' },
];

function getMapType(style: MapStyle): MapType {
  switch (style) {
    case 'satellite': return 'satellite';
    case 'hybrid': return 'hybrid';
    case 'terrain': return 'terrain';
    default: return 'standard';
  }
}

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function TripDetailsScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const { wallet } = useWalletStore();
  const { selectedTrip, setActiveBooking, searchOrigin } = useTripStore();
  const { style: mapStyle, setStyle: setMapStyle } = useMapContext();
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [tripCoords, setTripCoords] = useState<{
    origin: { latitude: number; longitude: number } | null;
    destination: { latitude: number; longitude: number } | null;
  }>({ origin: null, destination: null });
  const [riderLocation, setRiderLocation] = useState<Location | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [pickupType, setPickupType] = useState<'at_origin' | 'custom_pickup'>('at_origin');
  const mapRef = useRef<MapView>(null);

  // Get rider's current location for pickup
  useEffect(() => {
    async function fetchRiderLocation() {
      // Use searchOrigin if already captured, otherwise get fresh location
      if (searchOrigin) {
        setRiderLocation(searchOrigin);
        return;
      }
      
      setIsGettingLocation(true);
      const result = await getCurrentLocation();
      if (result.success && result.location) {
        setRiderLocation(result.location);
      }
      setIsGettingLocation(false);
    }
    fetchRiderLocation();
  }, [searchOrigin]);

  // Fetch trip coordinates on mount
  React.useEffect(() => {
    async function fetchTripCoords() {
      if (!selectedTrip?.trip_id) return;
      
      try {
        const { supabase } = await import('../../api/supabase');
        const { data } = await supabase
          .from('trips')
          .select('origin, destination')
          .eq('id', selectedTrip.trip_id)
          .single();

        if (data) {
          const origin = typeof data.origin === 'string' ? JSON.parse(data.origin) : data.origin;
          const dest = typeof data.destination === 'string' ? JSON.parse(data.destination) : data.destination;
          
          setTripCoords({
            origin: origin ? { latitude: origin.latitude, longitude: origin.longitude } : null,
            destination: dest ? { latitude: dest.latitude, longitude: dest.longitude } : null,
          });
        }
      } catch (error) {
        console.error('Fetch trip coords error:', error);
      }
    }
    
    fetchTripCoords();
  }, [selectedTrip?.trip_id]);

  if (!selectedTrip) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trip selected</Text>
        <Button title="Go Back" onPress={() => onNavigate('find-rides')} />
      </View>
    );
  }

  const baseFare = selectedTrip.base_fare || 0;
  const tripPickupFee = selectedTrip.pickup_fee || 0;
  const totalFare = baseFare * seatsToBook;
  const pickupFeeCharge = pickupType === 'custom_pickup' ? tripPickupFee : 0;
  const subtotal = totalFare + pickupFeeCharge;
  const serviceFee = subtotal * 0.025; // 2.5% rider fee
  const grandTotal = subtotal + serviceFee;

  async function handleBookSeat() {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to book a ride');
      return;
    }

    if ((wallet?.balance || 0) < grandTotal) {
      Alert.alert(
        'Insufficient Balance',
        `You need $${grandTotal.toFixed(2)} but only have $${(wallet?.balance || 0).toFixed(2)}. Please top up your wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top Up', onPress: () => onNavigate('topup') },
        ]
      );
      return;
    }

    if (!selectedTrip) return;
    
    setIsBooking(true);
    try {
      const result = await bookSeat({
        tripId: selectedTrip.trip_id || selectedTrip.id,
        seats: seatsToBook,
        pickupType: pickupType,
        dropoffType: 'at_destination',
        pickupLocation: pickupType === 'custom_pickup' ? riderLocation || undefined : undefined,
        riderCurrentLocation: riderLocation || undefined,
      });

      if (result.success && result.booking) {
        setActiveBooking(result.booking);
        Alert.alert(
          'Booking Requested! 🎉',
          'Your booking has been sent to the driver. You\'ll be notified when they accept.',
          [{ text: 'OK', onPress: () => onNavigate('booking-active') }]
        );
      } else {
        Alert.alert('Booking Failed', result.error || 'Could not complete booking');
      }
    } catch (error) {
      console.error('Book seat error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('find-rides')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Driver Info */}
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {selectedTrip.driver_name?.charAt(0) || '?'}
            </Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{selectedTrip.driver_name || 'Driver'}</Text>
            <Text style={styles.driverRating}>⭐ {selectedTrip.driver_rating?.toFixed(1) || '5.0'}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceAmount}>${baseFare.toFixed(2)}</Text>
            <Text style={styles.priceLabel}>per seat</Text>
          </View>
        </View>

        {/* Route Map */}
        <View style={styles.mapCard}>
          <Text style={styles.sectionTitle}>Route Map</Text>
          <View style={styles.mapContainer}>
            {tripCoords.origin ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                mapType={getMapType(mapStyle)}
                initialRegion={{
                  latitude: tripCoords.origin.latitude,
                  longitude: tripCoords.origin.longitude,
                  latitudeDelta: 0.08,
                  longitudeDelta: 0.08,
                }}
                onMapReady={() => {
                  if (tripCoords.origin && tripCoords.destination && mapRef.current) {
                    mapRef.current.fitToCoordinates(
                      [tripCoords.origin, tripCoords.destination],
                      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false }
                    );
                  }
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                {/* Map Style Selector */}
                <TouchableOpacity 
                  style={styles.miniStyleButton}
                  onPress={() => setShowStylePicker(!showStylePicker)}
                >
                  <Text style={styles.miniStyleIcon}>🗺️</Text>
                </TouchableOpacity>
                
                {showStylePicker && (
                  <View style={styles.miniStyleOptions}>
                    {MAP_STYLES.map((s) => (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.miniStyleOption, mapStyle === s.key && styles.miniStyleOptionActive]}
                        onPress={() => {
                          setMapStyle(s.key);
                          setShowStylePicker(false);
                        }}
                      >
                        <Text style={styles.miniStyleOptionIcon}>{s.icon}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* Rider's pickup location */}
                {riderLocation && (
                  <Marker 
                    coordinate={riderLocation} 
                    title="Your Pickup Location"
                    description={riderLocation.address}
                  >
                    <View style={styles.riderMarker}>
                      <Text style={styles.markerIcon}>📍</Text>
                    </View>
                  </Marker>
                )}

                {/* Trip Origin Marker */}
                <Marker coordinate={tripCoords.origin} title="Trip Start">
                  <View style={styles.originMarker}>
                    <Text style={styles.markerIcon}>🟢</Text>
                  </View>
                </Marker>

                {/* Destination Marker */}
                {tripCoords.destination && (
                  <Marker coordinate={tripCoords.destination} title="Destination">
                    <View style={styles.destMarker}>
                      <Text style={styles.markerIcon}>🔴</Text>
                    </View>
                  </Marker>
                )}

                {/* Route Line */}
                {CONFIG.GOOGLE_MAPS_API_KEY && tripCoords.destination && (
                  <MapViewDirections
                    origin={tripCoords.origin}
                    destination={tripCoords.destination}
                    apikey={CONFIG.GOOGLE_MAPS_API_KEY}
                    strokeWidth={4}
                    strokeColor={COLORS.primary}
                    mode="DRIVING"
                    onReady={(result) => {
                      setRouteInfo({ distance: result.distance, duration: result.duration });
                    }}
                  />
                )}
              </MapView>
            ) : (
              <View style={styles.mapLoading}>
                <Text style={styles.mapLoadingText}>Loading map...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Your Pickup Location */}
        <View style={styles.pickupCard}>
          <View style={styles.pickupHeader}>
            <Text style={styles.sectionTitle}>Your Pickup Location</Text>
            {isGettingLocation && (
              <ActivityIndicator size="small" color={COLORS.primary} />
            )}
          </View>
          {riderLocation ? (
            <View style={styles.pickupLocation}>
              <Text style={styles.pickupIcon}>📍</Text>
              <View style={styles.pickupInfo}>
                <Text style={styles.pickupAddress}>{riderLocation.address}</Text>
                {riderLocation.name && riderLocation.name !== riderLocation.address && (
                  <Text style={styles.pickupName}>{riderLocation.name}</Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.pickupPlaceholder}>
              Using trip origin as pickup point
            </Text>
          )}
          <Text style={styles.pickupNote}>
            📞 Driver will contact you for pickup coordination
          </Text>
        </View>

        {/* Route Details */}
        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.sectionTitle}>Trip Route</Text>
            {routeInfo && (
              <View style={styles.routeStats}>
                <Text style={styles.routeStat}>{routeInfo.distance.toFixed(1)} km</Text>
                <Text style={styles.routeStatDivider}>•</Text>
                <Text style={styles.routeStat}>{Math.round(routeInfo.duration)} min</Text>
              </View>
            )}
          </View>
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>🟢</Text>
            <View>
              <Text style={styles.routeLabel}>Trip Start</Text>
              <Text style={styles.routeAddress}>{selectedTrip.origin_address}</Text>
            </View>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>🔴</Text>
            <View>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeAddress}>{selectedTrip.destination_address}</Text>
            </View>
          </View>
        </View>

        {/* Vehicle Info */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleIcon}>🚗</Text>
            <View>
              <Text style={styles.vehicleName}>
                {selectedTrip.vehicle_info?.make} {selectedTrip.vehicle_info?.model}
              </Text>
              <Text style={styles.vehicleDetails}>
                {selectedTrip.vehicle_info?.color} • {selectedTrip.vehicle_info?.registration_number}
              </Text>
            </View>
          </View>
          <View style={styles.seatsInfo}>
            <Text style={styles.seatsText}>
              🪑 {selectedTrip.available_seats || selectedTrip.seats_available} seats available
            </Text>
          </View>
        </View>

        {/* Seat Selection */}
        <View style={styles.seatsCard}>
          <Text style={styles.sectionTitle}>How many seats?</Text>
          <View style={styles.seatsSelector}>
            {[1, 2, 3, 4].map((num) => {
              const available = selectedTrip.available_seats || selectedTrip.seats_available || 0;
              const isDisabled = num > available;
              return (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.seatButton,
                    seatsToBook === num && styles.seatButtonSelected,
                    isDisabled && styles.seatButtonDisabled,
                  ]}
                  onPress={() => !isDisabled && setSeatsToBook(num)}
                  disabled={isDisabled}
                >
                  <Text style={[
                    styles.seatButtonText,
                    seatsToBook === num && styles.seatButtonTextSelected,
                    isDisabled && styles.seatButtonTextDisabled,
                  ]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Pickup Option */}
        <View style={styles.priceCard}>
          <Text style={styles.sectionTitle}>Pickup Location</Text>
          <View style={styles.pickupOptions}>
            <TouchableOpacity
              style={[styles.pickupOption, pickupType === 'at_origin' && styles.pickupOptionSelected]}
              onPress={() => setPickupType('at_origin')}
            >
              <Text style={styles.pickupOptionIcon}>📍</Text>
              <View style={styles.pickupOptionContent}>
                <Text style={[styles.pickupOptionTitle, pickupType === 'at_origin' && styles.pickupOptionTitleSelected]}>
                  Meet at Start
                </Text>
                <Text style={styles.pickupOptionDesc}>I'll go to the trip starting point</Text>
              </View>
              <Text style={styles.pickupOptionPrice}>Free</Text>
            </TouchableOpacity>
            
            {tripPickupFee > 0 && (
              <TouchableOpacity
                style={[styles.pickupOption, pickupType === 'custom_pickup' && styles.pickupOptionSelected]}
                onPress={() => setPickupType('custom_pickup')}
              >
                <Text style={styles.pickupOptionIcon}>🚗</Text>
                <View style={styles.pickupOptionContent}>
                  <Text style={[styles.pickupOptionTitle, pickupType === 'custom_pickup' && styles.pickupOptionTitleSelected]}>
                    Pick Me Up
                  </Text>
                  <Text style={styles.pickupOptionDesc}>Driver comes to my location</Text>
                </View>
                <Text style={styles.pickupOptionPrice}>+${tripPickupFee.toFixed(2)}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.priceCard}>
          <Text style={styles.sectionTitle}>Price Breakdown</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Fare ({seatsToBook} seat{seatsToBook > 1 ? 's' : ''} × ${baseFare.toFixed(2)})</Text>
            <Text style={styles.priceValue}>${totalFare.toFixed(2)}</Text>
          </View>
          {pickupFeeCharge > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Pickup Fee</Text>
              <Text style={styles.priceValue}>${pickupFeeCharge.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service Fee (2.5%)</Text>
            <Text style={styles.priceValue}>${serviceFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Wallet Balance */}
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>💳 Wallet Balance</Text>
          <Text style={[
            styles.walletAmount,
            (wallet?.balance || 0) < grandTotal && styles.walletAmountLow,
          ]}>
            ${(wallet?.balance || 0).toFixed(2)}
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <Button
          title={isBooking ? 'Booking...' : `Book ${seatsToBook} Seat${seatsToBook > 1 ? 's' : ''} • $${grandTotal.toFixed(2)}`}
          onPress={handleBookSeat}
          loading={isBooking}
          size="large"
          disabled={(wallet?.balance || 0) < grandTotal}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 20,
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
  content: {
    flex: 1,
    padding: 16,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 14,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  driverRating: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  mapCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  mapContainer: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  map: {
    flex: 1,
  },
  riderMarker: {
    backgroundColor: '#DBEAFE',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  originMarker: {
    backgroundColor: '#D1FAE5',
    padding: 6,
    borderRadius: 16,
  },
  destMarker: {
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 16,
  },
  markerIcon: {
    fontSize: 14,
  },
  pickupCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  pickupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupLocation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  pickupInfo: {
    flex: 1,
  },
  pickupAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  pickupName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pickupPlaceholder: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  pickupNote: {
    fontSize: 12,
    color: '#1D4ED8',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#93C5FD',
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  mapLoadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  miniStyleButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  miniStyleIcon: {
    fontSize: 14,
  },
  miniStyleOptions: {
    position: 'absolute',
    top: 8,
    right: 44,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  miniStyleOption: {
    padding: 6,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  miniStyleOptionActive: {
    backgroundColor: COLORS.primary + '20',
  },
  miniStyleOptionIcon: {
    fontSize: 14,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  routeStat: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  routeStatDivider: {
    marginHorizontal: 6,
    color: COLORS.primary,
  },
  routeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
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
  routeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  routeAddress: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 2,
  },
  routeDivider: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 7,
    marginVertical: 8,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  vehicleDetails: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  seatsInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  seatsText: {
    fontSize: 14,
    color: COLORS.text,
  },
  seatsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  seatsSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  seatButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  seatButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  seatButtonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  seatButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  seatButtonTextSelected: {
    color: '#FFFFFF',
  },
  seatButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  pickupOptions: {
    gap: 10,
  },
  pickupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickupOptionSelected: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  pickupOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pickupOptionContent: {
    flex: 1,
  },
  pickupOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  pickupOptionTitleSelected: {
    color: COLORS.primary,
  },
  pickupOptionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  pickupOptionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  priceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceValue: {
    fontSize: 15,
    color: COLORS.text,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  walletInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  walletLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  walletAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },
  walletAmountLow: {
    color: COLORS.error,
  },
  bottomPadding: {
    height: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

