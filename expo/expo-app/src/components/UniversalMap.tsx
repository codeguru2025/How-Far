// Universal Map Component - Google Maps with style switching
// Note: Mapbox requires a development build and won't work in Expo Go
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Modal,
} from 'react-native';
import GoogleMapView, {
  Marker,
  PROVIDER_GOOGLE,
  Region,
  MapType,
  EdgePadding,
} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { useMapContext, MapStyle } from '../context/MapContext';
import { CONFIG } from '../config';
import { COLORS } from '../theme';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface MarkerData {
  id: string;
  coordinate: Coordinate;
  title?: string;
  type: 'pickup' | 'dropoff' | 'driver' | 'custom';
  icon?: string;
}

interface RouteData {
  origin: Coordinate;
  destination: Coordinate;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

interface UniversalMapProps {
  initialRegion: Region;
  markers?: MarkerData[];
  routes?: RouteData[];
  showsUserLocation?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  showStyleToggle?: boolean;
  onRouteReady?: (distance: number, duration: number) => void;
  style?: any;
}

export interface UniversalMapRef {
  fitToCoordinates: (coords: Coordinate[], padding?: EdgePadding) => void;
  animateToRegion: (region: Region, duration?: number) => void;
}

// Map style to Google MapType
const styleToMapType: Record<MapStyle, MapType> = {
  standard: 'standard',
  satellite: 'satellite',
  hybrid: 'hybrid',
  terrain: 'terrain',
};

export const UniversalMap = forwardRef<UniversalMapRef, UniversalMapProps>(
  (
    {
      initialRegion,
      markers = [],
      routes = [],
      showsUserLocation = true,
      scrollEnabled = true,
      zoomEnabled = true,
      rotateEnabled = true,
      pitchEnabled = true,
      showStyleToggle = true,
      onRouteReady,
      style,
    },
    ref
  ) => {
    const { style: mapStyle, setStyle } = useMapContext();
    const googleMapRef = useRef<GoogleMapView>(null);
    const [showStyleModal, setShowStyleModal] = useState(false);

    useImperativeHandle(ref, () => ({
      fitToCoordinates: (coords: Coordinate[], padding: EdgePadding = { top: 50, right: 50, bottom: 50, left: 50 }) => {
        if (googleMapRef.current) {
          googleMapRef.current.fitToCoordinates(coords, {
            edgePadding: padding,
            animated: true,
          });
        }
      },
      animateToRegion: (region: Region, duration = 500) => {
        if (googleMapRef.current) {
          googleMapRef.current.animateToRegion(region, duration);
        }
      },
    }));

    // Render marker based on type
    const renderMarkerContent = (marker: MarkerData) => {
      switch (marker.type) {
        case 'pickup':
          return (
            <View style={styles.pickupMarker}>
              <View style={styles.pickupMarkerInner} />
            </View>
          );
        case 'dropoff':
          return (
            <View style={styles.dropoffMarker}>
              <View style={styles.dropoffMarkerInner} />
            </View>
          );
        case 'driver':
          return (
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerIcon}>🚗</Text>
            </View>
          );
        default:
          return (
            <View style={styles.customMarker}>
              <Text>{marker.icon || '📍'}</Text>
            </View>
          );
      }
    };

    // Style toggle button
    const StyleToggleButton = () => (
      <TouchableOpacity
        style={styles.styleToggle}
        onPress={() => setShowStyleModal(true)}
      >
        <Text style={styles.styleToggleIcon}>🗺️</Text>
      </TouchableOpacity>
    );

    // Style selection modal - Google Maps only
    const StyleModal = () => (
      <Modal
        visible={showStyleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStyleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Map View</Text>

            {/* Style Selection */}
            <View style={styles.styleGrid}>
              {(['standard', 'satellite', 'hybrid', 'terrain'] as MapStyle[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.styleOption, mapStyle === s && styles.styleOptionActive]}
                  onPress={() => {
                    setStyle(s);
                    setShowStyleModal(false);
                  }}
                >
                  <Text style={styles.styleOptionIcon}>
                    {s === 'standard' ? '🛣️' : s === 'satellite' ? '🛰️' : s === 'hybrid' ? '🌐' : '⛰️'}
                  </Text>
                  <Text style={[styles.styleOptionText, mapStyle === s && styles.styleOptionTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowStyleModal(false)}
            >
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );

    return (
      <View style={[styles.container, style]}>
        <GoogleMapView
          ref={googleMapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          mapType={styleToMapType[mapStyle]}
          showsUserLocation={showsUserLocation}
          showsMyLocationButton={false}
          scrollEnabled={scrollEnabled}
          zoomEnabled={zoomEnabled}
          rotateEnabled={rotateEnabled}
          pitchEnabled={pitchEnabled}
        >
          {/* Markers */}
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              title={marker.title}
            >
              {renderMarkerContent(marker)}
            </Marker>
          ))}

          {/* Routes */}
          {routes.map((route, index) => (
            CONFIG.GOOGLE_MAPS_API_KEY && (
              <MapViewDirections
                key={`route-${index}`}
                origin={route.origin}
                destination={route.destination}
                apikey={CONFIG.GOOGLE_MAPS_API_KEY}
                strokeWidth={route.strokeWidth || 4}
                strokeColor={route.color || COLORS.primary}
                lineDashPattern={route.dashed ? [5, 5] : undefined}
                optimizeWaypoints
                onReady={(result) => {
                  if (index === 0 && onRouteReady) {
                    onRouteReady(result.distance, result.duration);
                  }
                }}
              />
            )
          ))}
        </GoogleMapView>

        {showStyleToggle && <StyleToggleButton />}
        <StyleModal />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  // Markers
  pickupMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22C55E30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  dropoffMarker: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropoffMarkerInner: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.primary,
  },
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
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
  customMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
  // Modal
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
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  styleOptionIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  styleOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  styleOptionTextActive: {
    color: COLORS.primary,
  },
  closeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
