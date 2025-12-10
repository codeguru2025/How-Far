// Ndeip-Zthin App - Main Entry Point
// Role-based navigation: Commuter vs Driver

import React, { useEffect, useCallback, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// Context Providers
import { MapContextProvider } from './src/context/MapContext';

// Components
import { ErrorBoundary } from './src/components';

// Screens
import {
  SplashScreen as AppSplashScreen,
  SignInScreen,
  SignUpScreen,
  WalletScreen,
  TopUpScreen,
  ProfileScreen,
  HistoryScreen,
  // Driver screens
  DriverHomeScreen,
  CreateTripScreen,
  TripDashboardScreen,
  ScanQRScreen,
  AddVehicleScreen,
  DriverMapScreen,
  // Commuter screens
  CommuterHomeScreen,
  FindRidesScreen,
  TripDetailsScreen,
  ShowQRScreen,
  RiderMapScreen,
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
        // Route based on user role
        if (user.role === 'driver') {
          setCurrentScreen('driver-home');
        } else {
          setCurrentScreen('home'); // Commuter home
        }
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
    <ErrorBoundary 
      onError={(error, errorInfo) => {
        // Log errors for debugging
        console.error('App Error:', error.message);
        console.error('Component Stack:', errorInfo.componentStack);
      }}
    >
      <MapContextProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          {/* Auth Screens */}
          {currentScreen === 'splash' && <AppSplashScreen />}
          {currentScreen === 'signin' && <SignInScreen onNavigate={navigate} />}
          {currentScreen === 'signup' && <SignUpScreen onNavigate={navigate} />}
          
          {/* Commuter Screens */}
          {currentScreen === 'home' && <CommuterHomeScreen onNavigate={navigate} />}
          {currentScreen === 'commuter-home' && <CommuterHomeScreen onNavigate={navigate} />}
          {currentScreen === 'find-rides' && <FindRidesScreen onNavigate={navigate} />}
          {currentScreen === 'trip-details' && <TripDetailsScreen onNavigate={navigate} />}
          {currentScreen === 'show-qr' && <ShowQRScreen onNavigate={navigate} />}
          {currentScreen === 'booking-active' && <ShowQRScreen onNavigate={navigate} />}
          {currentScreen === 'rider-map' && <RiderMapScreen onNavigate={navigate} />}
          
          {/* Driver Screens */}
          {currentScreen === 'driver-home' && <DriverHomeScreen onNavigate={navigate} />}
          {currentScreen === 'create-trip' && <CreateTripScreen onNavigate={navigate} />}
          {currentScreen === 'trip-dashboard' && <TripDashboardScreen onNavigate={navigate} />}
          {currentScreen === 'scan-qr' && <ScanQRScreen onNavigate={navigate} />}
          {currentScreen === 'add-vehicle' && <AddVehicleScreen onNavigate={navigate} />}
          {currentScreen === 'driver-map' && <DriverMapScreen onNavigate={navigate} />}
          
          {/* Shared Screens (both roles) */}
          {currentScreen === 'wallet' && <WalletScreen onNavigate={navigate} />}
          {currentScreen === 'topup' && <TopUpScreen onNavigate={navigate} />}
          {currentScreen === 'profile' && <ProfileScreen onNavigate={navigate} />}
          {currentScreen === 'history' && <HistoryScreen onNavigate={navigate} />}
          
          <StatusBar style="auto" />
        </View>
      </MapContextProvider>
    </ErrorBoundary>
  );
}
