// Tracking Screen - Ride in progress
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapType } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { COLORS } from '../../theme';
import { Screen, RideStatus, Driver, Location } from '../../types';
import { Button } from '../../components';
import { CONFIG } from '../../config';
import { useMapContext, MapStyle } from '../../context/MapContext';
import { useRideStore } from '../../stores';
import { getActiveRide, subscribeToRide, subscribeToDriverLocation, cancelRide, completeRide } from '../../api/rides';

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

export function TrackingScreen({ onNavigate }: Props) {
  const mapRef = useRef<MapView>(null);
  const { style: mapStyle, setStyle: setMapStyle } = useMapContext();
  const { ride, setRide, updateStatus, setDriver: setRideDriver } = useRideStore();
  const [rideStatus, setRideStatus] = useState<RideStatus>('searching');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [eta, setEta] = useState(5);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeDuration, setRouteDuration] = useState<number>(0);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Get locations from ride store
  const pickupLocation = ride?.pickup || { latitude: -17.8292, longitude: 31.0522, name: 'Current Location' };
  const dropoffLocation = ride?.dropoff || { latitude: -17.7689, longitude: 31.0850, name: 'Destination' };
  
  // Driver location (will be updated via real-time in production)
  const [driverLocation, setDriverLocation] = useState({
    latitude: pickupLocation.latitude + 0.008,
    longitude: pickupLocation.longitude + 0.005,
  });

  useEffect(() => {
    let unsubscribeRide: (() => void) | null = null;
    let unsubscribeLocation: (() => void) | null = null;

    async function initializeTracking() {
      // Try to get active ride from backend
      const activeRide = await getActiveRide();
      
      if (activeRide) {
        console.log('Active ride found:', activeRide);
        
        // Update local state with real ride data
        setRideStatus(activeRide.status as RideStatus);
        
        if (activeRide.driver) {
          const realDriver: Driver = {
            id: activeRide.driver.id,
            user_id: activeRide.driver.id,
            first_name: activeRide.driver.first_name,
            last_name: activeRide.driver.last_name,
            phone_number: activeRide.driver.phone_number,
            rating: activeRide.driver.rating,
            total_rides: activeRide.driver.total_rides,
            vehicle: activeRide.vehicle ? {
              id: '',
              type: 'sedan',
              make: activeRide.vehicle.make,
              model: activeRide.vehicle.model,
              color: activeRide.vehicle.color,
              registration_number: activeRide.vehicle.registration_number,
              year: 2020,
            } : undefined,
          };
          setDriver(realDriver);
        }

        // Subscribe to ride updates
        unsubscribeRide = subscribeToRide(activeRide.id, (updatedRide) => {
          console.log('Ride updated:', updatedRide);
          setRideStatus(updatedRide.status as RideStatus);
          if (updatedRide.driver_eta) {
            setEta(updatedRide.driver_eta);
          }
        });

        // Subscribe to driver location updates
        unsubscribeLocation = subscribeToDriverLocation(activeRide.id, (location) => {
          console.log('Driver location:', location);
          setDriverLocation({
            latitude: location.latitude,
            longitude: location.longitude,
          });
          if (location.eta) {
            setEta(location.eta);
          }
        });
      } else {
        // Demo mode - no active ride in backend
        console.log('No active ride - running in demo mode');
        
        // Use ride from store if available
        if (ride?.driver) {
          setDriver(ride.driver);
          setRideStatus('driver_arriving');
        } else {
          // Simulate finding a driver
          const timer1 = setTimeout(() => {
            const demoDriver: Driver = {
              id: `driver-${Date.now()}`,
              user_id: `user-${Date.now()}`,
              first_name: 'Demo',
              last_name: 'Driver',
              phone_number: '+263770000000',
              rating: 4.5,
              total_rides: 100,
              vehicle: {
                id: '',
                type: 'sedan',
                make: 'Toyota',
                model: 'Corolla',
                color: 'Silver',
                registration_number: 'ABC 1234',
                year: 2020,
              },
            };
            setDriver(demoDriver);
            setRideStatus('matched');
          }, 2000);

          const timer2 = setTimeout(() => {
            setRideStatus('driver_arriving');
          }, 4000);

          return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
          };
        }
      }
    }

    initializeTracking();

    return () => {
      if (unsubscribeRide) unsubscribeRide();
      if (unsubscribeLocation) unsubscribeLocation();
    };
  }, []);

  useEffect(() => {
    // Pulse animation for searching
    if (rideStatus === 'searching') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [rideStatus]);

  useEffect(() => {
    // Countdown ETA
    if (rideStatus === 'driver_arriving' && eta > 0) {
      const interval = setInterval(() => {
        setEta(prev => Math.max(0, prev - 1));
      }, 60000); // Every minute
      return () => clearInterval(interval);
    }
  }, [rideStatus, eta]);

  // Simulate driver moving towards pickup
  useEffect(() => {
    if (driver && rideStatus === 'driver_arriving') {
      const interval = setInterval(() => {
        setDriverLocation(prev => ({
          latitude: prev.latitude + (pickupLocation.latitude - prev.latitude) * 0.1,
          longitude: prev.longitude + (pickupLocation.longitude - prev.longitude) * 0.1,
        }));
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [driver, rideStatus]);

  // Fit map to show all markers when route ready
  useEffect(() => {
    if (mapRef.current && driver) {
      const coords = [
        pickupLocation,
        dropoffLocation,
        ...(rideStatus !== 'searching' ? [driverLocation] : []),
      ];
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  }, [driver, rideStatus]);

  async function handleCancel() {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            // Try to cancel via backend
            const activeRide = await getActiveRide();
            if (activeRide) {
              const success = await cancelRide(activeRide.id, 'User cancelled');
              if (!success) {
                console.log('Failed to cancel ride in backend');
              }
            }
            // Clear local ride state
            if (ride) {
              setRide({ ...ride, status: 'cancelled', driver: null });
            }
            onNavigate('home');
          },
        },
      ]
    );
  }

  async function handleCompleteRide() {
    const price = ride?.price || 0;
    
    Alert.alert(
      'Complete Ride',
      `Confirm payment of $${price.toFixed(2)} from your wallet?`,
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Complete & Pay',
          onPress: async () => {
            setIsCompleting(true);
            try {
              const activeRide = await getActiveRide();
              if (activeRide) {
                const result = await completeRide(activeRide.id);
                if (result.success) {
                  Alert.alert(
                    'Ride Completed! 🎉',
                    `Payment of $${price.toFixed(2)} processed.\nThank you for riding with us!`,
                    [{ text: 'OK', onPress: () => onNavigate('home') }]
                  );
                } else {
                  Alert.alert('Payment Failed', result.error || 'Please try again.');
                }
              } else {
                // Demo mode - just complete locally
                Alert.alert(
                  'Ride Completed! 🎉',
                  'Demo mode - no actual payment processed.',
                  [{ text: 'OK', onPress: () => onNavigate('home') }]
                );
              }
            } catch (error) {
              console.error('Complete ride error:', error);
              Alert.alert('Error', 'Failed to complete ride. Please try again.');
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  }

  function handleCall() {
    if (driver?.phone_number) {
      Linking.openURL(`tel:${driver.phone_number}`);
    }
  }

  function handleMessage() {
    if (driver?.phone_number) {
      Linking.openURL(`sms:${driver.phone_number}`);
    }
  }

  function getStatusText() {
    switch (rideStatus) {
      case 'searching':
        return 'Finding your driver...';
      case 'matched':
        return 'Driver assigned!';
      case 'driver_arriving':
        return `Driver arriving in ${eta} min`;
      case 'in_progress':
        return 'On the way to destination';
      default:
        return 'Processing...';
    }
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={styleToMapType[mapStyle]}
        initialRegion={{
          latitude: (pickupLocation.latitude + dropoffLocation.latitude) / 2,
          longitude: (pickupLocation.longitude + dropoffLocation.longitude) / 2,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Pickup Marker */}
        <Marker coordinate={pickupLocation} title="Pickup">
          <View style={styles.pickupMarker}>
            <View style={styles.pickupMarkerInner} />
          </View>
        </Marker>

        {/* Dropoff Marker */}
        <Marker coordinate={dropoffLocation} title="Drop-off">
          <View style={styles.dropoffMarker}>
            <View style={styles.dropoffMarkerInner} />
          </View>
        </Marker>

        {/* Driver Marker (when matched) */}
        {driver && rideStatus !== 'searching' && (
          <Marker
            coordinate={driverLocation}
            title="Driver"
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerIcon}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Route from Driver to Pickup (when driver arriving) */}
        {driver && rideStatus === 'driver_arriving' && CONFIG.GOOGLE_MAPS_API_KEY && (
          <MapViewDirections
            origin={driverLocation}
            destination={pickupLocation}
            apikey={CONFIG.GOOGLE_MAPS_API_KEY}
            strokeWidth={3}
            strokeColor={COLORS.success}
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Route from Pickup to Dropoff */}
        {CONFIG.GOOGLE_MAPS_API_KEY && (
          <MapViewDirections
            origin={pickupLocation}
            destination={dropoffLocation}
            apikey={CONFIG.GOOGLE_MAPS_API_KEY}
            strokeWidth={4}
            strokeColor={COLORS.primary}
            optimizeWaypoints={true}
            onReady={(result) => {
              setRouteDistance(result.distance);
              setRouteDuration(Math.round(result.duration));
            }}
          />
        )}
      </MapView>

      {/* Status Overlay */}
      {rideStatus === 'searching' && (
        <View style={styles.searchingOverlay}>
          <Animated.View style={[styles.searchingPulse, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.searchingDot} />
          </Animated.View>
          <Text style={styles.searchingText}>Finding your driver...</Text>
        </View>
      )}

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, 
            rideStatus === 'searching' && { backgroundColor: COLORS.warning },
            rideStatus !== 'searching' && { backgroundColor: COLORS.success }
          ]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {/* Driver Info (when matched) */}
        {rideStatus !== 'searching' && (
          <View style={styles.driverSection}>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {driver ? driver.first_name?.charAt(0) || '🚗' : '🚗'}
                </Text>
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>
                  {driver ? `${driver.first_name} ${driver.last_name}` : 'Finding driver...'}
                </Text>
                <View style={styles.driverRating}>
                  {driver ? (
                    <>
                      <Text style={styles.ratingText}>⭐ {driver.rating?.toFixed(1) || '5.0'}</Text>
                      <Text style={styles.ridesText}> • {driver.total_rides || 0} rides</Text>
                    </>
                  ) : (
                    <Text style={styles.ridesText}>Matching you with nearby drivers</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Vehicle Info */}
            {driver?.vehicle && (
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehiclePlate}>{driver.vehicle.registration_number}</Text>
                <Text style={styles.vehicleDesc}>
                  {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}
                </Text>
              </View>
            )}

            {/* Demo Notice and Controls */}
            {!driver && (
              <View style={styles.demoNotice}>
                <Text style={styles.demoNoticeText}>
                  🔧 Demo Mode: Driver matching will be live when connected to backend
                </Text>
              </View>
            )}
            
            {/* Demo: Simulate ride progress */}
            {driver && rideStatus === 'driver_arriving' && (
              <TouchableOpacity 
                style={styles.simulateButton}
                onPress={() => setRideStatus('driver_arrived')}
              >
                <Text style={styles.simulateButtonText}>🚗 Simulate: Driver Arrived</Text>
              </TouchableOpacity>
            )}
            {driver && rideStatus === 'driver_arrived' && (
              <TouchableOpacity 
                style={styles.simulateButton}
                onPress={() => setRideStatus('in_progress')}
              >
                <Text style={styles.simulateButtonText}>🚀 Simulate: Start Trip</Text>
              </TouchableOpacity>
            )}

            {/* Contact Buttons */}
            <View style={styles.contactButtons}>
              <TouchableOpacity 
                style={[styles.contactButton, !driver && styles.contactButtonDisabled]}
                onPress={driver ? handleCall : undefined}
              >
                <Text style={styles.contactIcon}>📞</Text>
                <Text style={styles.contactLabel}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.contactButton, !driver && styles.contactButtonDisabled]}
                onPress={driver ? handleMessage : undefined}
              >
                <Text style={styles.contactIcon}>💬</Text>
                <Text style={styles.contactLabel}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactButton}>
                <Text style={styles.contactIcon}>🔗</Text>
                <Text style={styles.contactLabel}>Share Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Route Summary */}
        <View style={styles.routeSummary}>
          <View style={styles.routePoint}>
            <View style={styles.pickupDot} />
            <Text style={styles.routeText} numberOfLines={1}>{pickupLocation.name}</Text>
          </View>
          <View style={styles.routeArrow}>
            <Text>→</Text>
          </View>
          <View style={styles.routePoint}>
            <View style={styles.dropoffSquare} />
            <Text style={styles.routeText} numberOfLines={1}>{dropoffLocation.name}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.sosButton}>
            <Text style={styles.sosText}>🆘 SOS</Text>
          </TouchableOpacity>
          
          {/* Show Complete button when ride is in progress, Cancel otherwise */}
          {rideStatus === 'in_progress' || rideStatus === 'driver_arrived' ? (
            <Button
              title={isCompleting ? 'Processing...' : `Complete & Pay $${(ride?.price || 0).toFixed(2)}`}
              onPress={handleCompleteRide}
              loading={isCompleting}
              style={styles.completeButton}
            />
          ) : (
            <Button
              title="Cancel Ride"
              onPress={handleCancel}
              variant="outline"
              style={styles.cancelButton}
            />
          )}
        </View>
      </View>

      {/* Map Style Toggle */}
      <TouchableOpacity
        style={styles.styleToggle}
        onPress={() => setShowStyleModal(true)}
      >
        <Text style={styles.styleToggleIcon}>🗺️</Text>
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
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  pickupMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dropoffMarker: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: COLORS.text + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropoffMarkerInner: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.text,
  },
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  driverMarkerIcon: {
    fontSize: 24,
  },
  searchingOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  searchingPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  searchingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bottomSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverSection: {
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  driverAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: COLORS.text,
  },
  ridesText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  vehicleInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  vehiclePlate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 1,
  },
  vehicleDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  contactButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 12,
  },
  contactButtonDisabled: {
    opacity: 0.5,
  },
  demoNotice: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  demoNoticeText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  simulateButton: {
    backgroundColor: '#E0E7FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  simulateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  contactIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  contactLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  routeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  dropoffSquare: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.text,
    marginRight: 8,
  },
  routeText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  routeArrow: {
    paddingHorizontal: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  sosButton: {
    backgroundColor: COLORS.error + '15',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  cancelButton: {
    flex: 1,
  },
  completeButton: {
    flex: 1,
    backgroundColor: COLORS.success,
  },
  // Style Toggle
  styleToggle: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  styleToggleIcon: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  styleOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  styleIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  styleText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  styleTextActive: {
    color: COLORS.primary,
  },
  modalClose: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

