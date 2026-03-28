// Trips API - Shared Rides System
// Works with existing trips schema (jsonb origin/destination)
import { supabase } from './supabase';
import { Trip, TripWaypoint, Booking, Location, VehicleType, TripStatus, BookingStatus, QRPaymentResult } from '../types';
import { apiCache } from '../utils/apiCache';
import { getCurrentUser } from '../utils/auth';

// ============================================
// DRIVER: Trip Management
// ============================================

export interface CreateTripParams {
  origin: Location;
  destination: Location;
  vehicleId: string;
  tripType: 'kombi' | 'long_distance' | 'private';
  totalSeats: number;
  baseFare: number;
  pickupFee?: number;
  dropoffFee?: number;
  departureTime?: string;
  waypoints?: Location[];
}

// Create a new trip
export async function createTrip(params: CreateTripParams): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Get driver ID
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (driverError) {
      console.error('Driver lookup error:', driverError);
      return { success: false, error: 'Failed to check driver status' };
    }

    if (!driver) {
      return { success: false, error: 'Not registered as a driver. Please register first.' };
    }

    // Create trip with JSONB origin/destination (matching actual schema)
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        driver_id: driver.id,
        vehicle_id: params.vehicleId,
        owner_id: user.id,
        origin: {
          latitude: params.origin.latitude,
          longitude: params.origin.longitude,
          address: params.origin.address || params.origin.name || 'Origin',
        },
        destination: {
          latitude: params.destination.latitude,
          longitude: params.destination.longitude,
          address: params.destination.address || params.destination.name || 'Destination',
        },
        waypoints: params.waypoints?.map((wp, i) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          address: wp.address || wp.name || `Stop ${i + 1}`,
          order: i,
        })) || [],
        trip_type: params.tripType,
        seats_total: params.totalSeats,
        seats_available: params.totalSeats,
        base_fare: params.baseFare,
        pickup_fee: params.pickupFee || 0,
        dropoff_fee: params.dropoffFee || 0,
        departure_time: params.departureTime || new Date().toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (tripError) {
      console.error('Create trip error:', tripError);
      return { success: false, error: 'Failed to create trip' };
    }

    return { success: true, trip };
  } catch (error) {
    console.error('Create trip error:', error);
    return { success: false, error: 'Network error' };
  }
}

// Start trip (make it active/visible to riders)
export async function startTrip(tripId: string): Promise<boolean> {
  try {
    if (__DEV__) console.log('Starting trip:', tripId);
    const { data, error } = await supabase
      .from('trips')
      .update({ status: 'active' })
      .eq('id', tripId)
      .select()
      .single();
    
    if (error) {
      console.error('Start trip error:', error);
      return false;
    }
    
    if (__DEV__) console.log('Trip started successfully:', data);
    // Invalidate cache so next fetch gets fresh data
    invalidateDriverTripCache();
    return true;
  } catch (e) {
    console.error('Start trip exception:', e);
    return false;
  }
}

// Begin trip (driver starts moving)
export async function beginTrip(tripId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('trips')
      .update({ status: 'in_progress' })
      .eq('id', tripId);
    
    return !error;
  } catch {
    return false;
  }
}

// Complete trip
export async function completeTrip(tripId: string): Promise<boolean> {
  try {
    // Complete the trip
    const { error } = await supabase
      .from('trips')
      .update({ status: 'completed' })
      .eq('id', tripId);
    
    if (error) return false;

    // Archive all conversations for this trip
    await supabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('trip_id', tripId);
    
    return true;
  } catch {
    return false;
  }
}

// Cancel trip
export async function cancelTrip(tripId: string): Promise<boolean> {
  try {
    // Cancel all pending bookings first
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancellation_reason: 'Trip cancelled by driver' })
      .eq('trip_id', tripId)
      .in('status', ['pending', 'confirmed']);

    const { error } = await supabase
      .from('trips')
      .update({ status: 'cancelled' })
      .eq('id', tripId);
    
    return !error;
  } catch {
    return false;
  }
}

