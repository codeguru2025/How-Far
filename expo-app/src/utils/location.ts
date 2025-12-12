// Location Utilities - Auto-capture and geocoding
import * as ExpoLocation from 'expo-location';
import { Location } from '../types';
import { CONFIG } from '../config';

export interface LocationResult {
  success: boolean;
  location?: Location;
  error?: string;
}

// Get current location with reverse geocoding
export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    // Request permission
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, error: 'Location permission not granted' };
    }

    // Get current position
    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });

    const { latitude, longitude } = position.coords;

    // Reverse geocode to get address
    const address = await reverseGeocode(latitude, longitude);

    return {
      success: true,
      location: {
        latitude,
        longitude,
        address: address.fullAddress,
        name: address.shortName,
      },
    };
  } catch (error) {
    console.error('getCurrentLocation error:', error);
    return { success: false, error: 'Failed to get current location' };
  }
}

// Reverse geocode coordinates to address using Google Maps API
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ fullAddress: string; shortName: string }> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${CONFIG.GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      
      // Try to get a meaningful short name
      let shortName = 'Current Location';
      const components = result.address_components || [];
      
      // Look for neighborhood, sublocality, or route
      for (const component of components) {
        if (
          component.types.includes('neighborhood') ||
          component.types.includes('sublocality_level_1') ||
          component.types.includes('sublocality')
        ) {
          shortName = component.long_name;
          break;
        }
        if (component.types.includes('route')) {
          shortName = component.long_name;
        }
      }

      return {
        fullAddress: result.formatted_address || 'Unknown Location',
        shortName,
      };
    }

    return { fullAddress: 'Unknown Location', shortName: 'Current Location' };
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return { fullAddress: 'Unknown Location', shortName: 'Current Location' };
  }
}

// Calculate distance between two points (in km)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Optimize pickup route using nearest neighbor algorithm
export interface PickupPoint {
  id: string;
  latitude: number;
  longitude: number;
  riderName?: string;
  seats?: number;
}

export interface OptimizedRoute {
  orderedPickups: PickupPoint[];
  totalDistance: number;
  estimatedTime: number; // in minutes
}

// Simple nearest-neighbor route optimization
export function optimizePickupRoute(
  driverLocation: { latitude: number; longitude: number },
  pickupPoints: PickupPoint[],
  destination: { latitude: number; longitude: number }
): OptimizedRoute {
  if (pickupPoints.length === 0) {
    return { orderedPickups: [], totalDistance: 0, estimatedTime: 0 };
  }

  if (pickupPoints.length === 1) {
    const dist = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      pickupPoints[0].latitude,
      pickupPoints[0].longitude
    );
    return {
      orderedPickups: pickupPoints,
      totalDistance: dist,
      estimatedTime: Math.round(dist * 2), // Rough estimate: 2 min per km
    };
  }

  // Nearest neighbor algorithm for simple route optimization
  const ordered: PickupPoint[] = [];
  const remaining = [...pickupPoints];
  let currentPos = driverLocation;
  let totalDist = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(
        currentPos.latitude,
        currentPos.longitude,
        remaining[i].latitude,
        remaining[i].longitude
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    ordered.push(remaining[nearestIdx]);
    currentPos = remaining[nearestIdx];
    totalDist += nearestDist;
    remaining.splice(nearestIdx, 1);
  }

  // Add distance to destination
  const distToDest = calculateDistance(
    currentPos.latitude,
    currentPos.longitude,
    destination.latitude,
    destination.longitude
  );
  totalDist += distToDest;

  return {
    orderedPickups: ordered,
    totalDistance: totalDist,
    estimatedTime: Math.round(totalDist * 2.5), // Rough estimate including stops
  };
}

// Get driving directions with multiple waypoints using Google Directions API
export async function getOptimizedDirections(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  waypoints: { latitude: number; longitude: number }[]
): Promise<{
  success: boolean;
  polyline?: string;
  distance?: number;
  duration?: number;
  waypointOrder?: number[];
}> {
  try {
    if (!CONFIG.GOOGLE_MAPS_API_KEY) {
      return { success: false };
    }

    const waypointsParam = waypoints.length > 0
      ? `&waypoints=optimize:true|${waypoints.map(w => `${w.latitude},${w.longitude}`).join('|')}`
      : '';

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}${waypointsParam}&mode=driving&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      return { success: false };
    }

    const route = data.routes[0];
    
    // Sum up total distance and duration across all legs
    let totalDistance = 0;
    let totalDuration = 0;
    for (const leg of route.legs) {
      totalDistance += leg.distance?.value || 0;
      totalDuration += leg.duration?.value || 0;
    }

    return {
      success: true,
      polyline: route.overview_polyline?.points,
      distance: totalDistance / 1000, // Convert to km
      duration: totalDuration / 60, // Convert to minutes
      waypointOrder: route.waypoint_order,
    };
  } catch (error) {
    console.error('getOptimizedDirections error:', error);
    return { success: false };
  }
}


