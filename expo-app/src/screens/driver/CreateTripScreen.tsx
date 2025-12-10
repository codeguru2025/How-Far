// Create Trip Screen - Driver creates a new trip
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { COLORS } from '../../theme';
import { Screen, Location } from '../../types';
import { Button } from '../../components';
import { CONFIG } from '../../config';
import { useTripStore, useAuthStore } from '../../stores';
import { createTrip, startTrip } from '../../api/trips';
import { supabase } from '../../api/supabase';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function CreateTripScreen({ onNavigate }: Props) {
  const mapRef = useRef<MapView>(null);
  const { user } = useAuthStore();
  const { tripDraft, setTripDraft, resetTripDraft } = useTripStore();
  
  const [step, setStep] = useState<'origin' | 'destination' | 'details'>('origin');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

  useEffect(() => {
    loadVehicles();
    resetTripDraft();
  }, []);

  async function loadVehicles() {
    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (driver) {
        const { data } = await supabase
          .from('vehicles')
          .select('*')
          .eq('driver_id', driver.id)
          .eq('is_active', true);
        
        setVehicles(data || []);
        if (data && data.length > 0) {
          setSelectedVehicle(data[0].id);
        }
      }
    } catch (error) {
      console.error('Load vehicles error:', error);
    }
  }

  async function searchPlaces(query: string) {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${CONFIG.GOOGLE_MAPS_API_KEY}&components=country:zw`
      );
      const data = await response.json();
      setSearchResults(data.predictions || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }

  async function selectPlace(placeId: string, description: string) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${CONFIG.GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.result?.geometry?.location) {
        const location: Location = {
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
          address: data.result.formatted_address || description,
          name: description,
        };

        if (step === 'origin') {
          setTripDraft({ origin: location });
          setStep('destination');
        } else if (step === 'destination') {
          setTripDraft({ destination: location });
          setStep('details');
        }
        
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Place details error:', error);
    }
  }

  async function handleCreateTrip() {
    if (!tripDraft.origin || !tripDraft.destination || !selectedVehicle) {
      Alert.alert('Missing Info', 'Please set origin, destination, and select a vehicle.');
      return;
    }

    if (tripDraft.baseFare <= 0) {
      Alert.alert('Invalid Fare', 'Please set a valid base fare.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTrip({
        origin: tripDraft.origin,
        destination: tripDraft.destination,
        vehicleId: selectedVehicle,
        tripType: tripDraft.tripType,
        totalSeats: tripDraft.totalSeats,
        baseFare: tripDraft.baseFare,
        pickupFee: tripDraft.pickupFee,
        dropoffFee: tripDraft.dropoffFee,
        waypoints: tripDraft.waypoints.map(w => w.location),
      });

      if (result.success && result.trip) {
        // Ask if they want to go live now
        Alert.alert(
          'Trip Created! 🎉',
          'Your trip has been created. Do you want to go live and start accepting riders?',
          [
            { 
              text: 'Later', 
              style: 'cancel',
              onPress: () => onNavigate('driver-home'),
            },
            { 
              text: 'Go Live Now', 
              onPress: async () => {
                const success = await startTrip(result.trip.id);
                if (success) {
                  onNavigate('trip-dashboard');
                } else {
                  Alert.alert('Error', 'Failed to go live. Please try again.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to create trip');
      }
    } catch (error) {
      console.error('Create trip error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  const renderLocationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {step === 'origin' ? '📍 Where are you starting from?' : '🎯 Where are you going?'}
      </Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={step === 'origin' ? 'Enter pickup location...' : 'Enter destination...'}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchPlaces(text);
          }}
          autoFocus
        />
      </View>

      {searchResults.length > 0 && (
        <ScrollView style={styles.searchResults}>
          {searchResults.map((result) => (
            <TouchableOpacity
              key={result.place_id}
              style={styles.searchResultItem}
              onPress={() => selectPlace(result.place_id, result.description)}
            >
              <Text style={styles.searchResultIcon}>📍</Text>
              <View style={styles.searchResultText}>
                <Text style={styles.searchResultMain} numberOfLines={1}>
                  {result.structured_formatting?.main_text || result.description}
                </Text>
                <Text style={styles.searchResultSecondary} numberOfLines={1}>
                  {result.structured_formatting?.secondary_text || ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Show selected locations */}
      {tripDraft.origin && step === 'destination' && (
        <View style={styles.selectedLocation}>
          <Text style={styles.selectedLabel}>From:</Text>
          <Text style={styles.selectedAddress}>{tripDraft.origin.address}</Text>
        </View>
      )}
    </View>
  );

  const renderDetailsStep = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🚗 Trip Details</Text>

      {/* Map Preview */}
      {tripDraft.origin && tripDraft.destination && (
        <View style={styles.mapPreview}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: (tripDraft.origin.latitude + tripDraft.destination.latitude) / 2,
              longitude: (tripDraft.origin.longitude + tripDraft.destination.longitude) / 2,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
          >
            <Marker coordinate={tripDraft.origin} title="Start">
              <View style={styles.originMarker}>
                <Text>🟢</Text>
              </View>
            </Marker>
            <Marker coordinate={tripDraft.destination} title="End">
              <View style={styles.destMarker}>
                <Text>🔴</Text>
              </View>
            </Marker>
            {CONFIG.GOOGLE_MAPS_API_KEY && (
              <MapViewDirections
                origin={tripDraft.origin}
                destination={tripDraft.destination}
                apikey={CONFIG.GOOGLE_MAPS_API_KEY}
                strokeWidth={4}
                strokeColor={COLORS.primary}
                onReady={(result) => {
                  setRouteInfo({ distance: result.distance, duration: result.duration });
                  mapRef.current?.fitToCoordinates(
                    [tripDraft.origin!, tripDraft.destination!],
                    { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 } }
                  );
                }}
              />
            )}
          </MapView>
          {routeInfo && (
            <View style={styles.routeInfoBadge}>
              <Text style={styles.routeInfoText}>
                {routeInfo.distance.toFixed(1)} km • {Math.round(routeInfo.duration)} min
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Route Summary */}
      <View style={styles.routeSummary}>
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>🟢</Text>
          <Text style={styles.routeAddress} numberOfLines={1}>{tripDraft.origin?.address}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>🔴</Text>
          <Text style={styles.routeAddress} numberOfLines={1}>{tripDraft.destination?.address}</Text>
        </View>
      </View>

      {/* Vehicle Selection */}
      <Text style={styles.sectionTitle}>Select Vehicle</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleList}>
        {vehicles.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={[styles.vehicleCard, selectedVehicle === vehicle.id && styles.vehicleCardSelected]}
            onPress={() => setSelectedVehicle(vehicle.id)}
          >
            <Text style={styles.vehicleIcon}>🚗</Text>
            <Text style={styles.vehicleName}>{vehicle.make} {vehicle.model}</Text>
            <Text style={styles.vehiclePlate}>{vehicle.registration_number}</Text>
            <Text style={styles.vehicleSeats}>{vehicle.passenger_capacity || 4} seats</Text>
          </TouchableOpacity>
        ))}
        {vehicles.length === 0 && (
          <Text style={styles.noVehicles}>No vehicles registered. Add one in your profile.</Text>
        )}
      </ScrollView>

      {/* Seats */}
      <Text style={styles.sectionTitle}>Available Seats</Text>
      <View style={styles.seatsContainer}>
        {[1, 2, 3, 4, 5, 6].map((num) => (
          <TouchableOpacity
            key={num}
            style={[styles.seatButton, tripDraft.totalSeats === num && styles.seatButtonSelected]}
            onPress={() => setTripDraft({ totalSeats: num })}
          >
            <Text style={[styles.seatButtonText, tripDraft.totalSeats === num && styles.seatButtonTextSelected]}>
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fare */}
      <Text style={styles.sectionTitle}>Fare per Seat ($)</Text>
      <View style={styles.fareContainer}>
        <TouchableOpacity
          style={styles.fareButton}
          onPress={() => setTripDraft({ baseFare: Math.max(0.5, tripDraft.baseFare - 0.5) })}
        >
          <Text style={styles.fareButtonText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.fareInput}
          value={tripDraft.baseFare.toFixed(2)}
          onChangeText={(text) => {
            const value = parseFloat(text) || 0;
            setTripDraft({ baseFare: value });
          }}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={styles.fareButton}
          onPress={() => setTripDraft({ baseFare: tripDraft.baseFare + 0.5 })}
        >
          <Text style={styles.fareButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Trip Type */}
      <Text style={styles.sectionTitle}>Trip Type</Text>
      <View style={styles.tripTypeContainer}>
        <TouchableOpacity
          style={[styles.tripTypeButton, tripDraft.tripType === 'kombi' && styles.tripTypeSelected]}
          onPress={() => setTripDraft({ tripType: 'kombi' })}
        >
          <Text style={styles.tripTypeIcon}>🚐</Text>
          <Text style={[styles.tripTypeText, tripDraft.tripType === 'kombi' && styles.tripTypeTextSelected]}>
            Kombi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tripTypeButton, tripDraft.tripType === 'long_distance' && styles.tripTypeSelected]}
          onPress={() => setTripDraft({ tripType: 'long_distance' })}
        >
          <Text style={styles.tripTypeIcon}>🛣️</Text>
          <Text style={[styles.tripTypeText, tripDraft.tripType === 'long_distance' && styles.tripTypeTextSelected]}>
            Long Distance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Earnings Preview */}
      <View style={styles.earningsPreview}>
        <Text style={styles.earningsTitle}>💰 Potential Earnings</Text>
        <Text style={styles.earningsAmount}>
          ${(tripDraft.baseFare * tripDraft.totalSeats * 0.925).toFixed(2)}
        </Text>
        <Text style={styles.earningsSubtext}>
          If all {tripDraft.totalSeats} seats filled (after 7.5% fee)
        </Text>
      </View>

      {/* Create Button */}
      <Button
        title={isCreating ? 'Creating Trip...' : 'Create Trip'}
        onPress={handleCreateTrip}
        loading={isCreating}
        size="large"
        style={styles.createButton}
      />

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('driver-home')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Trip</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressStep, step !== 'origin' && styles.progressStepComplete]}>
          <Text style={styles.progressStepText}>1</Text>
        </View>
        <View style={[styles.progressLine, step !== 'origin' && styles.progressLineComplete]} />
        <View style={[styles.progressStep, step === 'details' && styles.progressStepComplete]}>
          <Text style={styles.progressStepText}>2</Text>
        </View>
        <View style={[styles.progressLine, step === 'details' && styles.progressLineComplete]} />
        <View style={[styles.progressStep, step === 'details' && styles.progressStepActive]}>
          <Text style={styles.progressStepText}>3</Text>
        </View>
      </View>

      {/* Content */}
      {step === 'details' ? renderDetailsStep() : renderLocationStep()}
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: COLORS.surface,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepComplete: {
    backgroundColor: COLORS.success,
  },
  progressStepActive: {
    backgroundColor: COLORS.primary,
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressLine: {
    width: 40,
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  progressLineComplete: {
    backgroundColor: COLORS.success,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  searchContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  searchResults: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  searchResultIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultMain: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  searchResultSecondary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  selectedLocation: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  selectedAddress: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 4,
  },
  mapPreview: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    flex: 1,
  },
  originMarker: {
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
  },
  destMarker: {
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
  },
  routeInfoBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  routeInfoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  routeSummary: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    fontSize: 14,
    marginRight: 12,
  },
  routeAddress: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 6,
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  vehicleList: {
    marginBottom: 24,
  },
  vehicleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 120,
  },
  vehicleCardSelected: {
    borderColor: COLORS.primary,
  },
  vehicleIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  vehiclePlate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  vehicleSeats: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  noVehicles: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  seatsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 10,
  },
  seatButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  seatButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  seatButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  seatButtonTextSelected: {
    color: '#FFFFFF',
  },
  fareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  fareButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fareButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fareInput: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.text,
  },
  tripTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  tripTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tripTypeSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  tripTypeIcon: {
    fontSize: 20,
  },
  tripTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  tripTypeTextSelected: {
    color: COLORS.primary,
  },
  earningsPreview: {
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  earningsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#047857',
    marginTop: 8,
  },
  earningsSubtext: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 4,
  },
  createButton: {
    marginTop: 8,
  },
  bottomPadding: {
    height: 40,
  },
});

