// Ndeip-Zthin App - Main Entry Point
// This file is now minimal - all logic is in src/

import React, { useEffect, useCallback, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// Screens
import {
  SplashScreen as AppSplashScreen,
  SignInScreen,
  SignUpScreen,
  HomeScreen,
  WalletScreen,
  TopUpScreen,
  ProfileScreen,
} from './src/screens';

// Stores
import { useAuthStore } from './src/stores';

// Types
import { Screen } from './src/types';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const { user, isLoading, isAuthenticated, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        setCurrentScreen('home');
      } else {
        setCurrentScreen('signin');
      }
    }
  }, [isLoading, isAuthenticated, user]);

  const onLayoutRootView = useCallback(async () => {
    if (!isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [isLoading]);

  function navigate(screen: Screen) {
    setCurrentScreen(screen);
  }

  if (isLoading) {
    return <AppSplashScreen />;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      {currentScreen === 'splash' && <AppSplashScreen />}
      {currentScreen === 'signin' && <SignInScreen onNavigate={navigate} />}
      {currentScreen === 'signup' && <SignUpScreen onNavigate={navigate} />}
      {currentScreen === 'home' && <HomeScreen onNavigate={navigate} />}
      {currentScreen === 'wallet' && <WalletScreen onNavigate={navigate} />}
      {currentScreen === 'topup' && <TopUpScreen onNavigate={navigate} />}
      {currentScreen === 'profile' && <ProfileScreen onNavigate={navigate} />}
      <StatusBar style="auto" />
    </View>
  );
}
