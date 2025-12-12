/**
 * OTP API - Phone verification using Infobip 2FA
 * 
 * Usage:
 * 1. Call sendOTP(phoneNumber) to send verification code
 * 2. User enters the 6-digit code
 * 3. Call verifyOTP(pinId, code) to verify
 * 4. If needed, call resendOTP(pinId) to resend
 */

import { supabase } from './supabase';

// Types
export interface SendOTPResult {
  success: boolean;
  pinId?: string;
  message?: string;
  expiresIn?: number;
  error?: string;
  retryAfter?: number;
}

export interface VerifyOTPResult {
  success: boolean;
  verified?: boolean;
  phoneNumber?: string;
  attemptsRemaining?: number;
  message?: string;
  error?: string;
}

export interface ResendOTPResult {
  success: boolean;
  pinId?: string;
  resendsRemaining?: number;
  expiresIn?: number;
  message?: string;
  error?: string;
}

/**
 * Send OTP to a phone number
 * 
 * @param phoneNumber - Phone number (with or without country code)
 * @param purpose - Purpose of verification (e.g., 'registration', 'login', 'verification')
 * @returns Result with pinId for verification
 */
export async function sendOTP(
  phoneNumber: string,
  purpose: 'registration' | 'login' | 'verification' | 'password_reset' = 'verification'
): Promise<SendOTPResult> {
  try {
    const { data, error } = await supabase.functions.invoke('sendOTP', {
      body: { phoneNumber, purpose },
    });

    if (error) {
      console.error('sendOTP error:', error);
      return { success: false, error: error.message };
    }

    return data as SendOTPResult;
  } catch (error) {
    console.error('sendOTP exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Verify OTP code entered by user
 * 
 * @param pinId - The pinId returned from sendOTP
 * @param pin - The 6-digit code entered by user
 * @returns Result indicating if verification was successful
 */
export async function verifyOTP(pinId: string, pin: string): Promise<VerifyOTPResult> {
  try {
    // Validate PIN format locally first
    if (!/^\d{6}$/.test(pin)) {
      return { success: false, error: 'Please enter a 6-digit code' };
    }

    const { data, error } = await supabase.functions.invoke('verifyOTP', {
      body: { pinId, pin },
    });

    if (error) {
      console.error('verifyOTP error:', error);
      return { success: false, error: error.message };
    }

    return data as VerifyOTPResult;
  } catch (error) {
    console.error('verifyOTP exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Resend OTP to the same phone number
 * 
 * @param pinId - The pinId from the original sendOTP call
 * @returns Result with new pinId
 */
export async function resendOTP(pinId: string): Promise<ResendOTPResult> {
  try {
    const { data, error } = await supabase.functions.invoke('resendOTP', {
      body: { pinId },
    });

    if (error) {
      console.error('resendOTP error:', error);
      return { success: false, error: error.message };
    }

    return data as ResendOTPResult;
  } catch (error) {
    console.error('resendOTP exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Check if a phone number is verified
 * 
 * @param phoneNumber - Phone number to check
 * @returns Whether the phone is verified
 */
export async function isPhoneVerified(phoneNumber: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('phone_verified')
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      console.error('isPhoneVerified error:', error);
      return false;
    }

    return data?.phone_verified === true;
  } catch {
    return false;
  }
}

