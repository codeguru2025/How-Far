// Announcement Service - Text-to-Speech for trip announcements
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, t, Translations } from '../i18n';
import { calculateDistance } from '../utils/location';

const ANNOUNCEMENT_SETTINGS_KEY = 'ndeip_announcement_settings';

// Announcement settings
export interface AnnouncementSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  rate: number; // Speech rate 0.5 to 2.0
  pitch: number; // Pitch 0.5 to 2.0
  language: Language;
}

const defaultSettings: AnnouncementSettings = {
  enabled: true,
  volume: 1.0,
  rate: 0.9, // Slightly slower for clarity
  pitch: 1.0,
  language: 'en',
};

// Voice language codes for TTS
const voiceLanguageCodes: Record<Language, string> = {
  en: 'en-ZA', // South African English (closest to Zimbabwe English)
  sn: 'en-ZA', // Shona not natively supported, use English
  nd: 'en-ZA', // Ndebele not natively supported, use English
};

// Passenger info for announcements
export interface PassengerInfo {
  id: string;
  name: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string;
  seats: number;
  hasBeenAnnounced?: boolean;
  hasArrived?: boolean;
}

// Trip info for announcements
export interface TripAnnouncementInfo {
  id: string;
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  passengers: PassengerInfo[];
  hasStarted: boolean;
  hasAnnouncedAllAboard: boolean;
}

class AnnouncementService {
  private settings: AnnouncementSettings = defaultSettings;
  private isSpeaking: boolean = false;
  private announcementQueue: string[] = [];
  private tripInfo: TripAnnouncementInfo | null = null;
  
  // Distance thresholds in meters
  private readonly APPROACHING_DISTANCE = 500; // 500m - announce "approaching"
  private readonly ARRIVED_DISTANCE = 100; // 100m - announce "arrived"
  
  constructor() {
    this.loadSettings();
  }

