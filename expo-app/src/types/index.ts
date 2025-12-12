// ============ TYPES ============
// Main type definitions for the app
// Type guards are in ./guards.ts

export type Screen = 
  // Auth & Main
  | 'splash' | 'signin' | 'signup' | 'home' | 'wallet' | 'topup' | 'profile' | 'history'
  // Old ride flow (keeping for compatibility)
  | 'driver' | 'search' | 'confirm-ride' | 'tracking'
  // Shared Rides - Driver
  | 'driver-home' | 'create-trip' | 'set-route' | 'set-fares' | 'trip-dashboard' | 'scan-qr' | 'add-vehicle' | 'register-driver' | 'driver-map' | 'trip-active' | 'withdraw'
  // Shared Rides - Rider
  | 'commuter-home' | 'find-rides' | 'trip-details' | 'book-seat' | 'booking-active' | 'show-qr' | 'rider-map'
  // Settings & Profile
  | 'settings' | 'language-settings' | 'edit-profile' | 'notifications' | 'safety' | 'payment-methods' | 'help'
  // Chat
  | 'chat' | 'conversations';
export type UserRole = 'passenger' | 'driver';
export type PaymentMethod = 'ecocash' | 'onemoney' | 'innbucks' | 'bank';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type TransactionType = 'topup' | 'payment' | 'transfer' | 'ride';

export interface User {
  id: string;
  phone_number: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  status?: string;
}

export interface Wallet {
  id?: string;
  user_id?: string;
  balance: number;
  currency: string;
  pending_balance?: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description?: string;
  reference: string;
  paynow_poll_url?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface PayNowResponse {
  success: boolean;
  error?: string;
  browserUrl?: string;
  pollUrl?: string;
  instructions?: string;
  innbucksCode?: string | null;
  innbucksDeepLink?: string | null;
  innbucksQR?: string | null;
  innbucksExpiry?: string | null;
  isInnbucks?: boolean;
}

// ============ RIDE TYPES ============

export type RideStatus = 'pending' | 'searching' | 'matching' | 'matched' | 'driver_assigned' | 'driver_arriving' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
export type VehicleType = 'sedan' | 'suv' | 'minivan' | 'motorcycle' | 'kombi';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
}

export interface Driver {
  id: string;
  user_id: string;
  first_name: string;
  last_name?: string;
  phone_number: string;
  rating: number;
  total_rides: number;
  photo_url?: string;
  vehicle?: Vehicle;
  location?: Location;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  color: string;
  registration_number: string;
  year: number;
}

export interface RideOption {
  type: VehicleType;
  name: string;
  icon: string;
  description: string;
  eta: number; // minutes
  price: number;
  priceRange?: string;
}

export interface Ride {
  id: string;
  status: RideStatus;
  passenger_id: string;
  driver?: Driver;
  pickup: Location;
  dropoff: Location;
  vehicle_type: VehicleType;
  estimated_fare: number;
  actual_fare?: number;
  distance_km: number;
  duration_minutes: number;
  created_at: string;
}

// ============ SHARED RIDES TYPES ============

export type TripStatus = 'draft' | 'scheduled' | 'pending' | 'active' | 'in_progress' | 'completed' | 'cancelled';
export type TripType = 'local' | 'kombi' | 'long_distance' | 'private';
export type BookingStatus = 'pending' | 'confirmed' | 'picked_up' | 'completed' | 'cancelled' | 'no_show';
export type PickupType = 'at_origin' | 'custom_pickup';
export type DropoffType = 'at_destination' | 'at_waypoint' | 'custom_dropoff';
export type AppMode = 'rider' | 'driver';

export interface Trip {
  id: string;
  driver_id: string;
  vehicle_id: string;
  owner_id?: string;
  
  // Route
  origin: Location;
  destination: Location;
  origin_address?: string;
  destination_address?: string;
  route_polyline?: string;
  waypoints?: TripWaypoint[];
  
  // Details
  trip_type: TripType;
  total_seats: number;
  available_seats: number;
  seats_available?: number; // DB column name alias
  seats_total?: number; // DB column name alias
  
  // Pricing
  base_fare: number;
  pickup_fee: number;
  dropoff_fee: number;
  
  // Status
  status: TripStatus;
  departure_time?: string;
  started_at?: string;
  completed_at?: string;
  
  // Driver info (joined)
  driver?: Driver;
  driver_name?: string;
  driver_rating?: number;
  vehicle?: Vehicle;
  vehicle_info?: {
    make?: string;
    model?: string;
    color?: string;
    registration_number?: string;
  };
  
  // Bookings
  bookings?: Booking[];
  
  // Computed fields (from API joins)
  trip_id?: string; // Used in search results
  totalEarnings?: number;
  totalSeatsBooked?: number;
  
  created_at: string;
}

export interface TripWaypoint {
  id: string;
  trip_id: string;
  location: Location;
  waypoint_order: number;
  fare_to_here?: number; // For variable pricing
  estimated_arrival?: string;
  actual_arrival?: string;
}

/**
 * Booking interface - matches database schema
 * Note: DB columns use both naming conventions depending on migration version
 * - commuter_id / rider_id (both reference the rider/commuter)
 * - seats / seats_booked (number of seats)
 * - fare / total_amount (total amount to pay)
 */
export interface Booking {
  id: string;
  trip_id: string;
  
  // Rider (supports both column names from DB)
  commuter_id?: string;
  rider_id?: string;
  
  // Seats (supports both column names from DB)
  seats?: number;
  seats_booked?: number;
  
  // Pickup/Dropoff
  pickup_type: PickupType;
  pickup_location?: Location;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_address?: string;
  dropoff_type: DropoffType;
  dropoff_waypoint_id?: string;
  dropoff_location?: Location;
  dropoff_latitude?: number;
  dropoff_longitude?: number;
  dropoff_address?: string;
  
  // Pricing (supports both column names from DB)
  fare?: number;
  base_amount?: number;
  pickup_fee?: number;
  dropoff_fee?: number;
  total_amount?: number;
  rider_fee?: number; // 2.5%
  driver_fee?: number; // 7.5%
  
  // Status
  status: BookingStatus;
  payment_status?: 'pending' | 'paid' | 'refunded' | 'failed';
  qr_code_token?: string;
  
  // Joined data
  trip?: Trip;
  rider?: User;
  commuter?: User; // Alias for rider
  
  // Timestamps
  created_at: string;
  confirmed_at?: string;
  paid_at?: string;
  qr_scanned_at?: string;
}

export interface QRPaymentResult {
  success: boolean;
  error?: string;
  booking_id?: string;
  amount_paid?: number;
  driver_received?: number;
  rider_fee?: number;
  driver_fee?: number;
}

