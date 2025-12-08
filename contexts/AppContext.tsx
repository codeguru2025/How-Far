import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import { User, Subscription, Ride, Driver, Wallet, Notification, UserRole } from '@/types';

const STORAGE_KEYS = {
  USER: '@ridepass_user',
  TOKEN: '@ridepass_token',
  REFRESH_TOKEN: '@ridepass_refresh_token',
  SUBSCRIPTION: '@ridepass_subscription',
  RIDES: '@ridepass_rides',
  WALLET: '@ridepass_wallet',
  DRIVER: '@ridepass_driver',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, tokenData, subscriptionData, ridesData, walletData, driverData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION),
        AsyncStorage.getItem(STORAGE_KEYS.RIDES),
        AsyncStorage.getItem(STORAGE_KEYS.WALLET),
        AsyncStorage.getItem(STORAGE_KEYS.DRIVER),
      ]);

      if (userData) setUser(JSON.parse(userData));
      if (subscriptionData) setSubscription(JSON.parse(subscriptionData));
      if (ridesData) setRides(JSON.parse(ridesData));
      if (walletData) setWallet(JSON.parse(walletData));
      if (driverData) setDriver(JSON.parse(driverData));
      if (tokenData) setIsAuthenticated(true);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // User methods
  const saveUser = useCallback(async (userData: User) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error saving user:', error);
    }
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    await saveUser(updatedUser);
  }, [user, saveUser]);

  // Token methods
  const saveTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, accessToken),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
      ]);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }, []);

  // Driver methods
  const saveDriver = useCallback(async (driverData: Driver) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DRIVER, JSON.stringify(driverData));
      setDriver(driverData);
    } catch (error) {
      console.error('Error saving driver:', error);
    }
  }, []);

  const updateDriverStatus = useCallback(async (status: Driver['status']) => {
    if (!driver) return;
    const updatedDriver = { ...driver, status };
    await saveDriver(updatedDriver);
  }, [driver, saveDriver]);

  // Wallet methods
  const saveWallet = useCallback(async (walletData: Wallet) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(walletData));
      setWallet(walletData);
    } catch (error) {
      console.error('Error saving wallet:', error);
    }
  }, []);

  const updateWalletBalance = useCallback(async (balance: number) => {
    if (!wallet) return;
    const updatedWallet = { ...wallet, balance };
    await saveWallet(updatedWallet);
  }, [wallet, saveWallet]);

  // Subscription methods (legacy support)
  const saveSubscription = useCallback(async (subscriptionData: Subscription) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(subscriptionData));
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Error saving subscription:', error);
    }
  }, []);

  // Ride methods
  const addRide = useCallback(async (ride: Ride) => {
    try {
      const updatedRides = [ride, ...rides];
      await AsyncStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(updatedRides));
      setRides(updatedRides);

      // Update subscription rides remaining (legacy)
      if (subscription) {
        const updatedSubscription = {
          ...subscription,
          ridesRemaining: Math.max(0, subscription.ridesRemaining - 1),
        };
        await saveSubscription(updatedSubscription);
      }
    } catch (error) {
      console.error('Error adding ride:', error);
    }
  }, [rides, subscription, saveSubscription]);

  const updateRide = useCallback(async (rideId: string, updates: Partial<Ride>) => {
    try {
      const updatedRides = rides.map(ride => 
        ride.id === rideId ? { ...ride, ...updates } : ride
      );
      await AsyncStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(updatedRides));
      setRides(updatedRides);
    } catch (error) {
      console.error('Error updating ride:', error);
    }
  }, [rides]);

  // Notification methods
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.isRead) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER,
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.SUBSCRIPTION,
        STORAGE_KEYS.RIDES,
        STORAGE_KEYS.WALLET,
        STORAGE_KEYS.DRIVER,
      ]);
      setUser(null);
      setDriver(null);
      setWallet(null);
      setSubscription(null);
      setRides([]);
      setNotifications([]);
      setUnreadCount(0);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  // Check if user is driver
  const isDriver = user?.role === 'DRIVER' || user?.role === 'operator';
  const isPassenger = user?.role === 'PASSENGER' || user?.role === 'commuter';
  const isAdmin = user?.role === 'ADMIN';

  return {
    // State
    user,
    driver,
    wallet,
    subscription,
    rides,
    notifications,
    unreadCount,
    isLoading,
    isAuthenticated,
    isDriver,
    isPassenger,
    isAdmin,

    // User methods
    saveUser,
    updateUser,
    saveTokens,
    logout,

    // Driver methods
    saveDriver,
    updateDriverStatus,

    // Wallet methods
    saveWallet,
    updateWalletBalance,

    // Subscription methods (legacy)
    saveSubscription,

    // Ride methods
    addRide,
    updateRide,

    // Notification methods
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
  };
});