  // Load settings from storage
  async loadSettings(): Promise<AnnouncementSettings> {
    try {
      const saved = await AsyncStorage.getItem(ANNOUNCEMENT_SETTINGS_KEY);
      if (saved) {
        this.settings = { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Load announcement settings error:', error);
    }
    return this.settings;
  }

  // Save settings
  async saveSettings(settings: Partial<AnnouncementSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...settings };
      await AsyncStorage.setItem(ANNOUNCEMENT_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Save announcement settings error:', error);
    }
  }

  // Get current settings
  getSettings(): AnnouncementSettings {
    return this.settings;
  }

  // Set language
  async setLanguage(language: Language): Promise<void> {
    await this.saveSettings({ language });
  }

  // Initialize trip for announcements
  initTrip(tripInfo: TripAnnouncementInfo): void {
    this.tripInfo = {
      ...tripInfo,
      hasStarted: false,
      hasAnnouncedAllAboard: false,
      passengers: tripInfo.passengers.map(p => ({
        ...p,
        hasBeenAnnounced: false,
        hasArrived: false,
      })),
    };
    console.log('[Announcements] Trip initialized:', tripInfo.id);
  }

  // Clear trip
  clearTrip(): void {
    this.tripInfo = null;
    this.announcementQueue = [];
    Speech.stop();
  }

  // Speak text
  async speak(text: string, priority: boolean = false): Promise<void> {
    if (!this.settings.enabled) return;

    if (priority) {
      // Stop current speech and speak immediately
      await Speech.stop();
      this.announcementQueue = [text, ...this.announcementQueue];
    } else {
      this.announcementQueue.push(text);
    }

    this.processQueue();
  }

  // Process announcement queue
  private async processQueue(): Promise<void> {
    if (this.isSpeaking || this.announcementQueue.length === 0) return;

    this.isSpeaking = true;
    const text = this.announcementQueue.shift()!;

    try {
      await Speech.speak(text, {
        language: voiceLanguageCodes[this.settings.language],
        rate: this.settings.rate,
        pitch: this.settings.pitch,
        volume: this.settings.volume,
        onDone: () => {
          this.isSpeaking = false;
          // Small delay between announcements
          setTimeout(() => this.processQueue(), 500);
        },
        onError: (error) => {
          console.error('[Announcements] Speech error:', error);
          this.isSpeaking = false;
          this.processQueue();
        },
      });
    } catch (error) {
      console.error('[Announcements] Speak error:', error);
      this.isSpeaking = false;
      this.processQueue();
    }
  }

  // Announce all passengers aboard
  announceAllAboard(passengerCount: number): void {
    if (this.tripInfo?.hasAnnouncedAllAboard) return;
    
    const lang = this.settings.language;
    const message = t(lang, 'announcement_all_aboard');
    const welcome = t(lang, 'announcement_trip_starting');
    
    this.speak(message, true);
    setTimeout(() => this.speak(welcome), 2000);
    
    if (this.tripInfo) {
      this.tripInfo.hasAnnouncedAllAboard = true;
      this.tripInfo.hasStarted = true;
    }
  }

  // Check and announce based on driver location
  checkLocationForAnnouncements(
    driverLatitude: number,
    driverLongitude: number
  ): void {
    if (!this.tripInfo || !this.tripInfo.hasStarted) return;

    const lang = this.settings.language;

    // Check each passenger's dropoff
    for (const passenger of this.tripInfo.passengers) {
      if (passenger.hasArrived) continue;

      const distance = calculateDistance(
        driverLatitude,
        driverLongitude,
        passenger.dropoffLatitude,
        passenger.dropoffLongitude
      ) * 1000; // Convert to meters

      // Arrived at dropoff
      if (distance <= this.ARRIVED_DISTANCE && !passenger.hasArrived) {
        const message = t(lang, 'announcement_arrived_dropoff', {
          name: passenger.name,
          location: this.getShortAddress(passenger.dropoffAddress),
        });
        this.speak(message, true);
        passenger.hasArrived = true;
        passenger.hasBeenAnnounced = true;
        continue;
      }

      // Approaching dropoff
      if (distance <= this.APPROACHING_DISTANCE && !passenger.hasBeenAnnounced) {
        const message = t(lang, 'announcement_approaching_dropoff', {
          name: passenger.name,
          location: this.getShortAddress(passenger.dropoffAddress),
        });
        this.speak(message, false);
        passenger.hasBeenAnnounced = true;
      }
    }

    // Check final destination
    const destDistance = calculateDistance(
      driverLatitude,
      driverLongitude,
      this.tripInfo.destination.latitude,
      this.tripInfo.destination.longitude
    ) * 1000;

    // Check if all passengers have arrived
    const allPassengersArrived = this.tripInfo.passengers.every(p => p.hasArrived);
    
    if (destDistance <= this.ARRIVED_DISTANCE && allPassengersArrived) {
      const message = t(lang, 'announcement_final_destination', {
        location: this.getShortAddress(this.tripInfo.destination.address),
      });
      this.speak(message, true);
      setTimeout(() => {
        this.speak(t(lang, 'announcement_thank_you'));
      }, 3000);
    }
  }

  // Announce next stop manually
  announceNextStop(passengerName: string, location: string): void {
    const lang = this.settings.language;
    const message = t(lang, 'announcement_next_stop', { location });
    const prepare = t(lang, 'announcement_please_prepare');
    
    this.speak(`${passengerName}. ${message}`, false);
    setTimeout(() => this.speak(prepare), 2000);
  }

  // Get short address (first part only)
  private getShortAddress(fullAddress: string): string {
    if (!fullAddress) return 'destination';
    const parts = fullAddress.split(',');
    return parts[0].trim();
  }

  // Test announcement
  async testAnnouncement(): Promise<void> {
    const lang = this.settings.language;
    const testMessage = t(lang, 'announcement_trip_starting');
    await this.speak(testMessage, true);
  }

  // Check if TTS is available
  async isAvailable(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch {
      return false;
    }
  }

  // Get available voices
  async getVoices(): Promise<Speech.Voice[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch {
      return [];
    }
  }

  // Stop all announcements
  stop(): void {
    Speech.stop();
    this.announcementQueue = [];
    this.isSpeaking = false;
  }
}

// Singleton instance
export const announcementService = new AnnouncementService();

// React hook for announcements
import { useEffect, useState, useCallback } from 'react';

export function useAnnouncements() {
  const [settings, setSettings] = useState<AnnouncementSettings>(announcementService.getSettings());
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    async function init() {
      const loaded = await announcementService.loadSettings();
      setSettings(loaded);
      const available = await announcementService.isAvailable();
      setIsAvailable(available);
    }
    init();
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AnnouncementSettings>) => {
    await announcementService.saveSettings(newSettings);
    setSettings(announcementService.getSettings());
  }, []);

  const testAnnouncement = useCallback(async () => {
    await announcementService.testAnnouncement();
  }, []);

  const initTrip = useCallback((tripInfo: TripAnnouncementInfo) => {
    announcementService.initTrip(tripInfo);
  }, []);

  const checkLocation = useCallback((lat: number, lng: number) => {
    announcementService.checkLocationForAnnouncements(lat, lng);
  }, []);

  const announceAllAboard = useCallback((count: number) => {
    announcementService.announceAllAboard(count);
  }, []);

  const announceNextStop = useCallback((name: string, location: string) => {
    announcementService.announceNextStop(name, location);
  }, []);

  const stopAnnouncements = useCallback(() => {
    announcementService.stop();
  }, []);

  const clearTrip = useCallback(() => {
    announcementService.clearTrip();
  }, []);

  return {
    settings,
    isAvailable,
    updateSettings,
    testAnnouncement,
    initTrip,
    checkLocation,
    announceAllAboard,
    announceNextStop,
    stopAnnouncements,
    clearTrip,
  };
}


