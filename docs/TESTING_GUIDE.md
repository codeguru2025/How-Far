# How Far - Testing Guide

## Overview

This guide covers how to test the How Far app before deploying to production.

---

## 🔧 Development Setup

### 1. Install Dependencies
```bash
cd expo-app
npm install
```

### 2. Configure Environment
Create `.env` in expo-app folder:
```env
EXPO_PUBLIC_SUPABASE_URL=https://egffmatoyzinnxpinzcv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Start Development Server
```bash
npx expo start
```

### 4. Run on Device/Simulator
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app

---

## 📱 Development Builds (Recommended)

Development builds include all native modules and are better for testing.

### Build for iOS Simulator
```bash
eas build --profile development --platform ios
```

### Build for Android Emulator/Device
```bash
eas build --profile development --platform android
```

### Install Development Build
```bash
# iOS - drag .app to simulator or use eas
# Android - download and install APK
```

---

## 🧪 Testing Phases

### Phase 1: Unit Testing (Functions)

#### Test Supabase Edge Functions
```powershell
# Test generateDailySettlements
$response = Invoke-RestMethod -Uri "https://egffmatoyzinnxpinzcv.supabase.co/functions/v1/generateDailySettlements" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer YOUR_SERVICE_KEY" }
$response | ConvertTo-Json

# Test getSettlements (requires admin auth)
```

### Phase 2: Integration Testing

#### Auth Flow
1. [ ] Register new user with phone number
2. [ ] Login with existing credentials
3. [ ] Logout and login again
4. [ ] Password reset flow (if implemented)

#### Wallet & Payments
1. [ ] View wallet balance
2. [ ] Top up wallet via Paynow
3. [ ] Check transaction history
4. [ ] Payment during ride

#### Driver Functions
1. [ ] Switch to driver mode
2. [ ] Go online/offline
3. [ ] Create a trip
4. [ ] Accept bookings
5. [ ] Complete trip
6. [ ] View earnings

#### Passenger Functions
1. [ ] Browse available trips
2. [ ] Book a seat
3. [ ] Pay for booking
4. [ ] Track trip progress
5. [ ] Rate driver

### Phase 3: End-to-End Testing

#### Complete Ride Flow
1. Driver creates trip from A to B
2. Passenger searches and finds trip
3. Passenger books seat
4. Passenger pays
5. Driver starts trip
6. Driver picks up passenger
7. Driver completes trip
8. Both rate each other
9. Driver sees earnings
10. Settlement appears for admin

---

## 👨‍💼 Admin Testing

### Create Admin User
Run this SQL in Supabase SQL Editor:
```sql
-- First, get the user ID of the person you want to make admin
-- Replace with actual user_id from users table

INSERT INTO admins (user_id, role, pin_hash, is_active)
VALUES (
  'USER_UUID_HERE',
  'super_admin',
  -- PIN: 123456 (change in production!)
  encode(sha256('123456'::bytea), 'hex'),
  true
);
```

### Test Admin Functions
1. [ ] Login as admin user
2. [ ] Access settlements screen
3. [ ] View pending settlements
4. [ ] Process a settlement with PIN
5. [ ] Check audit log

---

## 🔄 Preview/Staging Testing

### Build Preview Version
```bash
eas build --profile preview --platform all
```

### Distribute for Testing

#### iOS (TestFlight)
```bash
eas submit --platform ios --profile preview
```
Then invite testers in App Store Connect.

#### Android (Internal Testing)
```bash
eas submit --platform android --profile preview
```
Then invite testers in Google Play Console.

---

## 🐛 Debugging

### View Logs (Development)
```bash
npx expo start
# Logs appear in terminal
```

### View Edge Function Logs
Go to Supabase Dashboard → Edge Functions → Select function → Logs

### Common Issues

| Issue | Solution |
|-------|----------|
| "Network request failed" | Check Supabase URL in .env |
| Map not showing | Add Google Maps API key |
| Location not working | Check permissions in simulator |
| Payments failing | Verify Paynow credentials |

---

## ✅ Pre-Release Checklist

### Functionality
- [ ] All screens load without errors
- [ ] All forms validate correctly
- [ ] All buttons/actions work
- [ ] Navigation works correctly
- [ ] Back button works
- [ ] Pull-to-refresh works
- [ ] Loading states display
- [ ] Error states display

### Performance
- [ ] App launches in < 3 seconds
- [ ] No lag during navigation
- [ ] Images load quickly
- [ ] Lists scroll smoothly
- [ ] No memory leaks

### Security
- [ ] Sensitive data not logged
- [ ] API keys not exposed
- [ ] Auth required for protected routes
- [ ] RLS policies working

### Platform-Specific
- [ ] iOS - works on different iPhone sizes
- [ ] iOS - works on iPad (if supportsTablet)
- [ ] Android - works on different screen sizes
- [ ] Android - back button handled correctly

---

## 📊 Test Accounts

### Passenger Test Account
```
Phone: +263771234567
Password: Test123!
```

### Driver Test Account
```
Phone: +263771234568
Password: Test123!
```

### Admin Test Account
```
Phone: +263771234569
Password: Test123!
PIN: 123456
```

*Note: Create these accounts in your development/staging environment*

---

*Last Updated: December 2024*

