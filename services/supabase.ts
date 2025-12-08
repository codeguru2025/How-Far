import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Get these from your Supabase Dashboard > Settings > API
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Custom storage adapter for React Native
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

// Create Supabase client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ==================== AUTH HELPERS ====================

export const supabaseAuth = {
  /**
   * Sign in with phone number (sends OTP)
   */
  signInWithPhone: async (phone: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Verify phone OTP
   */
  verifyOtp: async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign out
   */
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session
   */
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get current user
   */
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// ==================== STORAGE HELPERS ====================

export const supabaseStorage = {
  /**
   * Upload file
   */
  uploadFile: async (
    bucket: string,
    path: string,
    file: Blob | File,
    options?: { contentType?: string; upsert?: boolean }
  ) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: options?.contentType,
        upsert: options?.upsert ?? true,
      });
    if (error) throw error;
    return data;
  },

  /**
   * Get public URL for a file
   */
  getPublicUrl: (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Delete file
   */
  deleteFile: async (bucket: string, paths: string[]) => {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  },
};

// ==================== REALTIME HELPERS ====================

let driverLocationChannel: RealtimeChannel | null = null;

export const supabaseRealtime = {
  /**
   * Subscribe to driver locations (for passengers)
   */
  subscribeToDriverLocations: (
    onUpdate: (payload: {
      driverId: string;
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
    }) => void
  ) => {
    driverLocationChannel = supabase
      .channel('driver-locations')
      .on('broadcast', { event: 'location-update' }, ({ payload }) => {
        onUpdate(payload);
      })
      .subscribe();

    return driverLocationChannel;
  },

  /**
   * Subscribe to specific driver's location
   */
  subscribeToDriver: (
    driverId: string,
    onUpdate: (payload: any) => void
  ) => {
    const channel = supabase
      .channel(`driver-${driverId}`)
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        onUpdate(payload);
      })
      .subscribe();

    return channel;
  },

  /**
   * Broadcast driver location (for drivers)
   */
  broadcastLocation: async (data: {
    driverId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
  }) => {
    const channel = supabase.channel('driver-locations');
    
    await channel.send({
      type: 'broadcast',
      event: 'location-update',
      payload: data,
    });
  },

  /**
   * Subscribe to ride updates
   */
  subscribeToRide: (
    rideId: string,
    onUpdate: (payload: any) => void
  ) => {
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Ride',
          filter: `id=eq.${rideId}`,
        },
        (payload) => {
          onUpdate(payload.new);
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Subscribe to new ride requests (for drivers)
   */
  subscribeToRideRequests: (
    driverId: string,
    onNewRide: (ride: any) => void
  ) => {
    const channel = supabase
      .channel(`driver-rides-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Ride',
          filter: `driverId=eq.${driverId}`,
        },
        (payload) => {
          onNewRide(payload.new);
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll: async () => {
    await supabase.removeAllChannels();
    driverLocationChannel = null;
  },

  /**
   * Unsubscribe from specific channel
   */
  unsubscribe: async (channel: RealtimeChannel) => {
    await supabase.removeChannel(channel);
  },
};

// ==================== DATABASE HELPERS (Direct Queries) ====================

export const supabaseDb = {
  /**
   * Get nearby drivers with their locations
   */
  getNearbyDrivers: async (lat: number, lng: number, radiusKm: number = 5) => {
    // Using PostGIS for location queries (requires extension enabled in Supabase)
    const { data, error } = await supabase.rpc('get_nearby_drivers', {
      user_lat: lat,
      user_lng: lng,
      radius_km: radiusKm,
    });

    if (error) {
      console.error('Error fetching nearby drivers:', error);
      // Fallback to basic query
      const { data: fallbackData } = await supabase
        .from('LiveLocation')
        .select(`
          *,
          driver:Driver(
            id,
            rating,
            user:User(name, profilePic),
            activeVehicle:Vehicle(plateNumber, model, color),
            routes:Route(name, originName, destinationName, baseFare)
          )
        `)
        .eq('driver.status', 'ONLINE');

      return fallbackData;
    }

    return data;
  },

  /**
   * Get active routes
   */
  getActiveRoutes: async () => {
    const { data, error } = await supabase
      .from('Route')
      .select(`
        *,
        driver:Driver(
          id,
          rating,
          status,
          user:User(name, profilePic),
          activeVehicle:Vehicle(plateNumber, model, color),
          liveLocation:LiveLocation(lat, lng, heading, speed)
        )
      `)
      .eq('isActive', true)
      .eq('driver.status', 'ONLINE');

    if (error) throw error;
    return data;
  },
};

export default supabase;
