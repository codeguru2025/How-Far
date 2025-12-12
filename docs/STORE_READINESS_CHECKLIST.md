# How Far - Store Readiness Checklist

## 📋 Pre-Submission Checklist

Use this checklist to ensure your app is ready for both Apple App Store and Google Play Store.

---

## 🔧 Configuration Updates Required

### 1. app.json Updates
Replace these placeholders in `expo-app/app.json`:

| Field | Current Value | Required Action |
|-------|---------------|-----------------|
| `ios.config.googleMapsApiKey` | `YOUR_IOS_GOOGLE_MAPS_API_KEY` | Get from Google Cloud Console |
| `android.config.googleMaps.apiKey` | `YOUR_ANDROID_GOOGLE_MAPS_API_KEY` | Get from Google Cloud Console |
| `extra.eas.projectId` | `YOUR_EAS_PROJECT_ID` | Run `eas init` to get this |
| `updates.url` | Contains `YOUR_EAS_PROJECT_ID` | Will auto-update after `eas init` |
| `owner` | `your-expo-username` | Your Expo username |

### 2. eas.json Updates
Replace these placeholders in `expo-app/eas.json`:

| Field | Required Action |
|-------|-----------------|
| `submit.production.ios.appleId` | Your Apple ID email |
| `submit.production.ios.ascAppId` | App Store Connect App ID |
| `submit.production.ios.appleTeamId` | Your Apple Team ID |
| `submit.production.android.serviceAccountKeyPath` | Path to Google service account JSON |

---

## 📱 App Assets Required

### Icons (Already in assets folder)
- [x] `icon.png` - 1024x1024px (iOS App Store icon)
- [x] `adaptive-icon.png` - 1024x1024px (Android adaptive icon)
- [x] `splash-icon.png` - Splash screen logo
- [x] `favicon.png` - Web favicon

### Screenshots Needed
Create screenshots for each store:

#### iOS Screenshots (Required sizes)
- [ ] iPhone 6.7" (1290 x 2796 px) - iPhone 15 Pro Max
- [ ] iPhone 6.5" (1284 x 2778 px) - iPhone 14 Plus
- [ ] iPhone 5.5" (1242 x 2208 px) - iPhone 8 Plus
- [ ] iPad 12.9" (2048 x 2732 px) - iPad Pro

#### Android Screenshots
- [ ] Phone (1080 x 1920 px minimum)
- [ ] 7" Tablet (optional)
- [ ] 10" Tablet (optional)

---

## 📄 Legal Documents

### Required URLs (host these publicly)
- [ ] Privacy Policy - Use `docs/PRIVACY_POLICY.md` content
- [ ] Terms of Service - Use `docs/TERMS_OF_SERVICE.md` content

### Hosting Options
1. **GitHub Pages**: Free, easy for markdown
2. **Your website**: howfar.app/privacy, howfar.app/terms
3. **Notion public page**: Quick setup

---

## 🔐 Credentials & Accounts

### Apple (iOS)
- [ ] Apple Developer account ($99/year)
- [ ] App Store Connect access
- [ ] Distribution certificate
- [ ] App-specific password (for submissions)

### Google (Android)
- [ ] Google Play Developer account ($25 one-time)
- [ ] Service account with API access
- [ ] Keystore for signing (EAS manages this)

### EAS (Expo)
- [ ] Expo account
- [ ] Run `eas init` in expo-app folder
- [ ] Run `eas credentials` to set up signing

---

## ⚙️ Environment Variables

### App (.env in expo-app/)
```env
EXPO_PUBLIC_SUPABASE_URL=https://egffmatoyzinnxpinzcv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_PAYNOW_INTEGRATION_ID=your_paynow_id
EXPO_PUBLIC_PAYNOW_INTEGRATION_KEY=your_paynow_key
```

### Supabase Secrets (already set)
- [x] INFOBIP_API_KEY
- [x] INFOBIP_BASE_URL
- [x] INFOBIP_2FA_APP_ID
- [x] INFOBIP_2FA_MESSAGE_ID
- [ ] ECOCASH_MERCHANT_CODE
- [ ] ECOCASH_API_KEY
- [ ] BANK_DETAILS_ENCRYPTION_KEY (generate with `openssl rand -base64 32`)