// Get driver's trips
export async function getDriverTrips(status?: string[]): Promise<any[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!driver) return [];

    let query = supabase
      .from('trips')
      .select(`*, vehicles (*)`)
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: false });

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    const { data, error } = await query;
    if (error) return [];

    return data || [];
  } catch {
    return [];
  }
}

// Get active trip for driver
export async function getDriverActiveTrip(forceRefresh: boolean = false): Promise<any | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const cacheKey = `driver_active_trip_${user.id}`;
    
    // Check cache unless force refresh requested
    if (!forceRefresh) {
      const cached = apiCache.get<any>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!driver) return null;

    // Simple query without joins that might fail
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('driver_id', driver.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (__DEV__) console.log('getDriverActiveTrip - trip:', data?.id, 'status:', data?.status, 'error:', error);
    
    if (data) {
      // Get bookings separately with commuter info
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('trip_id', data.id);
      
      // Fetch commuter names for each booking
      if (bookings && bookings.length > 0) {
        const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
          if (booking.rider_id) {
            const { data: commuter } = await supabase
              .from('users')
              .select('first_name, last_name, phone_number')
              .eq('id', booking.rider_id)
              .single();
            return { ...booking, rider: commuter };
          }
          return booking;
        }));
        data.bookings = enrichedBookings;
      } else {
        data.bookings = [];
      }
      
      // Calculate total earnings from bookings
      const confirmedBookings = data.bookings.filter((b: any) => 
        b.status === 'confirmed' || b.payment_status === 'paid'
      );
      data.totalEarnings = confirmedBookings.reduce((sum: number, b: any) => sum + (b.total_amount || b.base_amount || b.fare || 0), 0);
      data.totalSeatsBooked = confirmedBookings.reduce((sum: number, b: any) => sum + (b.seats_booked || b.seats || 0), 0);
    }

    if (error || !data) {
      apiCache.set(cacheKey, null, 10000); // Cache null for 10 seconds
      return null;
    }
    
    // Cache for 15 seconds
    apiCache.set(cacheKey, data, 15000);
    return data;
  } catch {
    return null;
  }
}

// Invalidate driver trip cache (call after trip updates)
export function invalidateDriverTripCache(userId?: string): void {
  if (userId) {
    apiCache.invalidate(`driver_active_trip_${userId}`);
  } else {
    apiCache.invalidatePrefix('driver_active_trip_');
  }
}

// Update driver location during trip
export async function updateTripLocation(tripId: string, location: Location): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('trips')
      .update({
        current_location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      })
      .eq('id', tripId);
    
    return !error;
  } catch {
    return false;
  }
}

// ============================================
// RIDER: Find and Book Trips
// ============================================

// Find trips going in rider's direction
export async function findTrips(origin: Location, destination: Location): Promise<any[]> {
  // Create cache key based on rounded coordinates (for nearby searches)
  const cacheKey = `find_trips_${origin.latitude.toFixed(3)}_${origin.longitude.toFixed(3)}_${destination.latitude.toFixed(3)}_${destination.longitude.toFixed(3)}`;
  
  // Use dedupe to prevent concurrent identical requests
  return apiCache.dedupe(cacheKey, async () => {
    try {
      const { data, error } = await supabase.rpc('find_trips_by_direction', {
        p_origin_lat: origin.latitude,
        p_origin_lng: origin.longitude,
        p_dest_lat: destination.latitude,
        p_dest_lng: destination.longitude,
        p_radius_km: 10,
      });

      if (error) {
        console.error('Find trips error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Find trips error:', error);
      return [];
    }
  });
}

// Get trip details
export async function getTripDetails(tripId: string): Promise<any | null> {
  const cacheKey = `trip_details_${tripId}`;
  
  // Use dedupe for concurrent requests
  return apiCache.dedupe(cacheKey, async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select(`*, drivers (*), vehicles (*)`)
        .eq('id', tripId)
        .single();

      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  });
}

// Book a seat on a trip
export interface BookSeatParams {
  tripId: string;
  seats: number;
  pickupType: 'at_origin' | 'custom_pickup';
  pickupLocation?: Location; // Rider's current/custom pickup location
  dropoffType: 'at_destination' | 'at_waypoint' | 'custom_dropoff';
  dropoffWaypointId?: string;
  dropoffLocation?: Location;
  riderCurrentLocation?: Location; // For auto-captured location
}

