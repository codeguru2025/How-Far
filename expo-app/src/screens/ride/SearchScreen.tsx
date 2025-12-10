// Search Screen - Real Google Places API Integration
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region, MapType } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { COLORS } from '../../theme';
import { Screen, Location as LocationType } from '../../types';
import { CONFIG } from '../../config';
import { useMapContext, MapStyle } from '../../context/MapContext';
import { useRideStore } from '../../stores';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Map style to MapType mapping
const styleToMapType: Record<MapStyle, MapType> = {
  standard: 'standard',
  satellite: 'satellite',
  hybrid: 'hybrid',
  terrain: 'terrain',
};

export function SearchScreen({ onNavigate }: Props) {
  const mapRef = useRef<MapView>(null);
  const { style: mapStyle, setStyle: setMapStyle } = useMapContext();
  const { setRide } = useRideStore();
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationType | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<PlaceResult | null>(null);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [hasSelectedPlace, setHasSelectedPlace] = useState(false); // Prevent search after selection
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: -17.8292,
    longitude: 31.0522,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentLocation();
    validateApiKey();
  }, []);

  // Search when text changes (but not after selecting a place)
  useEffect(() => {
    if (hasSelectedPlace) {
      return; // Don't search if user just selected a place
    }
    
    const timer = setTimeout(() => {
      if (searchText.length >= 2) {
        performSearch(searchText);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText, hasSelectedPlace]);

  function validateApiKey() {
    const key = CONFIG.GOOGLE_MAPS_API_KEY;
    if (!key || key.length < 30 || !key.startsWith('AIza')) {
      setApiError('Invalid Google Maps API key. Key should start with "AIza..."');
      console.warn('⚠️ Google Maps API key appears invalid. Get one from: https://console.cloud.google.com/apis/credentials');
    }
  }

  async function getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Reverse geocode to get address
      let locationName = 'Current Location';
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (address) {
          locationName = [address.street, address.district, address.city]
            .filter(Boolean)
            .join(', ') || 'Current Location';
        }
      } catch (e) {
        console.log('Reverse geocode error:', e);
      }

      const coords: LocationType = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        name: locationName,
      };

      setCurrentLocation(coords);
      setMapRegion({
        ...coords,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });

      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    } catch (error) {
      console.log('Location error:', error);
      Alert.alert('Location Error', 'Could not get your current location.');
    }
  }

  async function performSearch(query: string) {
    if (!CONFIG.GOOGLE_MAPS_API_KEY || apiError) {
      setApiError('Google Places API key is required for search.');
      return;
    }

    setIsSearching(true);
    setApiError(null);

    try {
      // Use Google Places Autocomplete API
      const location = currentLocation 
        ? `${currentLocation.latitude},${currentLocation.longitude}`
        : '-17.8292,31.0522'; // Default to Harare if no location

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&location=${location}&radius=50000&key=${CONFIG.GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'REQUEST_DENIED') {
        setApiError('API key invalid or Places API not enabled. Enable it at: console.cloud.google.com');
        setIsSearching(false);
        return;
      }

      if (data.status === 'OK' && data.predictions?.length > 0) {
        // Get place details for each prediction
        const results: PlaceResult[] = await Promise.all(
          data.predictions.slice(0, 6).map(async (prediction: any) => {
            try {
              const detailsResponse = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,formatted_address,name&key=${CONFIG.GOOGLE_MAPS_API_KEY}`
              );
              const details = await detailsResponse.json();

              if (details.status === 'OK' && details.result?.geometry?.location) {
                return {
                  id: prediction.place_id,
                  name: details.result.name || prediction.structured_formatting?.main_text || prediction.description,
                  address: details.result.formatted_address || prediction.structured_formatting?.secondary_text || '',
                  latitude: details.result.geometry.location.lat,
                  longitude: details.result.geometry.location.lng,
                };
              }
            } catch (e) {
              console.log('Place details error:', e);
            }
            return null;
          })
        );

        setSearchResults(results.filter((r): r is PlaceResult => r !== null));
      } else if (data.status === 'ZERO_RESULTS') {
        setSearchResults([]);
      } else {
        console.log('Places API response:', data.status);
      }
    } catch (error) {
      console.log('Search error:', error);
      setApiError('Network error. Check your connection.');
    }

    setIsSearching(false);
  }

  function selectDestination(place: PlaceResult) {
    setHasSelectedPlace(true); // Prevent new search
    setSelectedDestination(place);
    setSearchResults([]);
    setSearchText(place.name);

    // Animate map to show both pickup and destination
    if (currentLocation) {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
          { latitude: place.latitude, longitude: place.longitude },
        ],
        {
          edgePadding: { top: 150, right: 50, bottom: 250, left: 50 },
          animated: true,
        }
      );
    } else {
      mapRef.current?.animateToRegion({
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }

  function confirmDestination() {
    if (!selectedDestination) {
      Alert.alert('Error', 'Please select a destination first.');
      return;
    }
    
    if (!currentLocation) {
      Alert.alert('Location Required', 'Getting your location... Please wait and try again.');
      getCurrentLocation();
      return;
    }
    
    // Store ride details in global state
    setRide({
      pickup: currentLocation,
      dropoff: {
        latitude: selectedDestination.latitude,
        longitude: selectedDestination.longitude,
        name: selectedDestination.name,
      },
      vehicleType: 'sedan',
      price: 0,
      distance: 0,
      duration: 0,
      status: 'pending',
      driver: null,
    });
    
    console.log('Ride details stored:', {
      pickup: currentLocation,
      dropoff: selectedDestination,
    });
    onNavigate('confirm-ride');
  }

  function clearSearch() {
    setSearchText('');
    setSearchResults([]);
    setSelectedDestination(null);
    setHasSelectedPlace(false); // Allow searching again
    setApiError(null);
  }

  function dismissKeyboard() {
    Keyboard.dismiss();
  }

  return (
    <View style={styles.container}>
      {/* Map Background - tap to dismiss keyboard */}
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={mapRegion}
            mapType={styleToMapType[mapStyle]}
            showsUserLocation
            showsMyLocationButton={false}
            onPress={dismissKeyboard}
          >
        {currentLocation && (
          <Marker coordinate={currentLocation} title="Pickup">
            <View style={styles.pickupMarker}>
              <View style={styles.pickupMarkerInner} />
            </View>
          </Marker>
        )}

        {selectedDestination && (
          <Marker
            coordinate={{
              latitude: selectedDestination.latitude,
              longitude: selectedDestination.longitude,
            }}
            title={selectedDestination.name}
          >
            <View style={styles.destMarker}>
              <Text style={styles.destMarkerText}>📍</Text>
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {currentLocation && selectedDestination && CONFIG.GOOGLE_MAPS_API_KEY && !apiError && (
          <MapViewDirections
            origin={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            destination={{
              latitude: selectedDestination.latitude,
              longitude: selectedDestination.longitude,
            }}
            apikey={CONFIG.GOOGLE_MAPS_API_KEY}
            strokeWidth={4}
            strokeColor={COLORS.primary}
            optimizeWaypoints={true}
            onReady={(result) => {
              console.log(`Route: ${result.distance} km, ${result.duration} min`);
            }}
            onError={(errorMessage) => {
              console.log('Directions error:', errorMessage);
            }}
          />
        )}
          </MapView>
        </View>
      </TouchableWithoutFeedback>

      {/* Search Panel */}
      <View style={styles.searchPanel}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Where to?</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Inputs */}
        <View style={styles.searchInputs}>
          {/* Pickup */}
          <View style={styles.inputRow}>
            <View style={styles.dotGreen} />
            <View style={styles.inputBox}>
              <Text style={styles.inputText} numberOfLines={1}>
                📍 {currentLocation?.name || 'Getting location...'}
              </Text>
            </View>
          </View>

          {/* Destination */}
          <View style={styles.inputRow}>
            <View style={styles.dotRed} />
            <View style={styles.inputBoxActive}>
              <TextInput
                style={styles.textInput}
                placeholder="Search destination..."
                placeholderTextColor={COLORS.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
                  <Text style={styles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* API Error Message */}
        {apiError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {apiError}</Text>
          </View>
        )}

        {/* Search Results */}
        {(searchResults.length > 0 || isSearching) && (
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {isSearching ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : (
              searchResults.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.resultItem}
                  onPress={() => selectDestination(place)}
                >
                  <View style={styles.resultIcon}>
                    <Text>📍</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{place.name}</Text>
                    <Text style={styles.resultAddress} numberOfLines={1}>{place.address}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {/* No Results - only show when actively searching, not after selecting */}
        {searchText.length >= 2 && !isSearching && searchResults.length === 0 && !apiError && !hasSelectedPlace && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No places found for "{searchText}"</Text>
          </View>
        )}
      </View>

      {/* Confirm Button */}
      {selectedDestination && (
        <View style={styles.confirmPanel}>
          <View style={styles.destPreview}>
            <Text style={styles.destLabel}>DESTINATION</Text>
            <Text style={styles.destName}>{selectedDestination.name}</Text>
            <Text style={styles.destAddress} numberOfLines={1}>{selectedDestination.address}</Text>
          </View>
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmDestination}>
            <Text style={styles.confirmBtnText}>Confirm Destination →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* My Location Button */}
      <TouchableOpacity
        style={[styles.locationBtn, selectedDestination && { bottom: 200 }]}
        onPress={getCurrentLocation}
      >
        <Text>📍</Text>
      </TouchableOpacity>

      {/* Map Style Toggle Button */}
      <TouchableOpacity
        style={[styles.styleBtn, selectedDestination && { bottom: 200 }]}
        onPress={() => setShowStyleModal(true)}
      >
        <Text>🗺️</Text>
      </TouchableOpacity>

      {/* Map Style Modal */}
      <Modal
        visible={showStyleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStyleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Map View</Text>
            <View style={styles.styleGrid}>
              {(['standard', 'satellite', 'hybrid', 'terrain'] as MapStyle[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.styleOption, mapStyle === s && styles.styleOptionActive]}
                  onPress={() => {
                    setMapStyle(s);
                    setShowStyleModal(false);
                  }}
                >
                  <Text style={styles.styleIcon}>
                    {s === 'standard' ? '🛣️' : s === 'satellite' ? '🛰️' : s === 'hybrid' ? '🌐' : '⛰️'}
                  </Text>
                  <Text style={[styles.styleText, mapStyle === s && styles.styleTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowStyleModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { ...StyleSheet.absoluteFillObject },
  map: { flex: 1 },
  pickupMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.success + '30',
    justifyContent: 'center', alignItems: 'center',
  },
  pickupMarkerInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2, borderColor: '#FFF',
  },
  destMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  destMarkerText: { fontSize: 20 },

  searchPanel: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 10,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 22, color: COLORS.text },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  placeholder: { width: 40 },

  searchInputs: { paddingHorizontal: 16, paddingBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success, marginRight: 12 },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, marginRight: 12 },
  inputBox: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  inputText: { fontSize: 15, color: COLORS.text },
  inputBoxActive: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 14, borderWidth: 2, borderColor: COLORS.primary,
  },
  textInput: { flex: 1, fontSize: 16, color: COLORS.text, paddingVertical: 12 },
  clearBtn: { padding: 4 },
  clearText: { fontSize: 16, color: COLORS.textMuted },

  errorBox: { 
    marginHorizontal: 16, marginBottom: 12, padding: 12, 
    backgroundColor: '#FEE2E2', borderRadius: 10 
  },
  errorText: { fontSize: 13, color: '#DC2626' },

  results: { maxHeight: 300, borderTopWidth: 1, borderTopColor: COLORS.border },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  loadingText: { marginLeft: 10, color: COLORS.textSecondary },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  resultIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  resultAddress: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  noResults: { padding: 20, alignItems: 'center' },
  noResultsText: { color: COLORS.textSecondary, fontSize: 14 },

  confirmPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  destPreview: { marginBottom: 16 },
  destLabel: { fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1 },
  destName: { fontSize: 20, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  destAddress: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  confirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnText: { color: '#FFF', fontSize: 17, fontWeight: '600' },

  locationBtn: {
    position: 'absolute', right: 16, bottom: 100,
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  styleBtn: {
    position: 'absolute', right: 70, bottom: 100,
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 20,
  },
  styleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  styleOption: {
    width: '48%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  styleOptionActive: {
    borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10',
  },
  styleIcon: {
    fontSize: 24, marginRight: 12,
  },
  styleText: {
    fontSize: 15, fontWeight: '500', color: COLORS.text,
  },
  styleTextActive: {
    color: COLORS.primary,
  },
  modalClose: {
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  modalCloseText: {
    color: '#FFF', fontSize: 16, fontWeight: '600',
  },
});
