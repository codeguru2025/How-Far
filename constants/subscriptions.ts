import { SubscriptionPlan } from '@/types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'daily',
    name: 'Daily Pass',
    duration: 'daily',
    ridesIncluded: 4,
    price: 2.5,
    description: '4 rides for one day',
  },
  {
    id: 'weekly',
    name: 'Weekly Pass',
    duration: 'weekly',
    ridesIncluded: 20,
    price: 10,
    description: '20 rides for 7 days',
  },
  {
    id: 'monthly',
    name: 'Monthly Pass',
    duration: 'monthly',
    ridesIncluded: 80,
    price: 35,
    description: '80 rides for 30 days',
  },
];

export const POPULAR_ROUTES = [
  'CBD - Chitungwiza',
  'CBD - Warren Park',
  'CBD - Glen View',
  'CBD - Mbare',
  'CBD - Epworth',
  'CBD - Budiriro',
  'CBD - Highfield',
  'CBD - Glen Norah',
];
