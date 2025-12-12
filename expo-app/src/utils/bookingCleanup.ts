// Booking Cleanup Utility
// Handles stale bookings from inactive trips

import { supabase } from '../api/supabase';

export interface CleanupResult {
  success: boolean;
  cleanedCount: number;
  error?: string;
}

// Check if a rider has stale bookings (bookings for trips that are no longer active)
export async function checkAndCleanStaleBookings(userId: string): Promise<CleanupResult> {
  try {
    // Find all pending/confirmed bookings for this user
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, trip_id, status, created_at')
      .eq('commuter_id', userId)
      .in('status', ['pending', 'confirmed']);

    if (bookingsError || !bookings || bookings.length === 0) {
      return { success: true, cleanedCount: 0 };
    }

    let cleanedCount = 0;

    for (const booking of bookings) {
      // Check if the trip is still active
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('id, status')
        .eq('id', booking.trip_id)
        .single();

      // If trip doesn't exist or is completed/cancelled, mark booking as stale
      if (tripError || !trip || ['completed', 'cancelled'].includes(trip.status)) {
        await supabase
          .from('bookings')
          .update({ 
            status: 'cancelled',
            // cancellation_reason: 'Trip no longer active' 
          })
          .eq('id', booking.id);
        
        cleanedCount++;
        console.log(`Cleaned stale booking ${booking.id} - trip ${booking.trip_id} is ${trip?.status || 'missing'}`);
      }

      // Check if booking is older than 24 hours and still pending
      if (booking.status === 'pending') {
        const bookingAge = Date.now() - new Date(booking.created_at).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (bookingAge > twentyFourHours) {
          await supabase
            .from('bookings')
            .update({ 
              status: 'cancelled',
              // cancellation_reason: 'Expired - not confirmed within 24 hours' 
            })
            .eq('id', booking.id);
          
          cleanedCount++;
          console.log(`Cleaned expired pending booking ${booking.id}`);
        }
      }
    }

    return { success: true, cleanedCount };
  } catch (error) {
    console.error('Booking cleanup error:', error);
    return { success: false, cleanedCount: 0, error: 'Failed to clean bookings' };
  }
}

// Get active booking, excluding stale ones
export async function getActiveBookingWithValidation(userId: string): Promise<any | null> {
  try {
    // First clean any stale bookings
    await checkAndCleanStaleBookings(userId);

    // Then get the active booking
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('commuter_id', userId)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    // Verify the trip is still active
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, status, origin, destination')
      .eq('id', data.trip_id)
      .single();

    if (tripError || !trip || ['completed', 'cancelled'].includes(trip.status)) {
      // Trip is no longer active, cancel this booking
      await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', data.id);
      
      return null;
    }

    // Return booking with trip data
    return { ...data, trip };
  } catch (error) {
    console.error('Get active booking error:', error);
    return null;
  }
}

// Clean up completed trip bookings (driver-side)
export async function cleanupCompletedTripBookings(tripId: string): Promise<CleanupResult> {
  try {
    // Get all bookings for this trip that weren't completed
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, status, payment_status')
      .eq('trip_id', tripId)
      .in('status', ['pending', 'confirmed']);

    if (!bookings || bookings.length === 0) {
      return { success: true, cleanedCount: 0 };
    }

    let cleanedCount = 0;

    for (const booking of bookings) {
      // If payment wasn't completed, mark as no-show
      if (booking.payment_status !== 'paid') {
        await supabase
          .from('bookings')
          .update({ status: 'no_show' })
          .eq('id', booking.id);
        
        cleanedCount++;
      }
    }

    return { success: true, cleanedCount };
  } catch (error) {
    console.error('Trip cleanup error:', error);
    return { success: false, cleanedCount: 0, error: 'Failed to cleanup trip bookings' };
  }
}

// Restore seats when booking is cancelled
export async function restoreSeatsOnCancellation(
  tripId: string, 
  seatsToRestore: number
): Promise<boolean> {
  try {
    // Get current trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('seats_available, seats_total')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) return false;

    const newAvailable = Math.min(
      (trip.seats_available || 0) + seatsToRestore,
      trip.seats_total || 4
    );

    const { error } = await supabase
      .from('trips')
      .update({ seats_available: newAvailable })
      .eq('id', tripId);

    return !error;
  } catch {
    return false;
  }
}



