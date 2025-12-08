// ==================== ENUMS ====================

export type UserRole = 'PASSENGER' | 'DRIVER' | 'ADMIN';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type DriverStatus = 'OFFLINE' | 'ONLINE' | 'ON_TRIP' | 'SUSPENDED';
export type VehicleType = 'KOMBI' | 'BUS' | 'SEDAN' | 'SUV';
export type RideStatus = 'REQUESTED' | 'ACCEPTED' | 'PASSENGER_PICKED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TransactionType = 'TOP_UP' | 'PAYMENT' | 'REFUND' | 'SETTLEMENT' | 'WITHDRAWAL';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type PaymentMethod = 'ECOCASH' | 'INNBUCKS' | 'BANK_TRANSFER' | 'WALLET';
export type SettlementPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type SafetyReportType = 'HARASSMENT' | 'UNSAFE_DRIVING' | 'VEHICLE_CONDITION' | 'FRAUD' | 'EMERGENCY' | 'OTHER';

// ==================== USER MODELS ====================

export interface User {
  id: string;
  phone: string;
  email?: string;
  name: string;
  profilePic?: string;
  role: UserRole;
  isVerified: boolean;
  dateOfBirth?: string;
  guardianId?: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  userId: string;
  user?: User;
  licenceNumber: string;
  licenceImage: string;
  licenceVerifiedAt?: string;
  status: DriverStatus;
  verificationStatus: VerificationStatus;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  vehicles?: Vehicle[];
  activeVehicle?: Vehicle;
  activeVehicleId?: string;
  liveLocation?: LiveLocation;
  routes?: Route[];
}

export interface Vehicle {
  id: string;
  driverId: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicleType: VehicleType;
  capacity: number;
  images: string[];
  verified: boolean;
  verificationStatus: VerificationStatus;
  insuranceNumber?: string;
  insuranceExpiry?: string;
}

// ==================== LOCATION & ROUTES ====================

export interface LiveLocation {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updatedAt: string;
}

export interface Waypoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface Route {
  id: string;
  driverId: string;
  driver?: Driver;
  name?: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  polyline: string;
  waypoints?: Waypoint[];
  distance?: number;
  duration?: number;
  baseFare: number;
  isActive: boolean;
  createdAt: string;
}

// ==================== RIDES ====================

export interface Ride {
  id: string;
  passengerId: string;
  passenger?: User;
  driverId: string;
  driver?: Driver;
  vehicleId?: string;
  vehicle?: Vehicle;
  routeId?: string;
  route?: Route;
  status: RideStatus;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  fare: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  passengerRating?: number;
  driverRating?: number;
  feedback?: string;
  tripShare?: TripShare;
}

export interface TripShare {
  id: string;
  rideId: string;
  shareCode: string;
  shareUrl: string;
  expiresAt: string;
}

// ==================== WALLET & PAYMENTS ====================

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  isActive: boolean;
  lastTopUpAt?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  rideId?: string;
  type: TransactionType;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod?: PaymentMethod;
  reference: string;
  externalRef?: string;
  description?: string;
  createdAt: string;
}

export interface QrPaymentSession {
  id: string;
  driverId: string;
  amount: number;
  qrCode: string;
  qrData: string;
  isUsed: boolean;
  expiresAt: string;
}

// ==================== SETTLEMENTS ====================

export interface Settlement {
  id: string;
  driverId: string;
  driver?: Driver;
  amount: number;
  fee: number;
  netAmount: number;
  period: SettlementPeriod;
  periodStart: string;
  periodEnd: string;
  status: string;
  paidAt?: string;
  reference?: string;
}

// ==================== SAFETY ====================

export interface SafetyReport {
  id: string;
  reporterId: string;
  reporter?: User;
  targetId: string;
  target?: User;
  type: SafetyReportType;
  description: string;
  evidence: string[];
  location?: { lat: number; lng: number };
  status: string;
  createdAt: string;
}

export interface SosAlert {
  id: string;
  userId: string;
  rideId?: string;
  lat: number;
  lng: number;
  message?: string;
  isActive: boolean;
  createdAt: string;
}

// ==================== NOTIFICATIONS ====================

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ==================== SUBSCRIPTION (Legacy Support) ====================

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration: 'daily' | 'weekly' | 'monthly';
  ridesIncluded: number;
  price: number;
  description: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  plan: SubscriptionPlan;
  startDate: string;
  endDate: string;
  ridesRemaining: number;
  status: 'active' | 'expired' | 'pending';
}

// ==================== OPERATOR (Legacy Support) ====================

export interface Operator {
  id: string;
  name: string;
  phone: string;
  routes: string[];
  vehicleNumber: string;
}

// ==================== API RESPONSE TYPES ====================

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
