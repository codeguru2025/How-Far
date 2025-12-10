// Rider Map Screen - Shows driver location and route for pickup
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapType } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { Button } from '../../components';
import { useTripStore } from '../../stores';
import { supabase } from '../../api/supabase';
import { CONFIG } from '../../config';
import { useMapContext, MapStyle } from '../../context/MapContext';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

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

export function RiderMapScreen({ onNavigate }: Props) {
  const { activeBooking } = useTripStore();
  const { style: mapStyle, setStyle: setMapStyle } = useMapContext();
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [tripOrigin, setTripOrigin] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [tripDestination, setTripDestination] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(fetchDriverLocation, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      // Get rider's location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setRiderLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }

      // Get trip details
      if (activeBooking?.trip_id) {
        const { data: trip } = await supabase
          .from('trips')
          .select('origin, destination, driver_id')
          .eq('id', activeBooking.trip_id)
          .single();

        if (trip) {
          const origin = typeof trip.origin === 'string' ? JSON.parse(trip.origin) : trip.origin;
          const dest = typeof trip.destination === 'string' ? JSON.parse(trip.destination) : trip.destination;
          
          setTripOrigin({
            latitude: origin.latitude,
            longitude: origin.longitude,
            address: origin.address || 'Pickup Point',
          });
          
          setTripDestination({
            latitude: dest.latitude,
            longitude: dest.longitude,
            address: dest.address || 'Destination',
          });

          // Get initial driver location
          await fetchDriverLocation();
        }
      }
    } catch (error) {
      console.error('Load map data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchDriverLocation() {
    if (!activeBooking?.trip_id) return;

    try {
      // Get trip with current_location
      const { data: trip } = await supabase
        .from('trips')
        .select('current_location, driver_id')
        .eq('id', activeBooking.trip_id)
        .single();

      if (trip?.current_location) {
        const loc = typeof trip.current_location === 'string' 
          ? JSON.parse(trip.current_location) 
          : trip.current_location;
        
        if (loc.latitude && loc.longitude) {
          setDriverLocation({
            latitude: loc.latitude,
            longitude: loc.longitude,
            heading: loc.heading,
          });
        }
      } else if (trip?.driver_id) {
        // Fallback to driver's last known location
        const { data: driver } = await supabase
          .from('drivers')
          .select('current_latitude, current_longitude')
          .eq('id', trip.driver_id)
          .single();

        if (driver?.current_latitude && driver?.current_longitude) {
          setDriverLocation({
            latitude: driver.current_latitude,
            longitude: driver.current_longitude,
          });
        }
      }
    } catch (error) {
      console.error('Fetch driver location error:', error);
    }
  }

  function fitMapToMarkers() {
    if (!mapRef.current) return;
    
    const coords = [];
    if (riderLocation) coords.push(riderLocation);
    if (driverLocation) coords.push(driverLocation);
    if (tripOrigin) coords.push(tripOrigin);
    
    if (coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    }
  }

  function openNavigation() {
    if (!tripOrigin) return;
    
    const url = Platform.select({
      ios: `maps:0,0?q=${tripOrigin.latitude},${tripOrigin.longitude}`,
      android: `geo:0,0?q=${tripOrigin.latitude},${tripOrigin.longitude}(Pickup Point)`,
    });
    
    if (url) Linking.openURL(url);
  }

  function callDriver() {
    // TODO: Get driver phone from booking
    Alert.alert('Call Driver', 'This feature will be available soon.');
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  const initialRegion = riderLocation || tripOrigin || {
    latitude: -17.8250,
    longitude: 31.0500,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => onNavigate('show-qr')}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meet Your Driver</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchDriverLocation}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={getMapType(mapStyle)}
        initialRegion={{
          ...initialRegion,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        onMapReady={fitMapToMarkers}
        showsUserLocation
        showsMyLocationButton={false}
      >
      
      {/* Map Style Selector */}
      <View style={styles.styleSelector}>
        <TouchableOpacity 
          style={styles.styleSelectorButton}
          onPress={() => setShowStylePicker(!showStylePicker)}
        >
          <Text style={styles.styleSelectorIcon}>🗺️</Text>
        </TouchableOpacity>
        
        {showStylePicker && (
          <View style={styles.styleOptions}>
            {MAP_STYLES.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.styleOption, mapStyle === s.key && styles.styleOptionActive]}
                onPress={() => {
                  setMapStyle(s.key);
                  setShowStylePicker(false);
                }}
              >
                <Text style={styles.styleOptionIcon}>{s.icon}</Text>
                <Text style={[styles.styleOptionText, mapStyle === s.key && styles.styleOptionTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
        {/* Driver Marker */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Driver"
            description="Your driver's current location"
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerIcon}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Trip Origin (Pickup Point) */}
        {tripOrigin && (
          <Marker
            coordinate={tripOrigin}
            title="Pickup Point"
            description={tripOrigin.address}
            pinColor="green"
          >
            <View style={styles.originMarker}>
              <Text style={styles.originMarkerIcon}>📍</Text>
            </View>
          </Marker>
        )}

        {/* Trip Destination */}
        {tripDestination && (
          <Marker
            coordinate={tripDestination}
            title="Destination"
            description={tripDestination.address}
            pinColor="red"
          >
            <View style={styles.destMarker}>
              <Text style={styles.destMarkerIcon}>🎯</Text>
            </View>
          </Marker>
        )}

        {/* Route from rider to pickup */}
        {riderLocation && tripOrigin && CONFIG.GOOGLE_MAPS_API_KEY && (
          <MapViewDirections
            origin={riderLocation}
            destination={tripOrigin}
            apikey={CONFIG.GOOGLE_MAPS_API_KEY}
            strokeWidth={4}
            strokeColor={COLORS.primary}
            mode="WALKING"
            onReady={(result) => {
              setDistance(result.distance);
              setEta(Math.round(result.duration));
            }}
          />
        )}

        {/* Route from pickup to destination */}
        {tripOrigin && tripDestination && CONFIG.GOOGLE_MAPS_API_KEY && (
          <MapViewDirections
            origin={tripOrigin}
            destination={tripDestination}
            apikey={CONFIG.GOOGLE_MAPS_API_KEY}
            strokeWidth={3}
            strokeColor="#10B981"
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Route from driver to pickup */}
        {driverLocation && tripOrigin && CONFIG.GOOGLE_MAPS_API_KEY && (
          <MapViewDirections
            origin={driverLocation}
            destination={tripOrigin}
            apikey={CONFIG.GOOGLE_MAPS_API_KEY}
            strokeWidth={3}
            strokeColor="#F59E0B"
          />
        )}
      </MapView>

      {/* Info Card */}
      <View style={styles.infoCard}>
        {/* ETA Info */}
        <View style={styles.etaContainer}>
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Walk to Pickup</Text>
            <Text style={styles.etaValue}>
              {eta ? `${eta} min` : '--'}
            </Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Distance</Text>
            <Text style={styles.etaValue}>
              {distance ? `${distance.toFixed(1)} km` : '--'}
            </Text>
          </View>
        </View>

        {/* Pickup Address */}
        <View style={styles.addressContainer}>
          <Text style={styles.addressIcon}>📍</Text>
          <View style={styles.addressText}>
            <Text style={styles.addressLabel}>Pickup Point</Text>
            <Text style={styles.addressValue} numberOfLines={2}>
              {tripOrigin?.address || 'Loading...'}
            </Text>
          </View>
        </View>

        {/* Driver Status */}
        <View style={styles.driverStatus}>
          <View style={[styles.statusDot, driverLocation ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusText}>
            {driverLocation ? 'Driver is on the way' : 'Waiting for driver location...'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={openNavigation}>
            <Text style={styles.actionIcon}>🗺️</Text>
            <Text style={styles.actionText}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={callDriver}>
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onNavigate('show-qr')}>
            <Text style={styles.actionIcon}>📱</Text>
            <Text style={styles.actionText}>Show QR</Text>
          </TouchableOpacity>
        </View>

        {/* Back to Home */}
        <Button
          title="Back to Home"
          onPress={() => onNavigate('commuter-home')}
          variant="outline"
          style={styles.homeButton}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: {
    fontSize: 18,
  },
  map: {
    flex: 1,
  },
  styleSelector: {
    position: 'absolute',
    top: 120,
    right: 16,
    zIndex: 10,
  },
  styleSelectorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  styleSelectorIcon: {
    fontSize: 20,
  },
  styleOptions: {
    position: 'absolute',
    top: 50,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 120,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  styleOptionActive: {
    backgroundColor: COLORS.primary + '15',
  },
  styleOptionIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  styleOptionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  styleOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  driverMarker: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  driverMarkerIcon: {
    fontSize: 24,
  },
  originMarker: {
    backgroundColor: '#D1FAE5',
    padding: 8,
    borderRadius: 20,
  },
  originMarkerIcon: {
    fontSize: 20,
  },
  destMarker: {
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 20,
  },
  destMarkerIcon: {
    fontSize: 20,
  },
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  etaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  etaItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  etaValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  etaDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  addressContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  addressIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  addressText: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  addressValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 2,
  },
  driverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#10B981',
  },
  statusOffline: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  homeButton: {
    marginTop: 8,
  },
});

