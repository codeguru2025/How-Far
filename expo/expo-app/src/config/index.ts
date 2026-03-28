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
  
  // Map Provider: 'google' or 'mapbox'
  MAP_PROVIDER: (process.env.EXPO_PUBLIC_MAP_PROVIDER || 'google') as 'google' | 'mapbox',
  
  // App
  APP_NAME: 'How Far',
  CURRENCY: 'USD',
  MIN_TOPUP: 1,
  MAX_TOPUP: 1000,
  
  // Fee Structure (centralized for easy updates)
  FEES: {
    RIDER_FEE_PERCENT: 0.025, // 2.5% - charged to rider on top of fare
    DRIVER_FEE_PERCENT: 0.075, // 7.5% - platform fee deducted from driver
    MIN_FARE: 0.50, // Minimum fare amount
    CUSTOM_PICKUP_FEE: 1, // Extra fee for custom pickup
    CUSTOM_DROPOFF_FEE: 1, // Extra fee for custom dropoff
  },
  
  // Cache TTL (milliseconds)
  CACHE: {
    WALLET_TTL: 10000, // 10 seconds
    TRIP_TTL: 15000, // 15 seconds
    CONVERSATION_TTL: 60000, // 1 minute
    MESSAGES_TTL: 10000, // 10 seconds
  },
  
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