---

## 📱 Testing Before Submission

### Internal Testing

#### 1. Development Build
```bash
cd expo-app
eas build --profile development --platform ios
eas build --profile development --platform android
```

#### 2. Preview Build (TestFlight/Internal Testing)
```bash
eas build --profile preview --platform all
```

#### 3. Submit to Internal Testing
```bash
# iOS - TestFlight
eas submit --platform ios --latest

# Android - Internal Testing Track
eas submit --platform android --latest
```

### Test Checklist
- [ ] User registration works
- [ ] User login works
- [ ] Location permissions request works
- [ ] Map displays correctly
- [ ] Payment top-up works
- [ ] Driver mode works (if applicable)
- [ ] Push notifications work
- [ ] App doesn't crash on any screen
- [ ] Deep links work

---

## 🚀 Submission Steps

### iOS (App Store)

1. **Build Production**
   ```bash
   cd expo-app
   eas build --profile production --platform ios
   ```

2. **Submit to App Store Connect**
   ```bash
   eas submit --platform ios --latest
   ```

3. **In App Store Connect**:
   - Add screenshots
   - Fill in description, keywords
   - Set age rating
   - Add privacy policy URL
   - Submit for review

### Android (Google Play)

1. **Build Production**
   ```bash
   cd expo-app
   eas build --profile production --platform android
   ```

2. **Submit to Google Play**
   ```bash
   eas submit --platform android --latest
   ```

3. **In Google Play Console**:
   - Complete store listing
   - Add screenshots
   - Complete content rating questionnaire
   - Set up pricing
   - Submit for review

---

## ⚠️ Common Rejection Reasons & Fixes

### iOS
| Reason | Fix |
|--------|-----|
| Missing permission descriptions | ✅ Already configured in app.json |
| Privacy policy not accessible | Host at public URL |
| App crashes | Test thoroughly before submission |
| Incomplete information | Fill all App Store Connect fields |
| Login required but no demo | Provide demo credentials or guest mode |

### Android
| Reason | Fix |
|--------|-----|
| Permission policy violation | Justify each permission used |
| Privacy policy missing | Add URL in Play Console |
| Target SDK too old | ✅ EAS handles this |
| Broken functionality | Test on multiple devices |
| Metadata policy violation | Follow guidelines for screenshots/description |

---

## 📊 Store Listing Content

### App Name
**How Far** (max 30 chars iOS, 50 chars Android)

### Short Description (80 chars)
```
Book shared rides, pay securely, and travel together in Zimbabwe.
```

### Full Description (4000 chars max)
```
How Far is Zimbabwe's premier ride-sharing app, connecting passengers with drivers for safe, affordable, and convenient travel.

🚗 KEY FEATURES:
• Book rides instantly with real-time driver matching
• Pay securely with mobile money (EcoCash, InnBucks) or wallet
• Share rides with others going your way to split costs
• QR code payments for quick, secure transactions
• Track your ride in real-time with live GPS

💰 FLEXIBLE PAYMENTS:
• Top up your wallet using Paynow
• Pay per ride or use your wallet balance
• Transparent pricing with no hidden fees

🔒 SAFETY FIRST:
• Verified drivers with ratings
• Share your trip with friends and family
• 24/7 customer support

📍 AVAILABLE NOW:
Currently serving Harare, Bulawayo, and major cities across Zimbabwe.

Download How Far today and travel smarter!
```

### Keywords (iOS - 100 chars)
```
ride,taxi,transport,zimbabwe,harare,ecocash,carpool,rideshare,travel,driver
```

### Categories
- **Primary**: Travel (iOS) / Maps & Navigation (Android)
- **Secondary**: Transportation

---

## ✅ Final Checklist

- [ ] All placeholder values replaced
- [ ] App icons created and placed
- [ ] Screenshots captured
- [ ] Legal documents hosted
- [ ] Developer accounts set up
- [ ] Environment variables configured
- [ ] Internal testing completed
- [ ] Production build created
- [ ] Store listing completed
- [ ] App submitted for review

---

*Last Updated: December 2024*

