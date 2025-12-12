// Find Rides Screen - Rider searches for available trips
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen, Location } from '../../types';
import { Button } from '../../components';
import { CONFIG } from '../../config';
import { useTripStore } from '../../stores';
import { findTrips } from '../../api/trips';
import { getCurrentLocation } from '../../utils/location';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function FindRidesScreen({ onNavigate }: Props) {
  const { 
    searchOrigin, searchDestination, setSearchLocations,
    availableTrips, setAvailableTrips,
    setSelectedTrip,
  } = useTripStore();
  
  const [step, setStep] = useState<'origin' | 'destination' | 'results'>('origin');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Auto-capture rider's location on mount
  useEffect(() => {
    captureCurrentLocation();
  }, []);

  async function captureCurrentLocation() {
    setIsGettingLocation(true);
    setLocationError(null);
    try {
      const result = await getCurrentLocation();
      if (result.success && result.location) {
        setSearchLocations(result.location, searchDestination);
        // Auto-advance to destination step
        setStep('destination');
      } else {
        setLocationError(result.error || 'Could not get location');
      }
    } catch (error) {
      console.error('Location capture error:', error);
      setLocationError('Failed to get current location');
    } finally {
      setIsGettingLocation(false);
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
          setSearchLocations(location, searchDestination);
          setStep('destination');
        } else if (step === 'destination') {
          setSearchLocations(searchOrigin, location);
          await loadTrips(searchOrigin!, location);
          setStep('results');
        }
        
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Place details error:', error);
    }
  }

  async function loadTrips(origin: Location, destination: Location) {
    setIsLoadingTrips(true);
    try {
      const trips = await findTrips(origin, destination);
      setAvailableTrips(trips);
    } catch (error) {
      console.error('Load trips error:', error);
    } finally {
      setIsLoadingTrips(false);
    }
  }

  async function handleRefresh() {
    if (searchOrigin && searchDestination) {
      setRefreshing(true);
      await loadTrips(searchOrigin, searchDestination);
      setRefreshing(false);
    }
  }

  function handleSelectTrip(trip: any) {
    setSelectedTrip(trip);
    onNavigate('trip-details');
  }

  const renderSearchStep = () => (
    <View style={styles.searchContainer}>
      <Text style={styles.stepTitle}>
        {step === 'origin' ? '📍 Where are you now?' : '🎯 Where are you going?'}
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
          <TouchableOpacity onPress={captureCurrentLocation} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Use current location button */}
      {step === 'origin' && !isGettingLocation && !searchOrigin && (
        <TouchableOpacity 
          style={styles.useCurrentLocationButton}
          onPress={captureCurrentLocation}
        >
          <Text style={styles.useCurrentLocationIcon}>📍</Text>
          <Text style={styles.useCurrentLocationText}>Use my current location</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.inputContainer}>
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
        {isSearching && <ActivityIndicator style={styles.searchSpinner} />}
      </View>

      {/* Selected origin when on destination step */}
      {step === 'destination' && searchOrigin && (
        <TouchableOpacity 
          style={styles.selectedLocation}
          onPress={() => setStep('origin')}
        >
          <View style={styles.selectedLocationHeader}>
            <Text style={styles.selectedLabel}>From:</Text>
            <Text style={styles.changeText}>Change</Text>
          </View>
          <Text style={styles.selectedAddress}>{searchOrigin.address}</Text>
          {searchOrigin.name && searchOrigin.name !== searchOrigin.address && (
            <Text style={styles.selectedName}>{searchOrigin.name}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Search Results */}
      <ScrollView style={styles.searchResultsList} keyboardShouldPersistTaps="handled">
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
    </View>
  );

  const renderResults = () => (
    <ScrollView 
      style={styles.resultsContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Route Summary */}
      <View style={styles.routeSummary}>
        <TouchableOpacity 
          style={styles.routePoint}
          onPress={() => setStep('origin')}
        >
          <Text style={styles.routeIcon}>🟢</Text>
          <Text style={styles.routeAddress} numberOfLines={1}>{searchOrigin?.address}</Text>
        </TouchableOpacity>
        <View style={styles.routeLine} />
        <TouchableOpacity 
          style={styles.routePoint}
          onPress={() => setStep('destination')}
        >
          <Text style={styles.routeIcon}>🔴</Text>
          <Text style={styles.routeAddress} numberOfLines={1}>{searchDestination?.address}</Text>
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {isLoadingTrips && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding rides for you...</Text>
        </View>
      )}

      {/* Results */}
      {!isLoadingTrips && availableTrips.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>No rides available</Text>
          <Text style={styles.emptySubtitle}>
            There are no drivers going your way right now. Try again later or expand your search.
          </Text>
          <Button
            title="Refresh"
            onPress={handleRefresh}
            variant="outline"
            style={styles.refreshButton}
          />
        </View>
      )}

      {!isLoadingTrips && availableTrips.length > 0 && (
        <>
          <Text style={styles.resultsTitle}>
            {availableTrips.length} ride{availableTrips.length > 1 ? 's' : ''} available
          </Text>
          
          {availableTrips.map((trip: any) => (
            <TouchableOpacity
              key={trip.trip_id}
              style={styles.tripCard}
              onPress={() => handleSelectTrip(trip)}
            >
              <View style={styles.tripHeader}>
                <View style={styles.driverInfo}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {trip.driver_name?.charAt(0) || '?'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.driverName}>{trip.driver_name}</Text>
                    <View style={styles.ratingContainer}>
                      <Text style={styles.ratingText}>⭐ {trip.driver_rating?.toFixed(1) || '5.0'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceAmount}>${trip.base_fare?.toFixed(2)}</Text>
                  <Text style={styles.priceLabel}>per seat</Text>
                </View>
              </View>

              <View style={styles.tripRoute}>
                <View style={styles.tripRoutePoint}>
                  <Text style={styles.tripRouteIcon}>📍</Text>
                  <Text style={styles.tripRouteText} numberOfLines={1}>{trip.origin_address}</Text>
                </View>
                <Text style={styles.tripRouteArrow}>→</Text>
                <View style={styles.tripRoutePoint}>
                  <Text style={styles.tripRouteIcon}>🎯</Text>
                  <Text style={styles.tripRouteText} numberOfLines={1}>{trip.destination_address}</Text>
                </View>
              </View>

              <View style={styles.tripFooter}>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripInfoText}>
                    🚗 {trip.vehicle_info?.make} {trip.vehicle_info?.model}
                  </Text>
                  <Text style={styles.tripInfoText}>• {trip.vehicle_info?.color}</Text>
                </View>
                <View style={styles.seatsAvailable}>
                  <Text style={styles.seatsText}>{trip.available_seats} seats left</Text>
                </View>
              </View>

              {trip.departure_time && (
                <View style={styles.departureTime}>
                  <Text style={styles.departureText}>
                    🕐 Departing: {new Date(trip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}

              {trip.distance_to_origin_km && (
                <Text style={styles.distanceText}>
                  📍 {trip.distance_to_origin_km.toFixed(1)} km from you
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => step === 'results' ? setStep('destination') : onNavigate('home')} 
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a Ride</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {step === 'results' ? renderResults() : renderSearchStep()}
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
  searchContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  searchSpinner: {
    marginRight: 16,
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
    marginBottom: 20,
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
  changeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  searchResultsList: {
    flex: 1,
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
  resultsContainer: {
    flex: 1,
    padding: 20,
  },
  routeSummary: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
    height: 16,
    backgroundColor: COLORS.border,
    marginLeft: 6,
    marginVertical: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
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
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  refreshButton: {
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  tripCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tripRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  tripRoutePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripRouteIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  tripRouteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  tripRouteArrow: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripInfoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  seatsAvailable: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  seatsText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  departureTime: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  departureText: {
    fontSize: 13,
    color: COLORS.text,
  },
  distanceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  bottomPadding: {
    height: 40,
  },
});


