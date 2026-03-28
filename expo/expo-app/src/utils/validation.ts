/**
 * Centralized Input Validation
 * 
 * All user input should be validated before being sent to the API.
 * This provides a consistent validation layer across the app.
 */

import { CONFIG } from '../config';

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string | number;
}

// ============================================
// PHONE NUMBER VALIDATION
// ============================================

/**
 * Validate Zimbabwe phone number
 * Accepts: 0771234567, +263771234567, 263771234567
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check length and format
  const phoneRegex = /^(\+?263|0)?[7][1-9][0-9]{7}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return { 
      isValid: false, 
      error: 'Please enter a valid Zimbabwe phone number (e.g., 0771234567)' 
    };
  }

  // Normalize to +263 format
  let normalized = cleaned;
  if (normalized.startsWith('0')) {
    normalized = '+263' + normalized.substring(1);
  } else if (normalized.startsWith('263')) {
    normalized = '+' + normalized;
  } else if (!normalized.startsWith('+')) {
    normalized = '+263' + normalized;
  }

  return { isValid: true, sanitized: normalized };
}

// ============================================
// PASSWORD VALIDATION
// ============================================

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' };
  }

  if (password.length > 100) {
    return { isValid: false, error: 'Password is too long' };
  }

  // Check for at least one letter and one number (optional but recommended)
  // const hasLetter = /[a-zA-Z]/.test(password);
  // const hasNumber = /[0-9]/.test(password);
  // if (!hasLetter || !hasNumber) {
  //   return { isValid: false, error: 'Password must contain letters and numbers' };
  // }

  return { isValid: true };
}

// ============================================
// AMOUNT VALIDATION
// ============================================

/**
 * Validate monetary amount
 */
export function validateAmount(
  amount: number | string, 
  options: { min?: number; max?: number; fieldName?: string } = {}
): ValidationResult {
  const { min = 0, max = 10000, fieldName = 'Amount' } = options;

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return { isValid: false, error: `${fieldName} must be a number` };
  }

  if (numAmount < min) {
    return { isValid: false, error: `${fieldName} must be at least $${min.toFixed(2)}` };
  }

  if (numAmount > max) {
    return { isValid: false, error: `${fieldName} cannot exceed $${max.toFixed(2)}` };
  }

  // Round to 2 decimal places
  const sanitized = Math.round(numAmount * 100) / 100;

  return { isValid: true, sanitized };
}

/**
 * Validate top-up amount using CONFIG limits
 */
export function validateTopUpAmount(amount: number | string): ValidationResult {
  return validateAmount(amount, {
    min: CONFIG.MIN_TOPUP,
    max: CONFIG.MAX_TOPUP,
    fieldName: 'Top-up amount',
  });
}

// ============================================
// NAME VALIDATION
// ============================================

/**
 * Validate person name (first name, last name)
 */
export function validateName(
  name: string, 
  options: { required?: boolean; fieldName?: string; maxLength?: number } = {}
): ValidationResult {
  const { required = true, fieldName = 'Name', maxLength = 50 } = options;

  if (!name || typeof name !== 'string') {
    if (required) {
      return { isValid: false, error: `${fieldName} is required` };
    }
    return { isValid: true, sanitized: '' };
  }

  const trimmed = name.trim();

  if (required && trimmed.length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} is too long (max ${maxLength} characters)` };
  }

  // Check for invalid characters (allow letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-Z\s\-']*$/;
  if (trimmed.length > 0 && !nameRegex.test(trimmed)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }

  return { isValid: true, sanitized: trimmed };
}

// ============================================
// SEAT COUNT VALIDATION
// ============================================

/**
 * Validate number of seats for booking
 */
export function validateSeats(
  seats: number | string,
  available: number = 10
): ValidationResult {
  const numSeats = typeof seats === 'string' ? parseInt(seats, 10) : seats;

  if (isNaN(numSeats) || !Number.isInteger(numSeats)) {
    return { isValid: false, error: 'Seats must be a whole number' };
  }

  if (numSeats < 1) {
    return { isValid: false, error: 'You must book at least 1 seat' };
  }

  if (numSeats > available) {
    return { isValid: false, error: `Only ${available} seat(s) available` };
  }

  if (numSeats > 20) {
    return { isValid: false, error: 'Cannot book more than 20 seats at once' };
  }

  return { isValid: true, sanitized: numSeats };
}

// ============================================
// COORDINATES VALIDATION
// ============================================

/**
 * Validate GPS coordinates
 */
export function validateCoordinates(
  latitude: number,
  longitude: number
): ValidationResult {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return { isValid: false, error: 'Invalid coordinates' };
  }

  if (latitude < -90 || latitude > 90) {
    return { isValid: false, error: 'Invalid latitude' };
  }

  if (longitude < -180 || longitude > 180) {
    return { isValid: false, error: 'Invalid longitude' };
  }

  // Check for reasonable Zimbabwe bounds (optional - makes testing harder)
  // const inZimbabwe = latitude >= -22.5 && latitude <= -15.5 && 
  //                   longitude >= 25 && longitude <= 33;

  return { isValid: true };
}

// ============================================
// UUID VALIDATION
// ============================================

/**
 * Validate UUID format
 */
export function validateUUID(id: string, fieldName: string = 'ID'): ValidationResult {
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(id)) {
    return { isValid: false, error: `Invalid ${fieldName} format` };
  }

  return { isValid: true, sanitized: id.toLowerCase() };
}

// ============================================
// COMBINED VALIDATORS
// ============================================

/**
 * Validate sign-in form data
 */
export function validateSignInData(data: { phone: string; password: string }): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.isValid) {
    errors.phone = phoneResult.error!;
  }

  const passwordResult = validatePassword(data.password);
  if (!passwordResult.isValid) {
    errors.password = passwordResult.error!;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate sign-up form data
 */
export function validateSignUpData(data: {
  phone: string;
  password: string;
  firstName: string;
  lastName?: string;
}): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.isValid) {
    errors.phone = phoneResult.error!;
  }

  const passwordResult = validatePassword(data.password);
  if (!passwordResult.isValid) {
    errors.password = passwordResult.error!;
  }

  const firstNameResult = validateName(data.firstName, { fieldName: 'First name' });
  if (!firstNameResult.isValid) {
    errors.firstName = firstNameResult.error!;
  }

  if (data.lastName) {
    const lastNameResult = validateName(data.lastName, { required: false, fieldName: 'Last name' });
    if (!lastNameResult.isValid) {
      errors.lastName = lastNameResult.error!;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

