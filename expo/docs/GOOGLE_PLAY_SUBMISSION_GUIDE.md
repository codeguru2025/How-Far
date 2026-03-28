# Google Play Store Submission Guide

**How Far - Google Play Console Submission**

This comprehensive guide walks you through the process of submitting the How Far app to the Google Play Store.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Google Play Developer Account](#2-google-play-developer-account)
3. [Google Play Console Setup](#3-google-play-console-setup)
4. [Service Account for EAS](#4-service-account-for-eas)
5. [Building the Android App](#5-building-the-android-app)
6. [Creating the Store Listing](#6-creating-the-store-listing)
7. [Data Safety Section](#7-data-safety-section)
8. [Content Rating](#8-content-rating)
9. [Submitting for Review](#9-submitting-for-review)
10. [Common Rejection Reasons](#10-common-rejection-reasons)
11. [Post-Publication](#11-post-publication)

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] Google Play Developer account ($25 one-time fee)
- [ ] Google Cloud Console access
- [ ] Expo account with EAS configured
- [ ] All environment variables set up
- [ ] App icons and screenshots ready
- [ ] Privacy Policy URL (hosted publicly)
- [ ] Feature graphic (1024 x 500 px)

---

## 2. Google Play Developer Account

### 2.1 Create Developer Account

1. Go to [play.google.com/console](https://play.google.com/console)
2. Sign in with a Google account
3. Accept the Developer Agreement
4. Pay the one-time registration fee ($25 USD)
5. Complete identity verification (required)
6. Wait for verification (can take up to 48 hours)

### 2.2 Developer Profile Setup

Complete your developer profile:
- Developer name
- Contact email (public)
- Website
- Physical address
- Phone number

---

## 3. Google Play Console Setup

### 3.1 Create New App

1. Go to Google Play Console
2. Click "Create app"
3. Fill in:
   - **App name**: How Far
   - **Default language**: English (United States)
   - **App or Game**: App
   - **Free or Paid**: Free
4. Accept declarations
5. Click "Create app"

### 3.2 Initial Setup Dashboard

After creating, you'll see a dashboard with setup tasks. Complete these in order:

1. **App access**: How app functions for review
2. **Ads**: Whether app contains ads
3. **Content rating**: Age rating questionnaire
4. **Target audience**: Who the app is for
5. **News apps**: If this is a news app
6. **Data safety**: Privacy declarations
7. **Government apps**: If government related

---

## 4. Service Account for EAS

To allow EAS to automatically submit builds, you need a Google Cloud service account.

### 4.1 Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select existing
3. Name it "How Far Play Console" or similar

### 4.2 Enable APIs

1. Go to "APIs & Services" → "Enable APIs and Services"
2. Search for and enable:
   - **Google Play Android Developer API**

### 4.3 Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in:
   - Name: `eas-submit`
   - Description: "EAS Build submission service account"
4. Click "Create and Continue"
5. Skip granting roles (done in Play Console)
6. Click "Done"

### 4.4 Generate Key

1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose **JSON** format
5. Click "Create"
6. Save the downloaded file as `google-service-account.json`
7. **Move this file to `expo-app/`**
8. **Add to .gitignore** (never commit this file!)

### 4.5 Grant Access in Play Console

1. Go to Google Play Console
2. Go to "Users and permissions" → "Invite new users"
3. Enter the service account email (from the JSON file)
4. Set permissions:
   - **Account level**: Admin (all permissions) OR
   - **App level**: Release to production, Manage production releases
5. Click "Invite user"
6. Go to the service account and click "Apply"

### 4.6 Update EAS Configuration

Ensure `eas.json` references the key file:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}
```

---

## 5. Building the Android App

### 5.1 Configure Environment Variables

Create `.env` file in `expo-app/`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PAYNOW_ID=your-merchant-id
EXPO_PUBLIC_PAYNOW_KEY=your-integration-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-android-google-maps-key
EAS_PROJECT_ID=your-eas-project-id
```

### 5.2 Link Your EAS Project

```bash
cd expo-app

# Login to Expo
npx eas login

# Initialize/link the project
npx eas init
```

### 5.3 Configure Android Credentials

EAS can manage signing keys automatically:

```bash
npx eas credentials
```

Select:
- Platform: Android
- Profile: production
- Let EAS create a new keystore (recommended for first build)

**Important**: The keystore is stored securely by EAS. You can download it later if needed.

### 5.4 Build for Production

```bash
# Build for Google Play Store (AAB format)
npx eas build --platform android --profile production
```

This will:
1. Upload your code to Expo's build servers
2. Generate the `.aab` (Android App Bundle) file
3. Sign with your keystore
4. Return a download link

**Build time**: 10-20 minutes typically

### 5.5 Monitor Build Status

```bash
# Check build status
npx eas build:list --platform android
```

Or visit: [expo.dev/accounts/[username]/projects/[project]/builds](https://expo.dev)

---

## 6. Creating the Store Listing

### 6.1 Main Store Listing

Go to "Store presence" → "Main store listing":

#### App Details

| Field | Value |
|-------|-------|
| App name | How Far |
| Short description (80 chars) | Share rides, save money. Zimbabwe's community-driven ride-sharing app. |

#### Full Description (4000 chars)

```
How Far is your go-to ride-sharing companion in Zimbabwe. Connect with drivers heading your way and share the journey – it's convenient, affordable, and community-driven.

🚗 FOR RIDERS
• Find Available Rides: Search for trips matching your route
• Book Seats: Reserve your spot with just a few taps  
• Pay Securely: Use our QR code system for quick, cashless payments
• Real-Time Tracking: Follow your trip on the map
• Multiple Payment Options: EcoCash, OneMoney, InnBucks supported

🚘 FOR DRIVERS
• Create Trips: Set your route and available seats
• Earn Extra: Turn your daily commute into income
• Manage Bookings: Accept or decline rider requests
• Get Paid Instantly: Receive payments directly to your wallet
• Withdraw Easily: Transfer earnings to your mobile money

💰 WALLET FEATURES
• Top up from EcoCash, OneMoney, InnBucks, and bank transfers
• View complete transaction history
• Instant QR code payments
• Easy withdrawals to mobile money

🔒 SAFE & SECURE
• Verified users with phone authentication
• In-app messaging between rider and driver
• Real-time trip tracking
• Rating system for quality control

📍 SMART MATCHING
• Find rides going in your direction
• Flexible pickup and dropoff options
• See driver ratings and vehicle details

Download How Far today and travel smarter!

Made with ❤️ in Zimbabwe
```

### 6.2 Graphics Requirements

| Asset | Size | Required |
|-------|------|----------|
| App icon | 512 x 512 px | Yes |
| Feature graphic | 1024 x 500 px | Yes |
| Phone screenshots | 16:9 or 9:16 ratio | Min 2, Max 8 |
| Tablet screenshots | 16:9 or 9:16 ratio | Optional |

### 6.3 Screenshots (Recommended)

Prepare 5-8 screenshots showing:

1. **Home Screen** - The main dashboard
2. **Find Rides** - Search results
3. **Trip Details** - Booking a seat
4. **QR Payment** - The payment QR code
5. **Driver View** - Creating a trip
6. **Trip Dashboard** - Managing passengers
7. **Wallet** - Balance and transactions
8. **Profile** - User settings

**Tips**:
- Use phone frames (mockups) for professional look
- Add text overlays explaining features
- Show real or realistic content
- Minimum 320px, recommended 1080px width

### 6.4 Feature Graphic

Create a 1024 x 500 px promotional banner:
- Include app name "How Far"
- Show key features visually
- Use brand colors (#E85A24)
- Clean, professional design

### 6.5 Video (Optional but Recommended)

YouTube video URL showing:
- App walkthrough
- Key features demonstration
- 30 seconds to 2 minutes length

---

## 7. Data Safety Section

### 7.1 Navigate to Data Safety

Go to "App content" → "Data safety"

### 7.2 Data Collection Overview

Answer the questionnaire:

| Question | Answer |
|----------|--------|
| Does your app collect or share any user data? | Yes |
| Is all data encrypted in transit? | Yes |
| Do you provide a way to request data deletion? | Yes |

### 7.3 Data Types Declaration

#### Location
| Field | Value |
|-------|-------|
| Collected | Yes |
| Shared | No |
| Required | Yes (core functionality) |
| Purposes | App functionality |

#### Personal Info - Phone Number
| Field | Value |
|-------|-------|
| Collected | Yes |
| Shared | No |
| Required | Yes (registration) |
| Purposes | Account management |

#### Personal Info - Name
| Field | Value |
|-------|-------|
| Collected | Yes |
| Shared | Yes (with other users) |
| Required | Yes |
| Purposes | App functionality (identification) |

#### Financial Info - Purchase History
| Field | Value |
|-------|-------|
| Collected | Yes |
| Shared | No |
| Required | Yes |
| Purposes | App functionality |

#### Financial Info - Payment Info
| Field | Value |
|-------|-------|
| Collected | Yes |
| Shared | Yes (with payment processor) |
| Required | Yes |
| Purposes | App functionality |

### 7.4 Security Practices

| Practice | Status |
|----------|--------|
| Data encrypted in transit | Yes |
| Data deletion request | Yes |
| Independent security review | Optional |

---

## 8. Content Rating

### 8.1 Start Questionnaire

Go to "App content" → "Content rating" → "Start questionnaire"

### 8.2 Category Selection

Select: **Utility, Productivity, Communication, or Other**

### 8.3 Answer Questions

| Question | Answer |
|----------|--------|
| Violence | No |
| Sexuality | No |
| Language | No |
| Controlled Substances | No |
| User-Generated Content | No (or Yes with moderation) |
| Location Sharing | Yes |
| Personal Information | Yes |
| Digital Purchases | Yes (in-app wallet) |

### 8.4 Resulting Ratings

Typically:
- **IARC**: 3+ / Everyone
- **PEGI**: 3
- **USK**: 0
- **GRAC**: All

---

## 9. Submitting for Review

### 9.1 Automatic Submission with EAS

```bash
# Submit the latest build
npx eas submit --platform android --profile production
```

### 9.2 Manual Upload (Alternative)

1. Download the `.aab` from EAS build page
2. Go to Play Console → "Release" → "Production"
3. Click "Create new release"
4. Upload the `.aab` file
5. Add release notes
6. Click "Review release"
7. Click "Start rollout to Production"

### 9.3 Release Tracks

| Track | Purpose |
|-------|---------|
| Internal testing | Up to 100 testers, immediate |
| Closed testing | Invite-only testers |
| Open testing | Public beta testing |
| Production | Full release |

**Recommended Flow**:
1. Internal testing → verify build works
2. Closed testing → gather feedback
3. Production → full release

### 9.4 Staged Rollouts

For production releases, consider staged rollout:
- Start at 10% of users
- Monitor for crashes
- Increase to 25%, 50%, 100%

---

## 10. Common Rejection Reasons

### 10.1 Policy Violations

| Issue | Solution |
|-------|----------|
| Missing Privacy Policy | Add publicly accessible privacy policy URL |
| Deceptive ads/content | Remove any misleading content |
| Impersonation | Don't mimic other apps |
| Restricted content | Ensure content is appropriate |

### 10.2 Technical Issues

| Issue | Solution |
|-------|----------|
| Crashes | Fix and test thoroughly |
| ANRs (App Not Responding) | Optimize performance |
| Permissions without use | Remove unused permissions |
| Excessive battery usage | Optimize location tracking |

### 10.3 Metadata Issues

| Issue | Solution |
|-------|----------|
| Misleading screenshots | Use actual app screenshots |
| Keyword stuffing | Keep description natural |
| Irrelevant keywords | Only relevant keywords |
| Broken URLs | Verify privacy policy/support URLs |

### 10.4 Payment Issues

Ride-sharing apps are **exempt** from Google Play Billing requirement for physical goods/services. Document this if questioned.

---

## 11. Post-Publication

### 11.1 Monitor Performance

In Play Console, check:
- **Android Vitals**: Crash rate, ANR rate
- **User Acquisition**: Downloads, retention
- **Reviews & Ratings**: User feedback

### 11.2 Respond to Reviews

- Reply professionally to all reviews
- Address negative feedback constructively
- Thank users for positive reviews

### 11.3 Release Updates

For updates:

```bash
# Increment version in app.json
# Then build and submit
npx eas build --platform android --profile production
npx eas submit --platform android --profile production
```

Update release notes for each version.

### 11.4 Monitor Policies

Google regularly updates policies. Stay informed:
- Subscribe to Google Play Console emails
- Check policy announcements
- Update app for new requirements

---

## Quick Reference Commands

```bash
# Login to Expo
npx eas login

# Configure credentials
npx eas credentials

# Build for Android (AAB for Play Store)
npx eas build --platform android --profile production

# Build APK (for testing/direct install)
npx eas build --platform android --profile preview

# Submit to Google Play
npx eas submit --platform android --profile production

# Check build status
npx eas build:list --platform android

# View logs
npx eas build:view [build-id]
```

---

## Checklist Before Submission

### App Content
- [ ] Privacy Policy URL is live and accessible
- [ ] Data Safety form completed
- [ ] Content rating questionnaire completed
- [ ] Target audience and content settings configured
- [ ] App access instructions provided

### Store Listing
- [ ] App name and descriptions finalized
- [ ] Feature graphic (1024x500) uploaded
- [ ] App icon (512x512) uploaded
- [ ] At least 2 phone screenshots uploaded
- [ ] Category and tags selected
- [ ] Contact details filled in

### Technical
- [ ] Service account configured correctly
- [ ] `google-service-account.json` in place
- [ ] EAS credentials configured
- [ ] Production build completed without errors
- [ ] App tested on real device

### Release
- [ ] Release notes written
- [ ] Countries/regions selected
- [ ] Pricing (Free) confirmed
- [ ] Review staged rollout option

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
cd expo-app
rm -rf node_modules
npm install
npx eas build --platform android --profile production --clear-cache
```

### Submit Fails
1. Verify service account has correct permissions
2. Check that `google-service-account.json` path is correct
3. Ensure app is created in Play Console
4. Verify package name matches

### App Rejected
1. Read rejection email carefully
2. Address specific issues mentioned
3. Update and resubmit
4. Reply to review with changes made

---

**Good luck with your submission!** 🤖📱

