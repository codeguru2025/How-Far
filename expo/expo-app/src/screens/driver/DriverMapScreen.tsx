// Driver Map Screen - Shows trip route and confirmed riders on map
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapType, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { COLORS } from '../../theme';
import { Screen } from '../../types';
import { Button } from '../../components';
import { supabase } from '../../api/supabase';
import { CONFIG } from '../../config';
import { getDriverActiveTrip } from '../../api/trips';
import { useMapContext, MapStyle } from '../../context/MapContext';
import { optimizePickupRoute, PickupPoint, getOptimizedDirections } from '../../utils/location';

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

interface Booking {
  id: string;
  rider_id: string;
  seats?: number;
  seats_booked?: number;
  fare?: number;
  total_amount?: number;
  base_amount?: number;
  status: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_address?: string;
  rider?: {
    first_name: string;
    last_name: string;
    phone_number: string;
  };
}

interface TripData {
  id: string;
  origin: { latitude: number; longitude: number; address: string };
  destination: { latitude: number; longitude: number; address: string };
  status: string;
  seats_available: number;
  base_fare: number;
  bookings: Booking[];
}

interface OptimizedRouteInfo {
  orderedPickups: PickupPoint[];
  totalDistance: number;
  estimatedTime: number;
  waypointOrder?: number[];
}

