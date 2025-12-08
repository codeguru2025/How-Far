export type UserRole = 'commuter' | 'operator';

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

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

export interface Ride {
  id: string;
  subscriptionId: string;
  operatorId: string;
  operatorName: string;
  route: string;
  timestamp: string;
  qrToken: string;
}

export interface Operator {
  id: string;
  name: string;
  phone: string;
  routes: string[];
  vehicleNumber: string;
}