export async function bookSeat(params: BookSeatParams): Promise<{ success: boolean; booking?: any; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Get trip details for pricing
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', params.tripId)
      .single();

    if (tripError || !trip) {
      return { success: false, error: 'Trip not found' };
    }

    if (trip.seats_available < params.seats) {
      return { success: false, error: `Only ${trip.seats_available} seats available` };
    }

    // Calculate pricing
    const baseFare = trip.base_fare || 0;
    const seatsToBook = params.seats || 1;
    const baseAmount = baseFare * seatsToBook;
    // Use driver's set pickup/dropoff fees from the trip
    const pickupFee = params.pickupType === 'custom_pickup' ? (trip.pickup_fee || 0) : 0;
    const dropoffFee = params.dropoffType === 'custom_dropoff' ? (trip.dropoff_fee || 0) : 0;
    const totalAmount = baseAmount + pickupFee + dropoffFee;
    
    if (__DEV__) console.log('bookSeat - pricing:', { 
      baseFare, 
      seatsToBook, 
      baseAmount, 
      pickupFee,
      dropoffFee,
      totalAmount,
      pickupType: params.pickupType,
      dropoffType: params.dropoffType 
    });

    // Check rider's wallet balance (need total + 2.5% fee)
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    const riderFee = Math.round(totalAmount * 0.025 * 100) / 100;
    const requiredBalance = totalAmount + riderFee;

    if (!wallet || wallet.balance < requiredBalance) {
      return { 
        success: false, 
        error: `Insufficient balance. Need $${requiredBalance.toFixed(2)}, have $${(wallet?.balance || 0).toFixed(2)}` 
      };
    }

    // Determine pickup location (use rider's current location if available)
    const pickupLocation = params.pickupLocation || params.riderCurrentLocation;
    
    // Create booking (matching actual table columns)
    const bookingData: any = {
      trip_id: params.tripId,
      rider_id: user.id,
      seats_booked: seatsToBook,
      base_amount: baseAmount, // Total base fare (baseFare * seats)
      total_amount: totalAmount > 0 ? totalAmount : baseAmount, // base + fees
      pickup_fee: pickupFee,
      dropoff_fee: dropoffFee,
      status: 'pending',
      payment_status: 'pending',
    };
    
    // Add pickup location if available
    if (pickupLocation) {
      bookingData.pickup_latitude = pickupLocation.latitude;
      bookingData.pickup_longitude = pickupLocation.longitude;
      bookingData.pickup_address = pickupLocation.address || pickupLocation.name;
    }
    
    // Add dropoff location if custom
    if (params.dropoffLocation) {
      bookingData.dropoff_latitude = params.dropoffLocation.latitude;
      bookingData.dropoff_longitude = params.dropoffLocation.longitude;
      bookingData.dropoff_address = params.dropoffLocation.address || params.dropoffLocation.name;
    }
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();
    
    if (__DEV__) console.log('bookSeat - insert result:', booking, bookingError);

    if (bookingError) {
      console.error('Book seat error:', bookingError);
      return { success: false, error: 'Failed to create booking' };
    }

    return { success: true, booking };
  } catch (error) {
    console.error('Book seat error:', error);
    return { success: false, error: 'Network error' };
  }
}

// Get rider's bookings
export async function getRiderBookings(status?: string[]): Promise<any[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    let query = supabase
      .from('bookings')
      .select('*')
      .eq('rider_id', user.id)
      .order('created_at', { ascending: false });

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    const { data, error } = await query;
    if (error) return [];

    return data || [];
  } catch {
    return [];
  }
}

// Get active booking for rider
export async function getRiderActiveBooking(): Promise<any | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    // Use correct column name
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('rider_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (__DEV__) console.log('getRiderActiveBooking - booking:', data, 'error:', error);

    if (error || !data) return null;
    
    // Fetch trip details separately
    if (data.trip_id) {
      const { data: trip } = await supabase
        .from('trips')
        .select('*')
        .eq('id', data.trip_id)
        .single();
      data.trip = trip;
    }
    
    return data;
  } catch (e) {
    console.error('getRiderActiveBooking error:', e);
    return null;
  }
}

