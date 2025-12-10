// Rides API - Handle ride requests, tracking, and history
// Uses custom auth (users table) instead of Supabase Auth
import { supabase } from './supabase';
import { Location, Driver, RideStatus, VehicleType } from '../types';
import { CONFIG } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'ndeip_user_session';

// Helper to get current user from storage
async function getCurrentUser() {
  try {
    const data = await AsyncStorage.getItem(AUTH_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch {
    return null;
  }
}

export interface RideRequest {
  pickup: Location;
  dropoff: Location;
  vehicleType: VehicleType;
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedPrice: number;
}

export interface RideResponse {
  success: boolean;
  request_id?: string;
  ride_id?: string;
  status: string;
  driver?: {
    id: string;
    name: string;
    rating: number;
    total_rides: number;
    distance_km: number;
    vehicle: {
      make: string;
      model: string;
      color: string;
      registration_number: string;
    };
  };
  message?: string;
  error?: string;
}

export interface RideDetails {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  status: RideStatus;
  base_price: number;
  final_price?: number;
  driver_latitude?: number;
  driver_longitude?: number;
  driver_eta?: number;
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    rating: number;
    total_rides: number;
  };
  vehicle?: {
    make: string;
    model: string;
    color: string;
    registration_number: string;
  };
  created_at: string;
}

export interface RideHistoryItem {
  ride_id: string;
  pickup_address: string;
  dropoff_address: string;
  distance: number;
  duration: number;
  final_price: number;
  status: string;
  driver_name: string;
  driver_rating: number;
  vehicle_info: {
    make: string;
    model: string;
    color: string;
    registration_number: string;
  };
  created_at: string;
  completed_at?: string;
}

// Request a new ride
export async function requestRide(request: RideRequest): Promise<RideResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, status: 'error', error: 'Not authenticated' };
    }

    // Check wallet balance first
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet || wallet.balance < request.estimatedPrice) {
      return { 
        success: false, 
        status: 'error', 
        error: `Insufficient wallet balance. Need $${request.estimatedPrice}, have $${wallet?.balance || 0}` 
      };
    }

    // Create ride request
    const { data: rideRequest, error: requestError } = await supabase
      .from('ride_requests')
      .insert({
        user_id: user.id,
        pickup_latitude: request.pickup.latitude,
        pickup_longitude: request.pickup.longitude,
        pickup_address: request.pickup.name || 'Pickup Location',
        dropoff_latitude: request.dropoff.latitude,
        dropoff_longitude: request.dropoff.longitude,
        dropoff_address: request.dropoff.name || 'Dropoff Location',
        vehicle_type: request.vehicleType,
        estimated_distance: request.estimatedDistance,
        estimated_duration: request.estimatedDuration,
        estimated_price: request.estimatedPrice,
        status: 'matching',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating request:', requestError);
      return { success: false, status: 'error', error: 'Failed to create ride request' };
    }

    // Find nearby drivers
    const { data: drivers, error: driversError } = await supabase.rpc('find_nearby_drivers', {
      p_latitude: request.pickup.latitude,
      p_longitude: request.pickup.longitude,
      p_vehicle_type: request.vehicleType,
      p_radius_km: 15,
    });

    if (driversError) {
      console.error('Error finding drivers:', driversError);
    }

    // If drivers found, match with closest available driver
    if (drivers && drivers.length > 0) {
      const matchedDriver = drivers[0];

      // Update request with matched driver
      await supabase
        .from('ride_requests')
        .update({
          status: 'matched',
          matched_driver_id: matchedDriver.driver_id,
          matched_at: new Date().toISOString(),
        })
        .eq('id', rideRequest.id);

      // Mark driver as unavailable
      await supabase
        .from('drivers')
        .update({ is_available: false })
        .eq('id', matchedDriver.driver_id);

      // Create the ride
      const { data: ride, error: rideError } = await supabase
        .from('rides')
        .insert({
          request_id: rideRequest.id,
          user_id: user.id,
          driver_id: matchedDriver.driver_id,
          pickup_latitude: request.pickup.latitude,
          pickup_longitude: request.pickup.longitude,
          pickup_address: request.pickup.name || 'Pickup Location',
          dropoff_latitude: request.dropoff.latitude,
          dropoff_longitude: request.dropoff.longitude,
          dropoff_address: request.dropoff.name || 'Dropoff Location',
          vehicle_type: request.vehicleType,
          distance: request.estimatedDistance,
          duration: request.estimatedDuration,
          base_price: request.estimatedPrice,
          status: 'driver_assigned',
        })
        .select()
        .single();

      if (rideError) {
        console.error('Error creating ride:', rideError);
        return { success: false, status: 'error', error: 'Failed to create ride' };
      }

      return {
        success: true,
        request_id: rideRequest.id,
        ride_id: ride.id,
        status: 'matched',
        driver: {
          id: matchedDriver.driver_id,
          name: `${matchedDriver.first_name} ${matchedDriver.last_name}`,
          rating: matchedDriver.rating,
          total_rides: matchedDriver.total_rides,
          distance_km: matchedDriver.distance_km,
          vehicle: matchedDriver.vehicle_info,
        },
      };
    }

    // No drivers available - return pending status
    return {
      success: true,
      request_id: rideRequest.id,
      status: 'matching',
      message: 'Looking for available drivers...',
    };
  } catch (error) {
    console.error('Request ride error:', error);
    return { success: false, status: 'error', error: 'Network error' };
  }
}

