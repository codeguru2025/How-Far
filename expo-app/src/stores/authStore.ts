// Auth Store - Zustand
import { create } from 'zustand';
import { User } from '../types';
import * as usersApi from '../api/users';
import { saveUserSession, clearUserSession, getCurrentUser } from '../utils/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (params: { phone: string; password: string; firstName: string; lastName?: string; role?: 'passenger' | 'driver' }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const savedUser = await getCurrentUser();
      if (savedUser) {
        // Verify user still exists in DB
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
      await saveUserSession(result.user);
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
      await saveUserSession(result.user);
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      return { success: true };
    }
    
    set({ isLoading: false });
    return { success: false, error: result.error || 'Sign up failed' };
  },

  signOut: async () => {
    await clearUserSession();
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (updates) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...updates };
      set({ user: updatedUser });
      saveUserSession(updatedUser);
    }
  },
}));