export function DriverMapScreen({ onNavigate }: Props) {
  const { style: mapStyle, setStyle: setMapStyle } = useMapContext();
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [trip, setTrip] = useState<TripData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRouteInfo | null>(null);
  const [showOptimizedRoute, setShowOptimizedRoute] = useState(true);

  useEffect(() => {
    loadData();
    startLocationUpdates();
    
    // Subscribe to booking updates
    const subscription = supabase
      .channel('driver-map-bookings')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings' 
      }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Calculate optimized route when trip or driver location changes
  useEffect(() => {
    if (trip && driverLocation) {
      calculateOptimizedRoute();
    }
  }, [trip?.bookings?.length, driverLocation?.latitude]);

  async function calculateOptimizedRoute() {
    if (!trip || !driverLocation) return;

    const confirmedBookings = trip.bookings.filter(b => b.status === 'confirmed');
    
    if (confirmedBookings.length === 0) {
      setOptimizedRoute(null);
      return;
    }

    // Create pickup points from confirmed bookings
    const pickupPoints: PickupPoint[] = confirmedBookings
      .filter(b => b.pickup_latitude && b.pickup_longitude)
      .map(b => ({
        id: b.id,
        latitude: b.pickup_latitude!,
        longitude: b.pickup_longitude!,
        riderName: b.rider?.first_name || 'Rider',
        seats: b.seats_booked || b.seats || 1,
      }));

    if (pickupPoints.length === 0) {
      // Use trip origin for all pickups
      setOptimizedRoute({
        orderedPickups: [],
        totalDistance: 0,
        estimatedTime: 0,
      });
      return;
    }

    // Calculate optimized route locally first
    const localOptimized = optimizePickupRoute(
      driverLocation,
      pickupPoints,
      trip.destination
    );

    setOptimizedRoute(localOptimized);

    // Try to get Google-optimized route for more accuracy
    if (CONFIG.GOOGLE_MAPS_API_KEY && pickupPoints.length > 0) {
      const googleRoute = await getOptimizedDirections(
        driverLocation,
        trip.destination,
        pickupPoints.map(p => ({ latitude: p.latitude, longitude: p.longitude }))
      );

      if (googleRoute.success && googleRoute.waypointOrder) {
        // Reorder pickup points based on Google's optimization
        const reorderedPickups = googleRoute.waypointOrder.map(i => pickupPoints[i]);
        setOptimizedRoute({
          orderedPickups: reorderedPickups,
          totalDistance: googleRoute.distance || localOptimized.totalDistance,
          estimatedTime: googleRoute.duration || localOptimized.estimatedTime,
          waypointOrder: googleRoute.waypointOrder,
        });
      }
    }
  }

  async function loadData() {
    try {
      const activeTrip = await getDriverActiveTrip();
      
      if (activeTrip) {
        const origin = typeof activeTrip.origin === 'string' 
          ? JSON.parse(activeTrip.origin) 
          : activeTrip.origin;
        const destination = typeof activeTrip.destination === 'string' 
          ? JSON.parse(activeTrip.destination) 
          : activeTrip.destination;

        // Fetch confirmed bookings with rider info
        const confirmedBookings = (activeTrip.bookings || [])
          .filter((b: any) => b.status === 'confirmed' || b.status === 'completed');

        // Enrich with rider location (use trip origin if no custom pickup)
        const enrichedBookings = confirmedBookings.map((b: any) => ({
          ...b,
          pickup_latitude: b.pickup_latitude || origin.latitude,
          pickup_longitude: b.pickup_longitude || origin.longitude,
          pickup_address: b.pickup_address || origin.address,
        }));

        setTrip({
          id: activeTrip.id,
          origin,
          destination,
          status: activeTrip.status,
          seats_available: activeTrip.seats_available || 0,
          base_fare: activeTrip.base_fare || 0,
          bookings: enrichedBookings,
        });
      }
    } catch (error) {
      console.error('Load trip data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function startLocationUpdates() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to show your position.');
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({});
      setDriverLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Start watching location
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 50, // Update every 50 meters
          timeInterval: 10000, // Or every 10 seconds
        },
        async (newLocation) => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
          setDriverLocation(newCoords);
          
          // Update location in database
          if (trip?.id && !isUpdatingLocation) {
            setIsUpdatingLocation(true);
            await supabase
              .from('trips')
              .update({
                current_location: {
                  latitude: newCoords.latitude,
                  longitude: newCoords.longitude,
                  heading: newLocation.coords.heading,
                  updated_at: new Date().toISOString(),
                },
              })
              .eq('id', trip.id);
            setIsUpdatingLocation(false);
          }
        }
      );
    } catch (error) {
      console.error('Location error:', error);
    }
  }

  function fitMapToRoute() {
    if (!mapRef.current || !trip) return;
    
    const coords: { latitude: number; longitude: number }[] = [
      { latitude: trip.origin.latitude, longitude: trip.origin.longitude },
      { latitude: trip.destination.latitude, longitude: trip.destination.longitude }
    ];
    if (driverLocation) coords.push(driverLocation);
    
    // Add rider pickup locations
    trip.bookings.forEach(b => {
      if (b.pickup_latitude && b.pickup_longitude) {
        coords.push({ latitude: b.pickup_latitude, longitude: b.pickup_longitude });
      }
    });

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 120, right: 50, bottom: 250, left: 50 },
      animated: true,
    });
  }

  function getMarkerColor(index: number): string {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
    return colors[index % colors.length];
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>No Active Trip</Text>
        <Text style={styles.emptyText}>Create a trip to see it on the map</Text>
        <Button
          title="Create Trip"
          onPress={() => onNavigate('create-trip')}
          style={styles.createButton}
        />
      </View>
    );
  }

  const confirmedRiders = trip.bookings.filter(b => b.status === 'confirmed');
  const totalSeats = confirmedRiders.reduce((sum, b) => sum + (b.seats_booked || b.seats || 1), 0);
  const totalFare = confirmedRiders.reduce((sum, b) => sum + (b.total_amount || b.base_amount || b.fare || 0), 0);

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
        <Text style={styles.headerTitle}>Trip Map</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
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
          latitude: trip.origin.latitude,
          longitude: trip.origin.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onMapReady={fitMapToRoute}
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
        {/* Trip Origin Marker */}
        <Marker
          coordinate={trip.origin}
          title="Start Point"
          description={trip.origin.address}
        >
          <View style={styles.originMarker}>
            <Text style={styles.markerIcon}>🚀</Text>
          </View>
        </Marker>

        {/* Trip Destination Marker */}
        <Marker
          coordinate={trip.destination}
          title="Destination"
          description={trip.destination.address}
        >
          <View style={styles.destMarker}>
            <Text style={styles.markerIcon}>🏁</Text>
          </View>
        </Marker>

        {/* Rider Pickup Markers - Numbered for optimized route */}
        {showOptimizedRoute && optimizedRoute && optimizedRoute.orderedPickups.length > 0 ? (
          // Show numbered markers in optimized order
          optimizedRoute.orderedPickups.map((pickup, index) => {
            const booking = confirmedRiders.find(b => b.id === pickup.id);
            return (
              <Marker
                key={pickup.id}
                coordinate={{
                  latitude: pickup.latitude,
                  longitude: pickup.longitude,
                }}
                title={`Stop ${index + 1}: ${pickup.riderName}`}
                description={`${pickup.seats} seat(s)`}
                onPress={() => booking && setSelectedBooking(booking)}
              >
                <View style={[styles.numberedMarker, { backgroundColor: getMarkerColor(index) }]}>
                  <Text style={styles.numberedMarkerText}>{index + 1}</Text>
                </View>
              </Marker>
            );
          })
        ) : (
          // Show regular markers without optimization
          confirmedRiders.map((booking, index) => (
            booking.pickup_latitude && booking.pickup_longitude && (
              <Marker
                key={booking.id}
                coordinate={{
                  latitude: booking.pickup_latitude,
                  longitude: booking.pickup_longitude,
                }}
                title={`${booking.rider?.first_name || 'Rider'} ${booking.rider?.last_name || ''}`}
                description={`${booking.seats_booked || booking.seats || 1} seat(s) • $${(booking.total_amount || booking.base_amount || booking.fare || 0).toFixed(2)}`}
                onPress={() => setSelectedBooking(booking)}
              >
                <View style={[styles.riderMarker, { backgroundColor: getMarkerColor(index) }]}>
                  <Text style={styles.riderMarkerText}>{booking.seats_booked || booking.seats || 1}</Text>
                </View>
              </Marker>
            )
          ))
        )}

        {/* Optimized pickup route with waypoints */}
        {showOptimizedRoute && driverLocation && CONFIG.GOOGLE_MAPS_API_KEY && 
         optimizedRoute && optimizedRoute.orderedPickups.length > 0 ? (
          <MapViewDirections
            origin={driverLocation}
            destination={trip.destination}
            waypoints={optimizedRoute.orderedPickups.map(p => ({
              latitude: p.latitude,
              longitude: p.longitude,
            }))}
            apikey={CONFIG.GOOGLE_MAPS_API_KEY}
            strokeWidth={5}
            strokeColor="#10B981"
            mode="DRIVING"
            optimizeWaypoints={true}
            onReady={(result) => {
              setRouteInfo({ distance: result.distance, duration: result.duration });
            }}
          />
        ) : (
          /* Regular route from origin to destination */
          CONFIG.GOOGLE_MAPS_API_KEY && (
            <MapViewDirections
              origin={trip.origin}
              destination={trip.destination}
              apikey={CONFIG.GOOGLE_MAPS_API_KEY}
              strokeWidth={4}
              strokeColor={COLORS.primary}
              mode="DRIVING"
              onReady={(result) => {
                setRouteInfo({ distance: result.distance, duration: result.duration });
              }}
            />
          )
        )}

        {/* Individual routes to pickups (when not showing optimized route) */}
        {!showOptimizedRoute && driverLocation && CONFIG.GOOGLE_MAPS_API_KEY && 
         confirmedRiders.map((booking, index) => (
          booking.pickup_latitude && 
          booking.pickup_longitude && 
          (booking.pickup_latitude !== trip.origin.latitude || 
           booking.pickup_longitude !== trip.origin.longitude) && (
            <MapViewDirections
              key={`route-${booking.id}`}
              origin={driverLocation}
              destination={{
                latitude: booking.pickup_latitude,
                longitude: booking.pickup_longitude,
              }}
              apikey={CONFIG.GOOGLE_MAPS_API_KEY}
              strokeWidth={3}
              strokeColor={getMarkerColor(index)}
              lineDashPattern={[5, 5]}
              mode="DRIVING"
            />
          )
        ))}
      </MapView>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{confirmedRiders.length}</Text>
          <Text style={styles.statLabel}>Riders</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalSeats}</Text>
          <Text style={styles.statLabel}>Seats</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {optimizedRoute?.totalDistance 
              ? `${optimizedRoute.totalDistance.toFixed(1)}` 
              : routeInfo ? `${routeInfo.distance.toFixed(1)}` : '--'}
          </Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.fareValue]}>${totalFare.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
      </View>

      {/* Optimized Route Toggle & Info */}
      {confirmedRiders.length > 0 && optimizedRoute && optimizedRoute.orderedPickups.length > 0 && (
        <TouchableOpacity 
          style={styles.routeToggle}
          onPress={() => setShowOptimizedRoute(!showOptimizedRoute)}
        >
          <View style={styles.routeToggleContent}>
            <Text style={styles.routeToggleIcon}>{showOptimizedRoute ? '🛣️' : '📍'}</Text>
            <View style={styles.routeToggleInfo}>
              <Text style={styles.routeToggleTitle}>
                {showOptimizedRoute ? 'Optimized Pickup Route' : 'Show Optimized Route'}
              </Text>
              <Text style={styles.routeToggleSubtitle}>
                {optimizedRoute.orderedPickups.length} pickups • ~{Math.round(optimizedRoute.estimatedTime)} min
              </Text>
            </View>
          </View>
          <View style={[styles.routeToggleSwitch, showOptimizedRoute && styles.routeToggleSwitchActive]}>
            <Text style={styles.routeToggleSwitchText}>{showOptimizedRoute ? 'ON' : 'OFF'}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Riders List */}
      <View style={styles.ridersPanel}>
        <Text style={styles.panelTitle}>
          {confirmedRiders.length > 0 ? 'Confirmed Riders' : 'No Riders Yet'}
        </Text>
        
        {confirmedRiders.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ridersList}>
            {/* Show riders in optimized order if available */}
            {(showOptimizedRoute && optimizedRoute && optimizedRoute.orderedPickups.length > 0
              ? optimizedRoute.orderedPickups.map((pickup, orderIndex) => {
                  const booking = confirmedRiders.find(b => b.id === pickup.id);
                  if (!booking) return null;
                  return { booking, orderIndex };
                }).filter(Boolean) as { booking: Booking; orderIndex: number }[]
              : confirmedRiders.map((booking, index) => ({ booking, orderIndex: index }))
            ).map(({ booking, orderIndex }) => (
              <TouchableOpacity
                key={booking.id}
                style={[
                  styles.riderCard,
                  selectedBooking?.id === booking.id && styles.riderCardSelected,
                  { borderLeftColor: getMarkerColor(orderIndex) }
                ]}
                onPress={() => {
                  setSelectedBooking(booking);
                  if (booking.pickup_latitude && booking.pickup_longitude) {
                    mapRef.current?.animateToRegion({
                      latitude: booking.pickup_latitude,
                      longitude: booking.pickup_longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    });
                  }
                }}
              >
                {showOptimizedRoute && optimizedRoute && optimizedRoute.orderedPickups.length > 0 && (
                  <View style={[styles.pickupOrderBadge, { backgroundColor: getMarkerColor(orderIndex) }]}>
                    <Text style={styles.pickupOrderText}>{orderIndex + 1}</Text>
                  </View>
                )}
                <View style={[styles.riderAvatar, { backgroundColor: getMarkerColor(orderIndex) }]}>
                  <Text style={styles.riderAvatarText}>
                    {(booking.rider?.first_name?.[0] || 'R').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.riderInfo}>
                  <Text style={styles.riderName}>
                    {booking.rider?.first_name || 'Rider'} {booking.rider?.last_name?.[0] || ''}
                  </Text>
                  <Text style={styles.riderDetails}>
                    {booking.seats_booked || booking.seats || 1} seat(s) • ${(booking.total_amount || booking.base_amount || booking.fare || 0).toFixed(2)}
                  </Text>
                  {booking.pickup_address && (
                    <Text style={styles.riderPickupAddress} numberOfLines={1}>
                      📍 {booking.pickup_address}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noRidersContainer}>
            <Text style={styles.noRidersText}>
              Waiting for riders to book your trip...
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="📷 Scan QR"
            onPress={() => onNavigate('scan-qr')}
            style={styles.actionButton}
          />
          <Button
            title="📋 Dashboard"
            onPress={() => onNavigate('trip-dashboard')}
            variant="outline"
            style={styles.actionButton}
          />
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
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.background,
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
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  createButton: {
    minWidth: 200,
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
    top: 10,
    right: 10,
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
  originMarker: {
    backgroundColor: '#D1FAE5',
    padding: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  destMarker: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerIcon: {
    fontSize: 20,
  },
  riderMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  riderMarkerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  numberedMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  numberedMarkerText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  routeToggle: {
    position: 'absolute',
    top: 200,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeToggleIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  routeToggleInfo: {
    flex: 1,
  },
  routeToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  routeToggleSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  routeToggleSwitch: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  routeToggleSwitchActive: {
    backgroundColor: '#10B981',
  },
  routeToggleSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsBar: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  fareValue: {
    color: '#10B981',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  ridersPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  ridersList: {
    marginBottom: 16,
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderLeftWidth: 4,
    minWidth: 160,
  },
  riderCardSelected: {
    backgroundColor: COLORS.primary + '10',
  },
  riderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  riderDetails: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  riderPickupAddress: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  pickupOrderBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 1,
  },
  pickupOrderText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  noRidersContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noRidersText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});

