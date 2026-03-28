// Confirm Ride Screen - Select vehicle and confirm
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapType } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { COLORS } from '../../theme';
import { Screen, Location, RideOption, VehicleType } from '../../types';
import { useAuthStore, useWalletStore, useRideStore } from '../../stores';
import { requestRide } from '../../api/rides';
import { Button } from '../../components';
import { CONFIG } from '../../config';
import { useMapContext, MapStyle } from '../../context/MapContext';

// Map style to MapType mapping
const styleToMapType: Record<MapStyle, MapType> = {
  standard: 'standard',
  satellite: 'satellite',
  hybrid: 'hybrid',
  terrain: 'terrain',
};

interface Props {
  onNavigate: (screen: Screen) => void;
}

const RIDE_OPTIONS: RideOption[] = [
  {
    type: 'sedan',
    name: 'Standard',
    icon: '🚗',
    description: 'Affordable everyday rides',
    eta: 3,
    price: 5.50,
  },
  {
    type: 'suv',
    name: 'Comfort',
    icon: '🚙',
    description: 'Newer cars with extra legroom',
    eta: 5,
    price: 8.00,
  },
  {
    type: 'minivan',
    name: 'XL',
    icon: '🚐',
    description: 'For groups up to 6',
    eta: 8,
    price: 12.00,
  },
  {
    type: 'motorcycle',
    name: 'Moto',
    icon: '🏍️',
    description: 'Quick rides for 1 person',
    eta: 2,
    price: 3.00,
  },
];

