import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthResponse,
  User,
  Driver,
  Vehicle,
  Route,
  Ride,
  Wallet,
  Transaction,
  QrPaymentSession,
  Settlement,
  SafetyReport,
  Notification,
  UserRole,
  DriverStatus,
  PaymentMethod,
  RideStatus,
  SafetyReportType,
  VerificationStatus,
} from '@/types';

// Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TOKEN_KEY = '@ridepass_token';
const REFRESH_TOKEN_KEY = '@ridepass_refresh_token';

// ==================== API CLIENT ====================

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private async loadToken() {
    this.accessToken = await AsyncStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string) {
    this.accessToken = token;
    AsyncStorage.setItem(TOKEN_KEY, token);
  }

  clearToken() {
    this.accessToken = null;
    AsyncStorage.removeItem(TOKEN_KEY);
    AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiClient(API_BASE_URL);

// ==================== AUTH API ====================

export const authApi = {
  sendOtp: (phone: string) => 
    api.post<{ message: string; expiresIn: number }>('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, code: string) =>
    api.post<{ valid: boolean; isNewUser: boolean }>('/auth/verify-otp', { phone, code }),

  register: (data: {
    phone: string;
    name: string;
    email?: string;
    role: UserRole;
    dateOfBirth?: string;
    guardianId?: string;
  }) => api.post<AuthResponse>('/auth/register', data),

  login: (phone: string, code: string) =>
    api.post<AuthResponse>('/auth/login', { phone, code }),

  refreshToken: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }),

  updateFcmToken: (fcmToken: string) =>
    api.post('/auth/fcm-token', { fcmToken }),

  logout: () => api.post('/auth/logout'),

  setToken: (token: string) => api.setToken(token),
  clearToken: () => api.clearToken(),
};

// ==================== USERS API ====================

export const usersApi = {
  getProfile: () => api.get<User>('/users/me'),

  updateProfile: (data: {
    name?: string;
    email?: string;
    profilePic?: string;
    dateOfBirth?: string;
  }) => api.put<User>('/users/me', data),

  verifyIdentity: (idNumber: string, idImage: string) =>
    api.post<User>('/users/me/verify-identity', { idNumber, idImage }),

  addGuardian: (guardianId: string) =>
    api.post<User>('/users/me/guardian', { guardianId }),

  getDependents: () => api.get<User[]>('/users/me/dependents'),

  deleteAccount: () => api.delete('/users/me'),
};

// ==================== DRIVERS API ====================

export const driversApi = {
  createProfile: (data: {
    licenceNumber: string;
    licenceImage: string;
    licenceExpiryDate?: string;
  }) => api.post<Driver>('/drivers/profile', data),

  getProfile: () => api.get<Driver>('/drivers/profile'),

  updateProfile: (data: {
    licenceNumber?: string;
    licenceImage?: string;
    licenceExpiryDate?: string;
  }) => api.put<Driver>('/drivers/profile', data),

  updateStatus: (status: DriverStatus) =>
    api.put<Driver>('/drivers/status', { status }),

  setActiveVehicle: (vehicleId: string) =>
    api.put<Driver>('/drivers/active-vehicle', { vehicleId }),

  updateLocation: (data: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
  }) => api.put('/drivers/location', data),

  getStatistics: () =>
    api.get<{
      totalRides: number;
      todayRides: number;
      weekRides: number;
      monthRides: number;
      rating: number;
      totalEarnings: number;
      pendingEarnings: number;
    }>('/drivers/statistics'),

  getNearbyDrivers: (lat: number, lng: number, radius?: number) =>
    api.get<Driver[]>(`/drivers/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`),

  getDriver: (id: string) => api.get<Driver>(`/drivers/${id}`),
};

// ==================== VEHICLES API ====================

export const vehiclesApi = {
  create: (data: {
    plateNumber: string;
    make: string;
    model: string;
    year: number;
    color: string;
    vehicleType: string;
    capacity?: number;
    images: string[];
    insuranceNumber?: string;
    insuranceExpiry?: string;
  }) => api.post<Vehicle>('/vehicles', data),

  getMyVehicles: () => api.get<Vehicle[]>('/vehicles/my-vehicles'),

  getVehicle: (id: string) => api.get<Vehicle>(`/vehicles/${id}`),

  update: (id: string, data: Partial<Vehicle>) =>
    api.put<Vehicle>(`/vehicles/${id}`, data),

  delete: (id: string) => api.delete(`/vehicles/${id}`),
};

// ==================== ROUTES API ====================

