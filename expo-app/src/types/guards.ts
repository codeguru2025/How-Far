// Type Guards - Runtime type checking utilities
import { User, Trip, Booking, Location, Wallet } from './index';

/**
 * Check if a value is a valid User object
 */
export function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.phone_number === 'string' &&
    (obj.role === 'passenger' || obj.role === 'driver')
  );
}

/**
 * Check if a value is a valid Location object
 */
export function isLocation(value: unknown): value is Location {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.latitude === 'number' &&
    typeof obj.longitude === 'number' &&
    !isNaN(obj.latitude) &&
    !isNaN(obj.longitude)
  );
}

/**
 * Check if a value is a valid Trip object
 */
export function isTrip(value: unknown): value is Trip {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.origin !== undefined &&
    obj.destination !== undefined
  );
}

/**
 * Check if a value is a valid Booking object
 */
export function isBooking(value: unknown): value is Booking {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.trip_id === 'string' &&
    typeof obj.status === 'string'
  );
}

/**
 * Check if a value is a valid Wallet object
 */
export function isWallet(value: unknown): value is Wallet {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.balance === 'number';
}

/**
 * Check if object has required property
 */
export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

/**
 * Safely parse JSON with type guard
 */
export function safeJsonParse<T>(
  json: string,
  guard: (value: unknown) => value is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Assert non-null value
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string = 'Value is null or undefined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