// Get current active ride
export async function getActiveRide(): Promise<RideDetails | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('rides')
      .select(`
        *,
        drivers (
          id,
          first_name,
          last_name,
          phone_number,
          rating,
          total_rides
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    // Get vehicle info
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('driver_id', data.driver_id)
      .eq('is_active', true)
      .single();

    return {
      ...data,
      driver: data.drivers,
      vehicle: vehicle,
    };
  } catch (error) {
    console.error('Get active ride error:', error);
    return null;
  }
}

// Subscribe to ride updates (real-time)
export function subscribeToRide(
  rideId: string,
  onUpdate: (ride: RideDetails) => void
) {
  const subscription = supabase
    .channel(`ride:${rideId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      },
      async (payload) => {
        console.log('Ride update:', payload);
        const ride = await getActiveRide();
        if (ride) {
          onUpdate(ride);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

// Subscribe to driver location updates
export function subscribeToDriverLocation(
  rideId: string,
  onLocationUpdate: (location: { latitude: number; longitude: number; eta?: number }) => void
) {
  const subscription = supabase
    .channel(`driver-location:${rideId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_locations',
        filter: `ride_id=eq.${rideId}`,
      },
      (payload) => {
        console.log('Driver location update:', payload);
        const { latitude, longitude } = payload.new as any;
        onLocationUpdate({ latitude, longitude });
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

// Update ride status
export async function updateRideStatus(
  rideId: string,
  status: RideStatus
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('rides')
      .update({ 
        status,
        ...(status === 'driver_arrived' && { driver_arrived_at: new Date().toISOString() }),
        ...(status === 'in_progress' && { started_at: new Date().toISOString() }),
      })
      .eq('id', rideId);

    return !error;
  } catch (error) {
    console.error('Update ride status error:', error);
    return false;
  }
}

// Complete ride and process payment
export async function completeRide(
  rideId: string,
  tipAmount: number = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*, drivers(*)')
      .eq('id', rideId)
      .single();

    if (rideError || !ride) {
      return { success: false, error: 'Ride not found' };
    }

    const finalPrice = ride.base_price + tipAmount;

    // Get rider's wallet
    const { data: riderWallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', ride.user_id)
      .single();

    if (walletError || !riderWallet || riderWallet.balance < finalPrice) {
      return { success: false, error: 'Insufficient balance for payment' };
    }

    // Deduct from rider wallet
    const { error: deductError } = await supabase
      .from('wallets')
      .update({ 
        balance: riderWallet.balance - finalPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', riderWallet.id);

    if (deductError) {
      console.error('Deduct error:', deductError);
      return { success: false, error: 'Payment processing failed' };
    }

    // Create transaction record for rider
    await supabase
      .from('transactions')
      .insert({
        user_id: ride.user_id,
        type: 'ride_payment',
        amount: finalPrice,
        status: 'completed',
        reference: `RIDE-${rideId.substring(0, 8).toUpperCase()}`,
        description: `Ride payment to ${ride.dropoff_address}`,
      });

    // Credit driver (80% of ride fare, platform takes 20%)
    const driverEarnings = ride.base_price * 0.8;
    
    if (ride.drivers?.user_id) {
      const { data: driverWallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', ride.drivers.user_id)
        .single();

      if (driverWallet) {
        await supabase
          .from('wallets')
          .update({ 
            balance: driverWallet.balance + driverEarnings + tipAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', driverWallet.id);

        // Create transaction for driver
        await supabase
          .from('transactions')
          .insert({
            user_id: ride.drivers.user_id,
            type: 'ride_earnings',
            amount: driverEarnings + tipAmount,
            status: 'completed',
            reference: `EARN-${rideId.substring(0, 8).toUpperCase()}`,
            description: `Ride earnings from ${ride.pickup_address}`,
          });
      }
    }

    // Update ride as completed
    await supabase
      .from('rides')
      .update({
        status: 'completed',
        payment_status: 'completed',
        final_price: finalPrice,
        tip_amount: tipAmount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', rideId);

    // Mark driver as available again
    if (ride.drivers) {
      await supabase
        .from('drivers')
        .update({ 
          is_available: true,
          total_rides: (ride.drivers.total_rides || 0) + 1,
          total_earnings: (ride.drivers.total_earnings || 0) + driverEarnings,
        })
        .eq('id', ride.driver_id);
    }

    return { success: true };
  } catch (error) {
    console.error('Complete ride error:', error);
    return { success: false, error: 'Network error' };
  }
}

// Cancel ride
export async function cancelRide(
  rideId: string,
  reason: string
): Promise<boolean> {
  try {
    // Get ride to find driver
    const { data: ride } = await supabase
      .from('rides')
      .select('driver_id')
      .eq('id', rideId)
      .single();

    // Update ride status
    const { error } = await supabase
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', rideId);

    if (error) return false;

    // Make driver available again
    if (ride?.driver_id) {
      await supabase
        .from('drivers')
        .update({ is_available: true })
        .eq('id', ride.driver_id);
    }

    return true;
  } catch (error) {
    console.error('Cancel ride error:', error);
    return false;
  }
}

// Get ride history
export async function getRideHistory(
  limit: number = 20,
  offset: number = 0
): Promise<RideHistoryItem[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_ride_history', {
      p_user_id: user.id,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Get ride history error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get ride history error:', error);
    return [];
  }
}

// Rate a completed ride
export async function rateRide(
  rideId: string,
  rating: number,
  review?: string
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data: ride } = await supabase
      .from('rides')
      .select('user_id, driver_id')
      .eq('id', rideId)
      .single();

    if (!ride) return false;

    const isRider = ride.user_id === user.id;

    const { error } = await supabase
      .from('rides')
      .update(isRider ? {
        driver_rating: rating,
        driver_review: review,
      } : {
        rider_rating: rating,
        rider_review: review,
      })
      .eq('id', rideId);

    // Update driver's average rating if rated by rider
    if (!error && isRider) {
      const { data: driverRides } = await supabase
        .from('rides')
        .select('driver_rating')
        .eq('driver_id', ride.driver_id)
        .not('driver_rating', 'is', null);

      if (driverRides && driverRides.length > 0) {
        const avgRating = driverRides.reduce((sum, r) => sum + r.driver_rating, 0) / driverRides.length;
        await supabase
          .from('drivers')
          .update({ rating: Math.round(avgRating * 100) / 100 })
          .eq('id', ride.driver_id);
      }
    }

    return !error;
  } catch (error) {
    console.error('Rate ride error:', error);
    return false;
  }
}