export function ConfirmRideScreen({ onNavigate }: Props) {
  const mapRef = useRef<MapView>(null);
  const { style: mapStyle } = useMapContext();
  const { user } = useAuthStore();
  const { wallet, fetchWallet } = useWalletStore();
  const { ride, setRide } = useRideStore();
  const [selectedOption, setSelectedOption] = useState<VehicleType>('sedan');
  const [isLoading, setIsLoading] = useState(false);
  const [distance, setDistance] = useState(5.2); // km - will be updated from route
  const [duration, setDuration] = useState(15); // minutes - will be updated from route

  // Get locations from ride store
  const pickupLocation = ride?.pickup || { latitude: -17.8292, longitude: 31.0522, name: 'Current Location' };
  const dropoffLocation = ride?.dropoff || { latitude: -17.7689, longitude: 31.0850, name: 'Destination' };

  useEffect(() => {
    if (user) {
      fetchWallet(user.id);
    }
  }, [user]);

  // Calculate price based on distance
  function calculatePrice(basePrice: number): number {
    const distanceMultiplier = distance / 5; // Base price is for ~5km
    return Math.round(basePrice * distanceMultiplier * 100) / 100;
  }

  async function handleConfirmRide() {
    const option = RIDE_OPTIONS.find(o => o.type === selectedOption);
    if (!option) return;

    const price = calculatePrice(option.price);

    // Check wallet balance - must have enough to book
    if (!wallet || wallet.balance < price) {
      Alert.alert(
        'Insufficient Balance',
        `You need $${price.toFixed(2)} but only have $${(wallet?.balance || 0).toFixed(2)} in your wallet.\n\nPlease top up your wallet first.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top Up Wallet', onPress: () => onNavigate('topup') },
        ]
      );
      return;
    }

    setIsLoading(true);

    // Update ride store with final details
    if (ride) {
      setRide({
        ...ride,
        vehicleType: selectedOption,
        price,
        distance,
        duration,
        status: 'searching',
      });
    }

    console.log('Booking ride:', {
      vehicle: selectedOption,
      price,
      distance,
      duration,
      pickup: pickupLocation,
      dropoff: dropoffLocation,
    });

    // Request ride from backend
    try {
      const response = await requestRide({
        pickup: pickupLocation,
        dropoff: dropoffLocation,
        vehicleType: selectedOption,
        estimatedDistance: distance,
        estimatedDuration: duration,
        estimatedPrice: price,
      });

      if (response.success) {
        console.log('Ride requested:', response);
        
        // Update ride store with response
        if (ride && response.ride_id) {
          setRide({
            ...ride,
            status: response.status as any,
            driver: response.driver ? {
              id: response.driver.id,
              user_id: response.driver.id,
              first_name: response.driver.name.split(' ')[0],
              last_name: response.driver.name.split(' ')[1] || '',
              phone_number: '',
              rating: response.driver.rating,
              total_rides: response.driver.total_rides,
              vehicle: response.driver.vehicle ? {
                id: '',
                type: selectedOption,
                make: response.driver.vehicle.make,
                model: response.driver.vehicle.model,
                color: response.driver.vehicle.color,
                registration_number: response.driver.vehicle.registration_number,
                year: 2020,
              } : undefined,
            } : null,
          });
        }
        
        setIsLoading(false);
        onNavigate('tracking');
      } else {
        setIsLoading(false);
        Alert.alert('Error', response.error || 'Failed to request ride. Please try again.');
      }
    } catch (error) {
      console.error('Request ride error:', error);
      setIsLoading(false);
      
      // Fallback to demo mode if backend not available
      Alert.alert(
        'Demo Mode',
        'Backend not connected. Continue in demo mode?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => onNavigate('tracking') },
        ]
      );
    }
  }

  const selectedRide = RIDE_OPTIONS.find(o => o.type === selectedOption);
  const totalPrice = selectedRide ? calculatePrice(selectedRide.price) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('search')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a ride</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Mini Map with Route */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          mapType={styleToMapType[mapStyle]}
          initialRegion={{
            latitude: (pickupLocation.latitude + dropoffLocation.latitude) / 2,
            longitude: (pickupLocation.longitude + dropoffLocation.longitude) / 2,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* Pickup Marker */}
          <Marker coordinate={pickupLocation}>
            <View style={styles.pickupMarker}>
              <View style={styles.pickupMarkerInner} />
            </View>
          </Marker>

          {/* Dropoff Marker */}
          <Marker coordinate={dropoffLocation}>
            <View style={styles.dropoffMarker}>
              <View style={styles.dropoffMarkerInner} />
            </View>
          </Marker>

          {/* Route Directions */}
          {CONFIG.GOOGLE_MAPS_API_KEY && (
            <MapViewDirections
              origin={pickupLocation}
              destination={dropoffLocation}
              apikey={CONFIG.GOOGLE_MAPS_API_KEY}
              strokeWidth={4}
              strokeColor={COLORS.primary}
              optimizeWaypoints={true}
              onReady={(result) => {
                setDistance(result.distance);
                setDuration(Math.round(result.duration));
                mapRef.current?.fitToCoordinates(
                  [pickupLocation, dropoffLocation],
                  {
                    edgePadding: { top: 30, right: 30, bottom: 30, left: 30 },
                    animated: true,
                  }
                );
              }}
            />
          )}
        </MapView>
      </View>

      {/* Route Summary */}
      <View style={styles.routeSummary}>
        <View style={styles.routePoint}>
          <View style={styles.pickupDot} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>PICKUP</Text>
            <Text style={styles.routeText} numberOfLines={1}>
              {pickupLocation.name || 'Current Location'}
            </Text>
          </View>
        </View>
        <View style={styles.routeDivider} />
        <View style={styles.routePoint}>
          <View style={styles.dropoffSquare} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>DROP-OFF</Text>
            <Text style={styles.routeText} numberOfLines={1}>
              {dropoffLocation.name || 'Selected Destination'}
            </Text>
          </View>
        </View>
      </View>

      {/* Trip Info */}
      <View style={styles.tripInfo}>
        <View style={styles.tripStat}>
          <Text style={styles.tripStatValue}>{distance.toFixed(1)} km</Text>
          <Text style={styles.tripStatLabel}>Distance</Text>
        </View>
        <View style={styles.tripDivider} />
        <View style={styles.tripStat}>
          <Text style={styles.tripStatValue}>{duration} min</Text>
          <Text style={styles.tripStatLabel}>Est. Time</Text>
        </View>
        <View style={styles.tripDivider} />
        <View style={styles.tripStat}>
          <Text style={styles.tripStatValue}>${(wallet?.balance || 0).toFixed(2)}</Text>
          <Text style={styles.tripStatLabel}>Balance</Text>
        </View>
      </View>

      {/* Ride Options */}
      <ScrollView style={styles.options} showsVerticalScrollIndicator={false}>
        <Text style={styles.optionsTitle}>Available Rides</Text>
        
        {RIDE_OPTIONS.map((option) => {
          const price = calculatePrice(option.price);
          const isSelected = selectedOption === option.type;
          
          return (
            <TouchableOpacity
              key={option.type}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => setSelectedOption(option.type)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionIcon}>{option.icon}</Text>
              <View style={styles.optionInfo}>
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                    {option.name}
                  </Text>
                  <Text style={styles.optionEta}>{option.eta} min away</Text>
                </View>
                <Text style={styles.optionDesc}>{option.description}</Text>
              </View>
              <View style={styles.optionPrice}>
                <Text style={[styles.priceText, isSelected && styles.priceTextSelected]}>
                  ${price.toFixed(2)}
                </Text>
              </View>
              {isSelected && (
                <View style={styles.checkMark}>
                  <Text style={styles.checkMarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        {/* Wallet Balance Display */}
        <View style={styles.walletInfo}>
          <View style={styles.walletLeft}>
            <Text style={styles.walletIcon}>💳</Text>
            <View>
              <Text style={styles.walletLabel}>Wallet Balance</Text>
              <Text style={styles.walletAmount}>${(wallet?.balance || 0).toFixed(2)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.topUpBtn} onPress={() => onNavigate('topup')}>
            <Text style={styles.topUpBtnText}>+ Top Up</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Warning */}
        {wallet && wallet.balance < totalPrice && (
          <View style={styles.balanceWarning}>
            <Text style={styles.balanceWarningText}>
              ⚠️ Insufficient balance. You need ${totalPrice.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Payment Note */}
        <Text style={styles.paymentNote}>
          💡 Payment will be deducted when driver arrives
        </Text>
        
        <Button
          title={isLoading ? 'Finding driver...' : `Confirm Ride • $${totalPrice.toFixed(2)}`}
          onPress={handleConfirmRide}
          loading={isLoading}
          size="large"
          style={styles.confirmButton}
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
  mapContainer: {
    height: 180,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  pickupMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.success + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dropoffMarker: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropoffMarkerInner: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.primary,
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
  routeSummary: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginRight: 14,
  },
  dropoffSquare: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.text,
    marginRight: 14,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  routeText: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 2,
  },
  routeDivider: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  tripInfo: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tripStat: {
    flex: 1,
    alignItems: 'center',
  },
  tripStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  tripStatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tripDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  options: {
    flex: 1,
    paddingHorizontal: 16,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  optionIcon: {
    fontSize: 36,
    marginRight: 14,
  },
  optionInfo: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionNameSelected: {
    color: COLORS.primary,
  },
  optionEta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  optionDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  optionPrice: {
    marginLeft: 10,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  priceTextSelected: {
    color: COLORS.primary,
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  walletLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  walletAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  topUpBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  topUpBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  balanceWarningText: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
  },
  paymentNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmButton: {
    borderRadius: 14,
  },
});

