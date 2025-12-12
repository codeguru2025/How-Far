// Mapbox Map Component
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox, { Camera, MapView, PointAnnotation, MarkerView } from '@rnmapbox/maps';
import { COLORS } from '../theme';

// Initialize Mapbox with public token
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
Mapbox.setAccessToken(MAPBOX_TOKEN);

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
  const cameraRef = useRef<Camera>(null);

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

        {showUserLocation && (
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
});

export default MapboxMapView;

