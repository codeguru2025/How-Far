// App Configuration

export const CONFIG = {
  // Supabase
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  
  // PayNow
  PAYNOW_ID: process.env.EXPO_PUBLIC_PAYNOW_ID || '',
  PAYNOW_KEY: process.env.EXPO_PUBLIC_PAYNOW_KEY || '',
  
  // Maps & Location
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '',
  MAPBOX_SECRET_TOKEN: process.env.MAPBOX_SECRET_TOKEN || '',
  
  // App
  APP_NAME: 'Ndeip-Zthin',
  CURRENCY: 'USD',
  MIN_TOPUP: 1,
  MAX_TOPUP: 1000,
  
  // Default location (Harare, Zimbabwe)
  DEFAULT_LOCATION: {
    latitude: -17.8292,
    longitude: 31.0522,
  },
};

// Validate config
export function isConfigValid(): boolean {
  return !!(
    CONFIG.SUPABASE_URL &&
    CONFIG.SUPABASE_ANON_KEY &&
    CONFIG.PAYNOW_ID &&
    CONFIG.PAYNOW_KEY
  );
}

if (!isConfigValid() && __DEV__) {
  console.warn('⚠️ Missing configuration. Check .env file.');
}

