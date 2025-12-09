// Auth Store - Zustand
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import * as usersApi from '../api/users';

const AUTH_KEY = 'ndeip_user_session';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (params: { phone: string; password: string; firstName: string; lastName?: string }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const data = await AsyncStorage.getItem(AUTH_KEY);
      if (data) {
        const savedUser = JSON.parse(data);
        // Verify user still exists
        const freshUser = await usersApi.getUserById(savedUser.id);
        if (freshUser) {
          set({ user: freshUser, isAuthenticated: true, isLoading: false });
          return;
        }
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (e) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  signIn: async (phone, password) => {
    set({ isLoading: true });
    const result = await usersApi.signIn(phone, password);
    
    if (result.user) {
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(result.user));
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      return { success: true };
    }
    
    set({ isLoading: false });
    return { success: false, error: result.error || 'Sign in failed' };
  },

  signUp: async (params) => {
    set({ isLoading: true });
    const result = await usersApi.signUp(params);
    
    if (result.user) {
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(result.user));
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      return { success: true };
    }
    
    set({ isLoading: false });
    return { success: false, error: result.error || 'Sign up failed' };
  },

  signOut: async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (updates) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...updates };
      set({ user: updatedUser });
      AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updatedUser));
    }
  },
}));

