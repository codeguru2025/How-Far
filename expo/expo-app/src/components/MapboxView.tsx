// Mapbox Map Component
// NOTE: This component requires a development/production build - it won't work in Expo Go
import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { COLORS } from '../theme';

// Lazy load Mapbox to prevent crashes in Expo Go
let Mapbox: any = null;
let Camera: any = null;
let MapView: any = null;
let MarkerView: any = null;
let isMapboxAvailable = false;

try {
  const mapboxModule = require('@rnmapbox/maps');
  Mapbox = mapboxModule.default;
  Camera = mapboxModule.Camera;
  MapView = mapboxModule.MapView;
  MarkerView = mapboxModule.MarkerView;
  
  // Initialize Mapbox with public token
  const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
  if (MAPBOX_TOKEN && Mapbox?.setAccessToken) {
    Mapbox.setAccessToken(MAPBOX_TOKEN);
    isMapboxAvailable = true;
  }
} catch (error) {
  // Mapbox native code not available (Expo Go)
  console.log('Mapbox native code not available - using fallback');
  isMapboxAvailable = false;
}

interface Location {
  latitude: number;
  longitude: number;
}

interface MapboxViewProps {
  initialLocation?: Location;
  markers?: Array<{
    id: string;
    coordinate: Location;
    title?: string;
    color?: string;
  }>;
  showUserLocation?: boolean;
  onPress?: (coordinate: Location) => void;
  onMarkerPress?: (markerId: string) => void;
  style?: object;
  zoomLevel?: number;
}

export function MapboxMapView({
  initialLocation = { latitude: -17.8292, longitude: 31.0522 }, // Harare default
  markers = [],
  showUserLocation = true,
  onPress,
  onMarkerPress,
  style,
  zoomLevel = 12,
}: MapboxViewProps) {
  const cameraRef = useRef<any>(null);

  // Show fallback if Mapbox is not available (Expo Go)
  if (!isMapboxAvailable || !MapView) {
    return (
      <View style={[styles.container, styles.fallback, style]}>
        <Text style={styles.fallbackText}>📍</Text>
        <Text style={styles.fallbackTitle}>Map Preview</Text>
        <Text style={styles.fallbackSubtitle}>
          Mapbox requires a development build
        </Text>
        <Text style={styles.fallbackHint}>
          Use Google Maps or build with EAS
        </Text>
      </View>
    );
  }

  const handlePress = (event: any) => {
    if (onPress && event.geometry?.coordinates) {
      onPress({
        longitude: event.geometry.coordinates[0],
        latitude: event.geometry.coordinates[1],
      });
    }
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onPress={handlePress}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={zoomLevel}
          centerCoordinate={[initialLocation.longitude, initialLocation.latitude]}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {showUserLocation && Mapbox?.UserLocation && (
          <Mapbox.UserLocation visible={true} />
        )}

        {markers.map((marker) => (
          <MarkerView
            key={marker.id}
            id={marker.id}
            coordinate={[marker.coordinate.longitude, marker.coordinate.latitude]}
          >
            <View style={[styles.marker, { backgroundColor: marker.color || COLORS.primary }]}>
              <View style={styles.markerInner} />
            </View>
          </MarkerView>
        ))}
      </MapView>
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
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  // Fallback styles for Expo Go
  fallback: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fallbackText: {
    fontSize: 48,
    marginBottom: 12,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  fallbackSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  fallbackHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
});

export default MapboxMapView;

