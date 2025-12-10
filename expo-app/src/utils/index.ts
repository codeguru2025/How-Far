// Utils - Consolidated exports
// All utility functions should be exported from here

// API Caching & Performance
export { apiCache, debounce, throttle } from './apiCache';

// Booking Helpers
export {
  getRiderId,
  getSeats,
  getFare,
  getRider,
  getRiderName,
  calculateRiderFee,
  calculateDriverFee,
  calculateDriverEarnings,
  calculateTotalRiderPays,
  formatBookingStatus,
  formatPaymentStatus,
  canCancelBooking,
  isAwaitingPayment,
} from './bookingHelpers';

// Booking Cleanup
export {
  checkAndCleanStaleBookings,
  getActiveBookingWithValidation,
  cleanupCompletedTripBookings,
  restoreSeatsOnCancellation,
} from './bookingCleanup';
export type { CleanupResult } from './bookingCleanup';

// Phone Number Utilities
export { normalizePhone, formatPhoneForPayNow, formatPhoneDisplay } from './phone';

// Theme Utilities (if any)
export * from './theme';

// Health Check
export {
  runHealthCheck,
  quickHealthCheck,
  formatHealthReport,
  checkSupabase,
  checkGoogleMaps,
  checkLocationPermissions,
  checkPayNow,
} from './healthCheck';
export type { HealthCheckResult, HealthReport } from './healthCheck';

