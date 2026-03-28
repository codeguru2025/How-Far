// Home Screen with Map
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { BottomNav } from '../../components';
import { useAuthStore } from '../../stores';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

// Default to Harare, Zimbabwe
const DEFAULT_LOCATION: LocationCoords = {
  latitude: -17.8292,
  longitude: 31.0522,
};

export function HomeScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    requestLocation();
  }, []);

  async function requestLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        setLocation(DEFAULT_LOCATION);
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);
      setLoading(false);

      // Animate map to user location
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);

    } catch (error) {
      console.log('Location error:', error);
      setLocation(DEFAULT_LOCATION);
      setLoading(false);
    }
  }

  function centerOnUser() {
    if (location) {
      mapRef.current?.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: location?.latitude || DEFAULT_LOCATION.latitude,
              longitude: location?.longitude || DEFAULT_LOCATION.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
          >
            {location && (
              <Marker
                coordinate={location}
                title="You are here"
              >
                <View style={styles.userMarker}>
                  <View style={styles.userMarkerInner} />
                </View>
              </Marker>
            )}
          </MapView>
        )}

        {/* Header Overlay */}
        <View style={styles.headerOverlay}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.first_name || 'there'}! 👋</Text>
              <Text style={styles.greetingSub}>Where are you going?</Text>
            </View>
            <TouchableOpacity style={styles.avatar} onPress={() => onNavigate('profile')}>
              <Text style={styles.avatarText}>{user?.first_name?.[0] || 'U'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Location Button */}
        <TouchableOpacity style={styles.locationButton} onPress={centerOnUser}>
          <Text style={styles.locationButtonIcon}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Search Box */}
        <TouchableOpacity 
          style={styles.searchBox} 
          onPress={() => onNavigate('search' as Screen)}
          activeOpacity={0.8}
        >
          <View style={styles.searchDot} />
          <Text style={styles.searchText}>Where to?</Text>
          <View style={styles.searchNow}>
            <Text style={styles.searchNowText}>Now ▾</Text>
          </View>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickIcon}>🏠</Text>
            <Text style={styles.quickLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickIcon}>💼</Text>
            <Text style={styles.quickLabel}>Work</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => onNavigate('wallet')}>
            <Text style={styles.quickIcon}>💳</Text>
            <Text style={styles.quickLabel}>Wallet</Text>
          </TouchableOpacity>
          {user?.role === 'driver' && (
            <TouchableOpacity style={styles.quickAction} onPress={() => onNavigate('driver' as Screen)}>
              <Text style={styles.quickIcon}>🚗</Text>
              <Text style={styles.quickLabel}>Drive</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Places */}
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent</Text>
          <TouchableOpacity style={styles.recentItem}>
            <View style={styles.recentIcon}>
              <Text>🕐</Text>
            </View>
            <View style={styles.recentInfo}>
              <Text style={styles.recentName}>Sam Levy's Village</Text>
              <Text style={styles.recentAddress}>Borrowdale, Harare</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.recentItem}>
            <View style={styles.recentIcon}>
              <Text>🕐</Text>
            </View>
            <View style={styles.recentInfo}>
              <Text style={styles.recentName}>Eastgate Mall</Text>
              <Text style={styles.recentAddress}>Robert Mugabe Rd, Harare</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <BottomNav current="home" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  greetingSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 90, 36, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  locationButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  locationButtonIcon: {
    fontSize: 22,
  },
  bottomSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
  },
  searchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginRight: 14,
  },
  searchText: {
    flex: 1,
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '500',
  },
  searchNow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  searchNowText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    paddingVertical: 16,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
  recentSection: {
    paddingTop: 8,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  recentAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
