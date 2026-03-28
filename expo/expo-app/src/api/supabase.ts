// Supabase Client - Single Source of Truth
// All other files should import from here, NOT create their own clients

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';

// Validate config at startup
if (__DEV__ && (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY)) {
  console.warn('⚠️ Missing Supabase configuration in .env file');
}

// Single Supabase client instance for the entire app
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Re-export for convenience
export { CONFIG };