export const routesApi = {
  create: (data: {
    name?: string;
    originName: string;
    originLat: number;
    originLng: number;
    destinationName: string;
    destinationLat: number;
    destinationLng: number;
    polyline: string;
    waypoints?: Array<{ lat: number; lng: number; name?: string }>;
    distance?: number;
    duration?: number;
    baseFare?: number;
  }) => api.post<Route>('/routes', data),

  getActiveRoutes: () => api.get<Route[]>('/routes/active'),

  getNearbyRoutes: (lat: number, lng: number, radius?: number) =>
    api.get<Route[]>(`/routes/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`),

  getMyRoutes: () => api.get<Route[]>('/routes/my-routes'),

  getRoute: (id: string) => api.get<Route>(`/routes/${id}`),

  update: (id: string, data: Partial<Route>) =>
    api.put<Route>(`/routes/${id}`, data),

  toggleActive: (id: string) => api.put<Route>(`/routes/${id}/toggle-active`),

  delete: (id: string) => api.delete(`/routes/${id}`),
};

// ==================== RIDES API ====================

export const ridesApi = {
  request: (data: {
    driverId: string;
    routeId?: string;
    pickupName: string;
    pickupLat: number;
    pickupLng: number;
    dropoffName: string;
    dropoffLat: number;
    dropoffLng: number;
    fare: number;
    paymentMethod?: PaymentMethod;
  }) => api.post<Ride>('/rides/request', data),

  respond: (rideId: string, accept: boolean) =>
    api.put<Ride>(`/rides/${rideId}/respond`, { accept }),

  updateStatus: (rideId: string, status: RideStatus, cancelReason?: string) =>
    api.put<Ride>(`/rides/${rideId}/status`, { status, cancelReason }),

  rate: (rideId: string, rating: number, feedback?: string) =>
    api.post(`/rides/${rideId}/rate`, { rating, feedback }),

  shareTrip: (rideId: string) =>
    api.post<{ shareCode: string; shareUrl: string; expiresAt: string }>(`/rides/${rideId}/share`),

  viewSharedTrip: (shareCode: string) =>
    api.get<{ ride: Ride; driverLocation?: { lat: number; lng: number } }>(`/rides/shared/${shareCode}`),

  getActiveRide: () =>
    api.get<{ ride: Ride; role: 'passenger' | 'driver' } | null>('/rides/active'),

  getPassengerRides: (status?: RideStatus) =>
    api.get<Ride[]>(`/rides/passenger${status ? `?status=${status}` : ''}`),

  getDriverRides: (status?: RideStatus) =>
    api.get<Ride[]>(`/rides/driver${status ? `?status=${status}` : ''}`),

  getRide: (id: string) => api.get<Ride>(`/rides/${id}`),
};

// ==================== WALLET API ====================

export const walletApi = {
  getWallet: () => api.get<Wallet>('/wallet'),

  getBalance: () => api.get<{ balance: number }>('/wallet/balance'),

  topUp: (amount: number, paymentMethod: PaymentMethod, phoneNumber?: string) =>
    api.post<Transaction>('/wallet/top-up', { amount, paymentMethod, phoneNumber }),

  generateQr: (amount: number) =>
    api.post<{ qrCode: string; qrData: string; amount: number; expiresAt: string }>('/wallet/generate-qr', { amount }),

  payViaQr: (qrCode: string) =>
    api.post<{ success: boolean; amount: number; driverName: string; reference: string }>('/wallet/pay-qr', { qrCode }),

  transfer: (recipientId: string, amount: number, description?: string) =>
    api.post<{ success: boolean; amount: number; recipientName: string; reference: string }>('/wallet/transfer', { recipientId, amount, description }),

  getTransactions: (page?: number, limit?: number) =>
    api.get<{
      transactions: Transaction[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/wallet/transactions${page ? `?page=${page}` : ''}${limit ? `&limit=${limit}` : ''}`),
};

// ==================== SETTLEMENTS API ====================

export const settlementsApi = {
  getDriverSettlements: () => api.get<Settlement[]>('/settlements/driver'),

  getSummary: () =>
    api.get<{
      pendingSettlement: number;
      totalSettled: number;
      thisMonthSettled: number;
      currentPeriodEarnings: number;
      totalEarnings: number;
    }>('/settlements/summary'),
};

// ==================== SAFETY API ====================

export const safetyApi = {
  createReport: (data: {
    targetId: string;
    type: SafetyReportType;
    description: string;
    evidence?: string[];
    lat?: number;
    lng?: number;
  }) => api.post<SafetyReport>('/safety/report', data),

  triggerSos: (lat: number, lng: number, rideId?: string, message?: string) =>
    api.post<{
      alert: { id: string };
      message: string;
      emergencyContacts: string[];
    }>('/safety/sos', { lat, lng, rideId, message }),

  getMyReports: () => api.get<SafetyReport[]>('/safety/my-reports'),

  getMySafetyScore: () =>
    api.get<{
      score: number;
      reportsMade: number;
      reportsReceived: number;
      resolvedPositively: number;
    }>('/safety/score'),
};

// ==================== NOTIFICATIONS API ====================

export const notificationsApi = {
  getNotifications: (page?: number, limit?: number) =>
    api.get<{
      notifications: Notification[];
      unreadCount: number;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/notifications${page ? `?page=${page}` : ''}${limit ? `&limit=${limit}` : ''}`),

  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),

  markAllAsRead: () => api.put('/notifications/read-all'),

  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export default api;
