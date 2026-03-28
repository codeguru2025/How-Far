// Utils - Consolidated exports
// All utility functions should be exported from here

// Auth Utilities
export {
  AUTH_KEY,
  getCurrentUser,
  isAuthenticated,
  getCurrentUserId,
  saveUserSession,
  clearUserSession,
} from './auth';

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

// Location Utilities
export {
  getCurrentLocation,
  reverseGeocode,
  calculateDistance,
  optimizePickupRoute,
  getOptimizedDirections,
} from './location';
export type { LocationResult, PickupPoint, OptimizedRoute } from './location';

// Input Validation
export {
  validatePhone,
  validatePassword,
  validateAmount,
  validateTopUpAmount,
  validateName,
  validateSeats,
  validateCoordinates,
  validateUUID,
  validateSignInData,
  validateSignUpData,
} from './validation';
export type { ValidationResult } from './validation';

