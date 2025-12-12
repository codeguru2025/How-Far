// Booking Helpers - Consistent access to booking fields
// Handles both old and new database column naming conventions

import { Booking, User } from '../types';
import { CONFIG } from '../config';

/**
 * Get the rider/commuter ID from a booking (handles both column names)
 */
export function getRiderId(booking: Booking): string | undefined {
  return booking.rider_id || booking.commuter_id;
}

/**
 * Get the number of seats from a booking (handles both column names)
 */
export function getSeats(booking: Booking): number {
  return booking.seats ?? booking.seats_booked ?? 1;
}

/**
 * Get the fare/total amount from a booking (handles both column names)
 */
export function getFare(booking: Booking): number {
  return booking.fare ?? booking.total_amount ?? booking.base_amount ?? 0;
}

/**
 * Get the rider/commuter user object from a booking
 */
export function getRider(booking: Booking): User | undefined {
  return booking.commuter || booking.rider;
}

/**
 * Get the rider's display name
 */
export function getRiderName(booking: Booking): string {
  const rider = getRider(booking);
  if (rider) {
    return `${rider.first_name || ''} ${rider.last_name || ''}`.trim() || 'Rider';
  }
  return 'Rider';
}

/**
 * Calculate the rider service fee (uses CONFIG.FEES.RIDER_FEE_PERCENT)
 */
export function calculateRiderFee(fare: number): number {
  return Math.round(fare * CONFIG.FEES.RIDER_FEE_PERCENT * 100) / 100;
}

/**
 * Calculate the driver platform fee (uses CONFIG.FEES.DRIVER_FEE_PERCENT)
 */
export function calculateDriverFee(fare: number): number {
  return Math.round(fare * CONFIG.FEES.DRIVER_FEE_PERCENT * 100) / 100;
}

/**
 * Calculate driver's earnings after platform fee
 */
export function calculateDriverEarnings(fare: number): number {
  return Math.round(fare * (1 - CONFIG.FEES.DRIVER_FEE_PERCENT) * 100) / 100;
}

/**
 * Calculate total rider pays (fare + rider fee)
 */
export function calculateTotalRiderPays(fare: number): number {
  return Math.round(fare * (1 + CONFIG.FEES.RIDER_FEE_PERCENT) * 100) / 100;
}

/**
 * Format booking status for display
 */
export function formatBookingStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '⏳ Pending',
    confirmed: '✅ Confirmed',
    picked_up: '🚗 Picked Up',
    completed: '✅ Completed',
    cancelled: '❌ Cancelled',
    no_show: '🚫 No Show',
  };
  return statusMap[status] || status;
}

/**
 * Format payment status for display
 */
export function formatPaymentStatus(status?: string): string {
  const statusMap: Record<string, string> = {
    pending: '💳 Pending',
    paid: '✅ Paid',
    refunded: '↩️ Refunded',
    failed: '❌ Failed',
  };
  return statusMap[status || 'pending'] || status || 'Pending';
}

/**
 * Check if booking can be cancelled
 */
export function canCancelBooking(booking: Booking): boolean {
  return ['pending', 'confirmed'].includes(booking.status);
}

/**
 * Check if booking is awaiting payment
 */
export function isAwaitingPayment(booking: Booking): boolean {
  return booking.status === 'confirmed' && 
         (booking.payment_status === 'pending' || !booking.payment_status);
}



