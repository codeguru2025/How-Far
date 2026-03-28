// Map Context - Manage map style preferences
// Note: Mapbox requires a development build, so only Google Maps is available in Expo Go
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MapStyle = 'standard' | 'satellite' | 'hybrid' | 'terrain';

interface MapContextType {
  style: MapStyle;
  setStyle: (style: MapStyle) => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

const STORAGE_KEY = '@map_style';

export function MapContextProvider({ children }: { children: React.ReactNode }) {
  const [style, setStyleState] = useState<MapStyle>('standard');

  // Load saved preference on mount
  useEffect(() => {
    loadPreference();
  }, []);

  async function loadPreference() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && ['standard', 'satellite', 'hybrid', 'terrain'].includes(stored)) {
        setStyleState(stored as MapStyle);
      }
    } catch (error) {
      console.log('Error loading map preference:', error);
    }
  }

  async function setStyle(newStyle: MapStyle) {
    setStyleState(newStyle);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newStyle);
    } catch (error) {
      console.log('Error saving map preference:', error);
    }
  }

  return (
    <MapContext.Provider value={{ style, setStyle }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within MapContextProvider');
  }
  return context;
}
