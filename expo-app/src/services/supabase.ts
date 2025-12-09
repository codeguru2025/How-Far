import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get Supabase config from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://egffmatoyzinnxpinzcv.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Config validation
if (!supabaseUrl || !supabaseAnonKey) {
  if (__DEV__) console.warn('⚠️ Missing Supabase configuration');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type User = {
  id: string;
  phone: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  role: 'passenger' | 'driver' | 'admin';
  status: string;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  pending_balance: number;
};
