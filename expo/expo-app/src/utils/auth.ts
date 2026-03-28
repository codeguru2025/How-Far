// Auth Utilities - Shared authentication helpers
// Single source of truth for user session management
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

export const AUTH_KEY = 'ndeip_user_session';

/**
 * Get current authenticated user from storage
 * Used by API layer when making authenticated requests
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const data = await AsyncStorage.getItem(AUTH_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get current user ID (convenience method)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

/**
 * Save user session to storage
 */
export async function saveUserSession(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('saveUserSession error:', error);
    throw error;
  }
}

/**
 * Clear user session from storage
 */
export async function clearUserSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_KEY);
  } catch (error) {
    console.error('clearUserSession error:', error);
    throw error;
  }
}

