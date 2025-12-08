import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { User, Subscription, Ride } from '@/types';

const STORAGE_KEYS = {
  USER: '@ridepass_user',
  SUBSCRIPTION: '@ridepass_subscription',
  RIDES: '@ridepass_rides',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, subscriptionData, ridesData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION),
        AsyncStorage.getItem(STORAGE_KEYS.RIDES),
      ]);

      if (userData) setUser(JSON.parse(userData));
      if (subscriptionData) setSubscription(JSON.parse(subscriptionData));
      if (ridesData) setRides(JSON.parse(ridesData));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (userData: User) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const saveSubscription = async (subscriptionData: Subscription) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(subscriptionData));
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Error saving subscription:', error);
    }
  };

  const addRide = async (ride: Ride) => {
    try {
      const updatedRides = [ride, ...rides];
      await AsyncStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(updatedRides));
      setRides(updatedRides);

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
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER,
        STORAGE_KEYS.SUBSCRIPTION,
        STORAGE_KEYS.RIDES,
      ]);
      setUser(null);
      setSubscription(null);
      setRides([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return {
    user,
    subscription,
    rides,
    isLoading,
    saveUser,
    saveSubscription,
    addRide,
    logout,
  };
});
