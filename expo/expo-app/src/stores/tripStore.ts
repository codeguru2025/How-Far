// Trip Store - Manages shared rides state
import { create } from 'zustand';
import { Trip, Booking, AppMode, Location } from '../types';

interface TripState {
  // App mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  
  // Driver: Current trip being created/managed
  currentTrip: Trip | null;
  setCurrentTrip: (trip: Trip | null) => void;
  updateTrip: (updates: Partial<Trip>) => void;
  
  // Driver: Trip creation flow
  tripDraft: {
    origin?: Location;
    destination?: Location;
    vehicleId?: string;
    tripType: 'kombi' | 'long_distance' | 'private';
    totalSeats: number;
    baseFare: number;
    pickupFee: number;
    dropoffFee: number;
    waypoints: Array<{
      location: Location;
      fare?: number;
    }>;
  };
  setTripDraft: (draft: Partial<TripState['tripDraft']>) => void;
  resetTripDraft: () => void;
  addWaypoint: (location: Location, fare?: number) => void;
  removeWaypoint: (index: number) => void;
  
  // Rider: Search & booking
  searchOrigin: Location | null;
  searchDestination: Location | null;
  setSearchLocations: (origin: Location | null, destination: Location | null) => void;
  
  availableTrips: Trip[];
  setAvailableTrips: (trips: Trip[]) => void;
  
  selectedTrip: Trip | null;
  setSelectedTrip: (trip: Trip | null) => void;
  
  // Rider: Active booking
  activeBooking: Booking | null;
  setActiveBooking: (booking: Booking | null) => void;
  
  // Driver: Pending bookings to review
  pendingBookings: Booking[];
  setPendingBookings: (bookings: Booking[]) => void;
  addPendingBooking: (booking: Booking) => void;
  removePendingBooking: (bookingId: string) => void;
}

const defaultTripDraft = {
  tripType: 'kombi' as const,
  totalSeats: 4,
  baseFare: 1,
  pickupFee: 0,
  dropoffFee: 0,
  waypoints: [],
};

export const useTripStore = create<TripState>((set, get) => ({
  // App mode
  mode: 'rider',
  setMode: (mode) => set({ mode }),
  
  // Driver: Current trip
  currentTrip: null,
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  updateTrip: (updates) => {
    const { currentTrip } = get();
    if (currentTrip) {
      set({ currentTrip: { ...currentTrip, ...updates } });
    }
  },
  
  // Driver: Trip draft
  tripDraft: defaultTripDraft,
  setTripDraft: (draft) => set((state) => ({ 
    tripDraft: { ...state.tripDraft, ...draft } 
  })),
  resetTripDraft: () => set({ tripDraft: defaultTripDraft }),
  addWaypoint: (location, fare) => set((state) => ({
    tripDraft: {
      ...state.tripDraft,
      waypoints: [...state.tripDraft.waypoints, { location, fare }],
    },
  })),
  removeWaypoint: (index) => set((state) => ({
    tripDraft: {
      ...state.tripDraft,
      waypoints: state.tripDraft.waypoints.filter((_, i) => i !== index),
    },
  })),
  
  // Rider: Search
  searchOrigin: null,
  searchDestination: null,
  setSearchLocations: (origin, destination) => set({ searchOrigin: origin, searchDestination: destination }),
  
  availableTrips: [],
  setAvailableTrips: (trips) => set({ availableTrips: trips }),
  
  selectedTrip: null,
  setSelectedTrip: (trip) => set({ selectedTrip: trip }),
  
  // Rider: Active booking
  activeBooking: null,
  setActiveBooking: (booking) => set({ activeBooking: booking }),
  
  // Driver: Pending bookings
  pendingBookings: [],
  setPendingBookings: (bookings) => set({ pendingBookings: bookings }),
  addPendingBooking: (booking) => set((state) => ({
    pendingBookings: [...state.pendingBookings, booking],
  })),
  removePendingBooking: (bookingId) => set((state) => ({
    pendingBookings: state.pendingBookings.filter((b) => b.id !== bookingId),
  })),
}));