// ============================================
// DRIVER: Booking Management
// ============================================

// Accept/Confirm a booking
export async function confirmBooking(bookingId: string): Promise<boolean> {
  try {
    // Fetch booking with trip data
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, seats_booked, trip_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) return false;

    // Get trip separately to avoid join issues
    const { data: trip } = await supabase
      .from('trips')
      .select('seats_available')
      .eq('id', booking.trip_id)
      .single();

    if (!trip) return false;

    // Use 'seats' column (actual schema) with fallback
    const seatsToBook = booking.seats || 1;

    // Check seats available
    if (trip.seats_available < seatsToBook) {
      return false;
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (updateError) return false;

    // Reduce available seats
    await supabase
      .from('trips')
      .update({ seats_available: trip.seats_available - seatsToBook })
      .eq('id', booking.trip_id);

    return true;
  } catch {
    return false;
  }
}

// Reject a booking
export async function rejectBooking(bookingId: string, reason?: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled', 
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Rejected by driver'
      })
      .eq('id', bookingId);

    return !error;
  } catch {
    return false;
  }
}

// Mark rider as picked up (use 'completed' since 'picked_up' may not be in enum)
export async function markPickedUp(bookingId: string): Promise<boolean> {
  try {
    // First try picked_up, if that fails, use completed
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed', payment_status: 'paid' })
      .eq('id', bookingId);

    return !error;
  } catch {
    return false;
  }
}

// ============================================
// QR PAYMENT
// ============================================

// Get QR code data for booking
export async function getBookingQRCode(bookingId: string): Promise<{ qrToken: string; bookingData: any } | null> {
  try {
    // Use correct column names from actual schema
    const { data, error } = await supabase
      .from('bookings')
      .select('id, total_amount, base_amount, seats_booked, status, trip_id, rider_id')
      .eq('id', bookingId)
      .single();

    if (__DEV__) console.log('getBookingQRCode - booking:', data, 'error:', error);

    if (error || !data) return null;

    // Generate a simple QR token based on booking ID
    const qrToken = `QR-${bookingId.substring(0, 8).toUpperCase()}`;
    
    // Get trip details
    const { data: trip } = await supabase
      .from('trips')
      .select('origin, destination, driver_id')
      .eq('id', data.trip_id)
      .single();
    

    return {
      qrToken: qrToken,
      bookingData: {
        id: data.id,
        amount: data.total_amount || data.base_amount,
        seats: data.seats_booked,
        status: data.status,
        trip: trip,
      },
    };
  } catch (error) {
    console.error('getBookingQRCode error:', error);
    return null;
  }
}

// Process QR payment (driver scans rider's QR)
export async function processQRPayment(qrToken: string): Promise<QRPaymentResult> {
  try {
    const { data, error } = await supabase.rpc('process_qr_payment', { p_qr_token: qrToken });

    if (error) {
      console.error('QR payment error:', error);
      return { success: false, error: 'Payment processing failed' };
    }

    return data as QRPaymentResult;
  } catch (error) {
    console.error('QR payment error:', error);
    return { success: false, error: 'Network error' };
  }
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

// Subscribe to trip updates (for driver)
export function subscribeToTrip(tripId: string, onUpdate: (trip: any) => void) {
  const subscription = supabase
    .channel(`trip:${tripId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'trips',
      filter: `id=eq.${tripId}`,
    }, async () => {
      const trip = await getTripDetails(tripId);
      if (trip) onUpdate(trip);
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bookings',
      filter: `trip_id=eq.${tripId}`,
    }, async () => {
      const trip = await getTripDetails(tripId);
      if (trip) onUpdate(trip);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}

// Subscribe to booking updates (for rider)
export function subscribeToBooking(bookingId: string, onUpdate: (booking: any) => void) {
  const subscription = supabase
    .channel(`booking:${bookingId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'bookings',
      filter: `id=eq.${bookingId}`,
    }, async () => {
      const bookings = await getRiderBookings();
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) onUpdate(booking);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}
