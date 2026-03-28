// How Far App - Main Entry Point
// Role-based navigation: Commuter vs Driver

import React, { useEffect, useCallback, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// Context Providers
import { MapContextProvider } from './src/context/MapContext';
import { LanguageProvider } from './src/context/LanguageContext';

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
  EditProfileScreen,
  NotificationsScreen,
  SafetyScreen,
  PaymentMethodsScreen,
  HelpScreen,
  HistoryScreen,
  // Driver screens
  DriverHomeScreen,
  CreateTripScreen,
  TripDashboardScreen,
  ScanQRScreen,
  AddVehicleScreen,
  DriverMapScreen,
  TripActiveScreen,
  WithdrawScreen,
  // Commuter screens
  CommuterHomeScreen,
  FindRidesScreen,
  TripDetailsScreen,
  ShowQRScreen,
  RiderMapScreen,
  // Chat screens
  ChatScreen,
  ConversationsScreen,
} from './src/screens';
import { LanguageSettingsScreen } from './src/screens/settings';

// Stores
import { useAuthStore } from './src/stores';

// Types
import { Screen } from './src/types';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Navigation params type
interface NavParams {
  conversationId?: string;
  otherUserName?: string;
  isDriver?: boolean;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [navParams, setNavParams] = useState<NavParams>({});
  const { user, isLoading, isAuthenticated, initialize } = useAuthStore();
  const [initTimeout, setInitTimeout] = useState(false);

  useEffect(() => {
    // Initialize auth
    initialize();
    
    // Timeout fallback - if loading takes more than 5 seconds, show sign in
    const timeout = setTimeout(() => {
      setInitTimeout(true);
    }, 5000);
    
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // If loading finished or timeout reached
    if (!isLoading || initTimeout) {
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
  }, [isLoading, isAuthenticated, user, initTimeout]);

  const onLayoutRootView = useCallback(async () => {
    if (!isLoading || initTimeout) {
      await SplashScreen.hideAsync();
    }
  }, [isLoading, initTimeout]);

  function navigate(screen: Screen, params?: NavParams) {
    setNavParams(params || {});
    setCurrentScreen(screen);
  }

  // Show splash while loading (with 5 second max)
  if (isLoading && !initTimeout) {
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
      <LanguageProvider>
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
            {currentScreen === 'search' && <FindRidesScreen onNavigate={navigate} />}
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
            {currentScreen === 'trip-active' && <TripActiveScreen onNavigate={navigate} />}
            {currentScreen === 'withdraw' && <WithdrawScreen onNavigate={navigate} />}
            
            {/* Settings Screens */}
            {currentScreen === 'language-settings' && <LanguageSettingsScreen onNavigate={navigate} />}
            {currentScreen === 'settings' && <LanguageSettingsScreen onNavigate={navigate} />}
            
            {/* Chat Screens */}
            {currentScreen === 'conversations' && <ConversationsScreen onNavigate={navigate} />}
            {currentScreen === 'chat' && (
              <ChatScreen
                onNavigate={navigate}
                conversationId={navParams.conversationId || ''}
                otherUserName={navParams.otherUserName || 'User'}
                isDriver={navParams.isDriver || false}
              />
            )}
            
            {/* Shared Screens (both roles) */}
            {currentScreen === 'wallet' && <WalletScreen onNavigate={navigate} />}
            {currentScreen === 'topup' && <TopUpScreen onNavigate={navigate} />}
            {currentScreen === 'profile' && <ProfileScreen onNavigate={navigate} />}
            {currentScreen === 'edit-profile' && <EditProfileScreen onNavigate={navigate} />}
            {currentScreen === 'notifications' && <NotificationsScreen onNavigate={navigate} />}
            {currentScreen === 'safety' && <SafetyScreen onNavigate={navigate} />}
            {currentScreen === 'payment-methods' && <PaymentMethodsScreen onNavigate={navigate} />}
            {currentScreen === 'help' && <HelpScreen onNavigate={navigate} />}
            {currentScreen === 'history' && <HistoryScreen onNavigate={navigate} />}
            
            <StatusBar style="auto" />
          </View>
        </MapContextProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
