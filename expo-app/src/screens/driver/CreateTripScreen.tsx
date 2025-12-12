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
  ActivityIndicator,
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
import { getCurrentLocation } from '../../utils/location';

// Track if user has manually set origin to prevent race condition with auto-location
let userSetOriginManually = false;

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function CreateTripScreen({ onNavigate }: Props) {
  const mapRef = useRef<MapView>(null);
  const { user } = useAuthStore();
  const { tripDraft, setTripDraft, resetTripDraft } = useTripStore();
  
  const [step, setStep] = useState<'origin' | 'destination' | 'waypoints' | 'details'>('origin');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<Location[]>([]);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(false);

  useEffect(() => {
    loadVehicles();
    resetTripDraft();
    // Reset the manual flag when screen mounts
    userSetOriginManually = false;
    // Auto-capture driver's current location as origin
    captureCurrentLocation();
  }, []);

  // Clear search results when step changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, [step]);

  async function captureCurrentLocation(isManualTrigger = false) {
    setIsGettingLocation(true);
    setLocationError(null);
    try {
      const result = await getCurrentLocation();
      
      // Only set origin if user hasn't manually selected one (unless this is a manual trigger)
      if (userSetOriginManually && !isManualTrigger) {
        console.log('User already set origin manually, ignoring auto-location');
        setIsGettingLocation(false);
        return;
      }
      
      if (result.success && result.location) {
        // Mark as manually set if user triggered this
        if (isManualTrigger) {
          userSetOriginManually = true;
        }
        setTripDraft({ origin: result.location });
        // Auto-advance to destination step since origin is set
        setStep('destination');
        setLocationError(null);
      } else {
        setLocationError(result.error || 'Could not get location. Please search manually.');
      }
    } catch (error) {
      console.error('Location capture error:', error);
      setLocationError('Failed to get current location');
    } finally {
      setIsGettingLocation(false);
    }
  }

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
          const firstVehicle = data[0];
          setSelectedVehicle(firstVehicle.id);
          // Set initial seat count from vehicle's capacity
          const seatCount = firstVehicle.seat_count || firstVehicle.passenger_capacity || 4;
          setTripDraft({ totalSeats: seatCount });
        }
      }
    } catch (error) {
      console.error('Load vehicles error:', error);
    }
  }

  // Update seat count when vehicle selection changes
  function handleVehicleSelect(vehicleId: string) {
    setSelectedVehicle(vehicleId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      const maxSeats = vehicle.seat_count || vehicle.passenger_capacity || 4;
      // If current selection exceeds new vehicle's capacity, adjust down
      const newSeatCount = Math.min(tripDraft.totalSeats, maxSeats);
      // Default to max if nothing selected
      setTripDraft({ totalSeats: newSeatCount > 0 ? newSeatCount : maxSeats });
    }
  }

  async function searchPlaces(query: string) {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${CONFIG.GOOGLE_MAPS_API_KEY}&components=country:zw`;
      console.log('🔍 Searching for:', query);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('🔍 Results count:', data.predictions?.length || 0);
      data.predictions?.forEach((p: any, i: number) => {
        console.log(`  ${i}: ${p.description}`);
      });
      
      setSearchResults(data.predictions || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }

  async function selectPlace(placeId: string, description: string) {
    console.log('selectPlace called with:', { placeId, description, step });
    
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
      console.log('Fetching place details...');
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Place details response:', data.result?.formatted_address);
      
      if (data.result?.geometry?.location) {
        const location: Location = {
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
          address: data.result.formatted_address || description,
          name: description,
        };
        
        console.log('Setting location:', location.address, 'for step:', step);

        // Clear search first to prevent re-triggering
        setSearchQuery('');
        setSearchResults([]);

        if (step === 'origin') {
          // Mark that user manually set the origin (prevents auto-location overwrite)
          userSetOriginManually = true;
          setTripDraft({ origin: location });
          setStep('destination');
        } else if (step === 'destination') {
          setTripDraft({ destination: location });
          setStep('waypoints');
        } else if (step === 'waypoints' && isAddingWaypoint) {
          // Add to waypoints
          const newWaypoints = [...waypoints, location];
          setWaypoints(newWaypoints);
          setTripDraft({ waypoints: newWaypoints.map(w => ({ location: w })) });
          setIsAddingWaypoint(false);
        }
      } else {
        console.error('No geometry in place details:', data);
      }
    } catch (error) {
      console.error('Place details error:', error);
    }
  }

  function removeWaypoint(index: number) {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
    setTripDraft({ waypoints: newWaypoints.map(w => ({ location: w })) });
  }

  function moveWaypoint(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= waypoints.length) return;
    
    const newWaypoints = [...waypoints];
    [newWaypoints[index], newWaypoints[newIndex]] = [newWaypoints[newIndex], newWaypoints[index]];
    setWaypoints(newWaypoints);
    setTripDraft({ waypoints: newWaypoints.map(w => ({ location: w })) });
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

      {/* Auto-location loading state */}
      {isGettingLocation && step === 'origin' && (
        <View style={styles.autoLocationContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.autoLocationText}>Getting your current location...</Text>
        </View>
      )}

      {/* Location error with retry */}
      {locationError && step === 'origin' && !isGettingLocation && (
        <View style={styles.locationErrorContainer}>
          <Text style={styles.locationErrorText}>⚠️ {locationError}</Text>
          <TouchableOpacity onPress={() => captureCurrentLocation(true)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Use current location button */}
      {step === 'origin' && !isGettingLocation && !tripDraft.origin && (
        <TouchableOpacity 
          style={styles.useCurrentLocationButton}
          onPress={() => captureCurrentLocation(true)}
        >
          <Text style={styles.useCurrentLocationIcon}>📍</Text>
          <Text style={styles.useCurrentLocationText}>Use my current location</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={step === 'origin' ? 'Or search for a location...' : 'Enter destination...'}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchPlaces(text);
          }}
          autoFocus={step === 'destination'}
        />
      </View>

      {searchResults.length > 0 && (
        <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
          {searchResults.map((result, index) => {
            const placeId = result.place_id;
            const desc = result.description;
            return (
              <TouchableOpacity
                key={`${placeId}-${index}`}
                style={styles.searchResultItem}
                onPress={() => {
                  console.log('Tapped on:', desc);
                  selectPlace(placeId, desc);
                }}
              >
                <Text style={styles.searchResultIcon}>📍</Text>
                <View style={styles.searchResultText}>
                  <Text style={styles.searchResultMain} numberOfLines={1}>
                    {result.structured_formatting?.main_text || desc}
                  </Text>
                  <Text style={styles.searchResultSecondary} numberOfLines={1}>
                    {result.structured_formatting?.secondary_text || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Show selected origin when on destination step */}
      {tripDraft.origin && step === 'destination' && (
        <TouchableOpacity 
          style={styles.selectedLocation}
          onPress={() => setStep('origin')}
        >
          <View style={styles.selectedLocationHeader}>
            <Text style={styles.selectedLabel}>From:</Text>
            <Text style={styles.changeLocationText}>Change</Text>
          </View>
          <Text style={styles.selectedAddress}>{tripDraft.origin.address}</Text>
          {tripDraft.origin.name && tripDraft.origin.name !== tripDraft.origin.address && (
            <Text style={styles.selectedName}>{tripDraft.origin.name}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderWaypointsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>🛑 Add Stops (Optional)</Text>
      <Text style={styles.stepSubtitle}>
        Add pickup/dropoff points along your route where passengers can join or leave
      </Text>

      {/* Route Overview */}
      <View style={styles.routeOverview}>
        <View style={styles.routeStopItem}>
          <View style={[styles.routeStopDot, styles.routeStopStart]} />
          <Text style={styles.routeStopText} numberOfLines={1}>
            {tripDraft.origin?.address?.split(',')[0]}
          </Text>
        </View>
        
        {waypoints.map((wp, index) => (
          <View key={index}>
            <View style={styles.routeStopLine} />
            <View style={styles.waypointItem}>
              <View style={[styles.routeStopDot, styles.routeStopWaypoint]} />
              <Text style={styles.routeStopText} numberOfLines={1}>
                {wp.address?.split(',')[0] || `Stop ${index + 1}`}
              </Text>
              <View style={styles.waypointActions}>
                {index > 0 && (
                  <TouchableOpacity 
                    style={styles.waypointActionBtn}
                    onPress={() => moveWaypoint(index, 'up')}
                  >
                    <Text style={styles.waypointActionText}>↑</Text>
                  </TouchableOpacity>
                )}
                {index < waypoints.length - 1 && (
                  <TouchableOpacity 
                    style={styles.waypointActionBtn}
                    onPress={() => moveWaypoint(index, 'down')}
                  >
                    <Text style={styles.waypointActionText}>↓</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={[styles.waypointActionBtn, styles.waypointRemoveBtn]}
                  onPress={() => removeWaypoint(index)}
                >
                  <Text style={styles.waypointRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
        
        <View style={styles.routeStopLine} />
        <View style={styles.routeStopItem}>
          <View style={[styles.routeStopDot, styles.routeStopEnd]} />
          <Text style={styles.routeStopText} numberOfLines={1}>
            {tripDraft.destination?.address?.split(',')[0]}
          </Text>
        </View>
      </View>

      {/* Add Waypoint */}
      {isAddingWaypoint ? (
        <View style={styles.addWaypointSearch}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a stop location..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                searchPlaces(text);
              }}
              autoFocus
            />
          </View>
          
          {searchResults.length > 0 && (
            <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
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
          
          <TouchableOpacity 
            style={styles.cancelAddWaypoint}
            onPress={() => {
              setIsAddingWaypoint(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <Text style={styles.cancelAddWaypointText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.addWaypointButton}
          onPress={() => setIsAddingWaypoint(true)}
        >
          <Text style={styles.addWaypointIcon}>➕</Text>
          <Text style={styles.addWaypointText}>Add a Stop</Text>
        </TouchableOpacity>
      )}

      {/* Popular Stops Suggestions */}
      <View style={styles.suggestionsSection}>
        <Text style={styles.suggestionsTitle}>Popular Stops</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['Rank', 'Shopping Mall', 'Hospital', 'Market', 'Bus Station'].map((place) => (
            <TouchableOpacity
              key={place}
              style={styles.suggestionChip}
              onPress={() => {
                setIsAddingWaypoint(true);
                setSearchQuery(place + ' Bulawayo');
                searchPlaces(place + ' Bulawayo');
              }}
            >
              <Text style={styles.suggestionText}>{place}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Continue Button */}
      <View style={styles.waypointFooter}>
        <Button
          title={waypoints.length > 0 ? `Continue with ${waypoints.length} stop(s)` : 'Skip - No Stops'}
          onPress={() => setStep('details')}
          size="large"
        />
        <Text style={styles.waypointHint}>
          You can always add or edit stops later
        </Text>
      </View>
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
            {/* Waypoint Markers */}
            {waypoints.map((wp, index) => (
              <Marker 
                key={`waypoint-${index}`} 
                coordinate={wp} 
                title={`Stop ${index + 1}`}
              >
                <View style={styles.waypointMarker}>
                  <Text style={styles.waypointMarkerText}>{index + 1}</Text>
                </View>
              </Marker>
            ))}
            <Marker coordinate={tripDraft.destination} title="End">
              <View style={styles.destMarker}>
                <Text>🔴</Text>
              </View>
            </Marker>
            {CONFIG.GOOGLE_MAPS_API_KEY && (
              <MapViewDirections
                origin={tripDraft.origin}
                destination={tripDraft.destination}
                waypoints={waypoints.length > 0 ? waypoints : undefined}
                apikey={CONFIG.GOOGLE_MAPS_API_KEY}
                strokeWidth={4}
                strokeColor={COLORS.primary}
                onReady={(result) => {
                  setRouteInfo({ distance: result.distance, duration: result.duration });
                  const allCoords = [tripDraft.origin!, ...waypoints, tripDraft.destination!];
                  mapRef.current?.fitToCoordinates(
                    allCoords,
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
                {waypoints.length > 0 && ` • ${waypoints.length} stop(s)`}
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
        {waypoints.map((wp, index) => (
          <React.Fragment key={`summary-wp-${index}`}>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={styles.waypointNumberBadge}>
                <Text style={styles.waypointNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.routeAddress} numberOfLines={1}>{wp.address}</Text>
            </View>
          </React.Fragment>
        ))}
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>🔴</Text>
          <Text style={styles.routeAddress} numberOfLines={1}>{tripDraft.destination?.address}</Text>
        </View>
        {/* Edit Stops Button */}
        <TouchableOpacity 
          style={styles.editStopsButton}
          onPress={() => setStep('waypoints')}
        >
          <Text style={styles.editStopsText}>✏️ Edit Stops</Text>
        </TouchableOpacity>
      </View>

      {/* Vehicle Selection */}
      <Text style={styles.sectionTitle}>Select Vehicle</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleList}>
        {vehicles.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={[styles.vehicleCard, selectedVehicle === vehicle.id && styles.vehicleCardSelected]}
            onPress={() => handleVehicleSelect(vehicle.id)}
          >
            <Text style={styles.vehicleIcon}>🚗</Text>
            <Text style={styles.vehicleName}>{vehicle.make} {vehicle.model}</Text>
            <Text style={styles.vehiclePlate}>{vehicle.registration_number}</Text>
            <Text style={styles.vehicleSeats}>{vehicle.seat_count || vehicle.passenger_capacity || 4} seats</Text>
          </TouchableOpacity>
        ))}
        {vehicles.length === 0 && (
          <Text style={styles.noVehicles}>No vehicles registered. Add one in your profile.</Text>
        )}
      </ScrollView>

      {/* Seats - Dynamic based on selected vehicle */}
      {(() => {
        const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);
        const maxSeats = selectedVehicleData?.seat_count || selectedVehicleData?.passenger_capacity || 4;
        const seatOptions = Array.from({ length: maxSeats }, (_, i) => i + 1);
        
        return (
          <>
            <Text style={styles.sectionTitle}>
              Available Seats (max {maxSeats} for this vehicle)
            </Text>
            <View style={styles.seatsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seatsScrollContent}>
                {seatOptions.map((num) => (
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
              </ScrollView>
            </View>
          </>
        );
      })()}

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

      {/* Custom Pickup Fee */}
      <Text style={styles.sectionTitle}>Custom Pickup Fee ($)</Text>
      <Text style={styles.sectionHint}>Fee charged when rider requests pickup at their location</Text>
      <View style={styles.fareContainer}>
        <TouchableOpacity
          style={styles.fareButton}
          onPress={() => setTripDraft({ pickupFee: Math.max(0, tripDraft.pickupFee - 0.5) })}
        >
          <Text style={styles.fareButtonText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.fareInput}
          value={tripDraft.pickupFee.toFixed(2)}
          onChangeText={(text) => {
            const value = parseFloat(text) || 0;
            setTripDraft({ pickupFee: value });
          }}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={styles.fareButton}
          onPress={() => setTripDraft({ pickupFee: tripDraft.pickupFee + 0.5 })}
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
        <View style={[styles.progressStep, (step !== 'origin') && styles.progressStepComplete]}>
          <Text style={styles.progressStepText}>1</Text>
        </View>
        <View style={[styles.progressLine, (step !== 'origin') && styles.progressLineComplete]} />
        <View style={[styles.progressStep, (step === 'waypoints' || step === 'details') && styles.progressStepComplete]}>
          <Text style={styles.progressStepText}>2</Text>
        </View>
        <View style={[styles.progressLine, (step === 'waypoints' || step === 'details') && styles.progressLineComplete]} />
        <View style={[styles.progressStep, step === 'details' && styles.progressStepComplete, step === 'waypoints' && styles.progressStepActive]}>
          <Text style={styles.progressStepText}>3</Text>
        </View>
        <View style={[styles.progressLine, step === 'details' && styles.progressLineComplete]} />
        <View style={[styles.progressStep, step === 'details' && styles.progressStepActive]}>
          <Text style={styles.progressStepText}>4</Text>
        </View>
      </View>

      {/* Content */}
      {step === 'details' && renderDetailsStep()}
      {step === 'waypoints' && renderWaypointsStep()}
      {(step === 'origin' || step === 'destination') && renderLocationStep()}
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
  autoLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  autoLocationText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  locationErrorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  locationErrorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  useCurrentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  useCurrentLocationIcon: {
    fontSize: 20,
  },
  useCurrentLocationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedLocation: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  selectedLocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  changeLocationText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  selectedAddress: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 4,
  },
  selectedName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  sectionHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -8,
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
    marginBottom: 24,
  },
  seatsScrollContent: {
    flexDirection: 'row',
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
  // Waypoints styles
  stepSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  routeOverview: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  routeStopItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeStopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 14,
  },
  routeStopStart: {
    backgroundColor: '#10B981',
  },
  routeStopEnd: {
    backgroundColor: '#EF4444',
  },
  routeStopWaypoint: {
    backgroundColor: COLORS.primary,
  },
  routeStopText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  routeStopLine: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 6,
    marginVertical: 4,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waypointActions: {
    flexDirection: 'row',
    gap: 6,
  },
  waypointActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waypointActionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  waypointRemoveBtn: {
    backgroundColor: '#FEE2E2',
  },
  waypointRemoveText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  addWaypointSearch: {
    marginBottom: 20,
  },
  addWaypointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    gap: 10,
  },
  addWaypointIcon: {
    fontSize: 18,
  },
  addWaypointText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelAddWaypoint: {
    alignItems: 'center',
    padding: 12,
  },
  cancelAddWaypointText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  suggestionsSection: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  suggestionText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  waypointFooter: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  waypointHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  waypointMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  waypointMarkerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  waypointNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  waypointNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  editStopsButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editStopsText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
});

