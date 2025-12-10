// Ride Store - Manages current ride state
import { create } from 'zustand';
import { Location, Driver, RideStatus, VehicleType } from '../types';

interface RideDetails {
  pickup: Location | null;
  dropoff: Location | null;
  vehicleType: VehicleType;
  price: number;
  distance: number;
  duration: number;
  status: RideStatus;
  driver: Driver | null;
}

interface RideStore {
  ride: RideDetails | null;
  
  // Actions
  setRide: (ride: RideDetails) => void;
  updateStatus: (status: RideStatus) => void;
  setDriver: (driver: Driver) => void;
  clearRide: () => void;
}

export const useRideStore = create<RideStore>((set) => ({
  ride: null,
  
  setRide: (ride) => set({ ride }),
  
  updateStatus: (status) => set((state) => ({
    ride: state.ride ? { ...state.ride, status } : null,
  })),
  
  setDriver: (driver) => set((state) => ({
    ride: state.ride ? { ...state.ride, driver } : null,
  })),
  
  clearRide: () => set({ ride: null }),
}));

