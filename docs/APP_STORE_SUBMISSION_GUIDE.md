# Apple App Store Submission Guide

**How Far - iOS App Store Connect Submission**

This comprehensive guide walks you through the process of submitting the How Far app to the Apple App Store.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Apple Developer Account Setup](#2-apple-developer-account-setup)
3. [App Store Connect Configuration](#3-app-store-connect-configuration)
4. [Building the iOS App](#4-building-the-ios-app)
5. [Submitting for Review](#5-submitting-for-review)
6. [App Store Metadata](#6-app-store-metadata)
7. [Screenshots and Preview Videos](#7-screenshots-and-preview-videos)
8. [App Privacy Details](#8-app-privacy-details)
9. [Review Guidelines Compliance](#9-review-guidelines-compliance)
10. [Common Rejection Reasons](#10-common-rejection-reasons)
11. [Post-Submission](#11-post-submission)

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] Apple Developer Program membership ($99/year)
- [ ] macOS computer (for certificate management if needed)
- [ ] Expo account with EAS configured
- [ ] All environment variables set up
- [ ] App icons and screenshots ready
- [ ] Privacy Policy URL (hosted publicly)
- [ ] Support URL (email or website)

---

## 2. Apple Developer Account Setup

### 2.1 Enroll in Apple Developer Program

1. Go to [developer.apple.com](https://developer.apple.com)
2. Click "Account" and sign in with your Apple ID
3. Enroll in the Apple Developer Program
4. Pay the annual fee ($99 USD)
5. Wait for approval (usually 24-48 hours)

### 2.2 Note Your Team ID

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. In the Membership section, find your **Team ID**
3. Save this for the `eas.json` configuration

---

## 3. App Store Connect Configuration

### 3.1 Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in the details:
   - **Platform**: iOS
   - **Name**: How Far
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.howfar.app` (create if not exists)
   - **SKU**: `HOWFAR001` (unique identifier)
   - **User Access**: Full Access (or specific users)

### 3.2 Note Your App ID

After creating the app, note the **Apple ID** (a number like `1234567890`). You'll need this for EAS.

### 3.3 Update EAS Configuration

Edit `expo-app/eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your.email@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD1234"
      }
    }
  }
}
```

---

## 4. Building the iOS App

### 4.1 Configure Environment Variables

Create `.env` file in `expo-app/`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PAYNOW_ID=your-merchant-id
EXPO_PUBLIC_PAYNOW_KEY=your-integration-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-ios-google-maps-key
EAS_PROJECT_ID=your-eas-project-id
```

### 4.2 Link Your EAS Project

```bash
cd expo-app

# Login to Expo
npx eas login

# Initialize/link the project
npx eas init

# Update the project ID in app.json and eas.json
```

### 4.3 Configure Apple Credentials

EAS can manage credentials automatically:

```bash
npx eas credentials
```

Select:
- Platform: iOS
- Profile: production
- Let EAS manage credentials (recommended)

### 4.4 Build for Production

```bash
# Build for iOS App Store
npx eas build --platform ios --profile production
```

This will:
1. Upload your code to Expo's build servers
2. Generate the `.ipa` file
3. Sign with appropriate certificates
4. Return a download link

**Build time**: 15-30 minutes typically

### 4.5 Monitor Build Status

```bash
# Check build status
npx eas build:list --platform ios
```

Or visit: [expo.dev/accounts/[username]/projects/[project]/builds](https://expo.dev)

---

## 5. Submitting for Review

### 5.1 Automatic Submission with EAS

```bash
# Submit the latest build
npx eas submit --platform ios --profile production
```

You'll be prompted for:
- Apple ID credentials
- Which build to submit

### 5.2 Manual Submission (Alternative)

1. Download the `.ipa` from the EAS build page
2. Open **Transporter** app on macOS
3. Sign in with your Apple ID
4. Drag and drop the `.ipa` file
5. Click "Deliver"

### 5.3 Select Build in App Store Connect

1. Go to App Store Connect → Your App
2. Under "Build", click "+" 
3. Select the uploaded build
4. Wait for processing (5-15 minutes)

---

## 6. App Store Metadata

### 6.1 App Information

Fill out in App Store Connect → App Information:

| Field | Value |
|-------|-------|
| Name | How Far |
| Subtitle | Ride Sharing Made Easy |
| Primary Category | Travel |
| Secondary Category | Lifestyle |
| Content Rights | Does not contain third-party content |

### 6.2 App Description

**Description** (4000 characters max):

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
• Top up from EcoCash, OneMoney, InnBucks
• View transaction history
• Instant QR code payments
• Easy withdrawals

🔒 SAFE & SECURE
• Verified users
• In-app messaging
• Trip tracking
• Rating system

Download How Far today and travel smarter!
```

### 6.3 Keywords

```
ride sharing, kombi, taxi, transport, travel, Zimbabwe, EcoCash, commute, carpool, ride hailing
```

### 6.4 What's New (Version Notes)

```
Initial Release:
• Find and book shared rides
• Create trips as a driver
• QR code payments
• Multiple mobile money options
• Real-time trip tracking
```

### 6.5 Support and Marketing URLs

| Field | URL |
|-------|-----|
| Support URL | https://howfar.app/support |
| Marketing URL | https://howfar.app |
| Privacy Policy URL | https://howfar.app/privacy |

---

## 7. Screenshots and Preview Videos

### 7.1 Required Screenshot Sizes

| Device | Size (pixels) | Required |
|--------|--------------|----------|
| iPhone 6.7" | 1290 x 2796 | Yes |
| iPhone 6.5" | 1284 x 2778 | Yes |
| iPhone 5.5" | 1242 x 2208 | Optional |
| iPad Pro 12.9" | 2048 x 2732 | If supporting iPad |

### 7.2 Recommended Screenshots (5-10)

1. **Home Screen** - Welcome view with "Find Ride" prominent
2. **Trip Search** - Finding available rides
3. **Trip Details** - Viewing a trip with driver info
4. **QR Payment** - Showing the QR code for payment
5. **Driver Dashboard** - Trip management for drivers
6. **Wallet** - Balance and transaction history
7. **Profile** - User settings and info
8. **Map View** - Real-time trip tracking

### 7.3 Screenshot Tips

- Use real data (or realistic mock data)
- Ensure status bar shows carrier, battery, etc.
- No placeholder text
- Highlight key features
- Consider adding text overlays explaining features

---

## 8. App Privacy Details

### 8.1 Privacy Nutrition Labels

In App Store Connect → App Privacy, declare:

#### Data Linked to You:
| Data Type | Usage |
|-----------|-------|
| Phone Number | Account registration, user identification |
| Name | Profile display, driver/rider identification |
| Precise Location | Ride matching, trip tracking |
| Coarse Location | Finding nearby rides |
| Payment Info | Mobile money transactions |
| Transaction History | Purchase history, earnings |
| User ID | Account identification |

#### Data Not Linked to You:
| Data Type | Usage |
|-----------|-------|
| Crash Data | App analytics |
| Performance Data | App diagnostics |

### 8.2 Data Usage Declarations

For each data type, specify:
- **Purpose**: App functionality, Analytics, etc.
- **Linked to user**: Yes/No
- **Used for tracking**: No

---

## 9. Review Guidelines Compliance

### 9.1 Critical Requirements

✅ **Payments**: All in-app payments use Apple's IAP? **No - Exempt**
  - How Far uses external payment for real-world services (transportation)
  - This is allowed under App Store guidelines (like Uber, Lyft)

✅ **Location Usage**: Clear purpose strings in Info.plist
  - Explained in NSLocationWhenInUseUsageDescription
  - Explained in NSLocationAlwaysAndWhenInUseUsageDescription

✅ **Camera Usage**: Clear purpose string
  - Explained in NSCameraUsageDescription (QR scanning)

✅ **Privacy Policy**: Required and publicly accessible

✅ **Age Rating**: 17+ (financial transactions)

### 9.2 Age Rating Questionnaire

When prompted, answer:

| Question | Answer |
|----------|--------|
| Gambling | None |
| Violence | None |
| Sexual Content | None |
| Profanity | None |
| Drugs | None |
| Mature Content | None |
| Horror | None |
| Medical Info | None |
| Alcohol/Tobacco | None |
| Unrestricted Web Access | No |

Resulting rating: **4+** or **12+** depending on region

---

## 10. Common Rejection Reasons

### 10.1 Metadata Issues
- **Missing Privacy Policy URL**: Ensure it's a working HTTPS link
- **Placeholder text**: Remove any "lorem ipsum" or test data
- **Inaccurate screenshots**: Must reflect actual app functionality

### 10.2 Functionality Issues
- **Incomplete features**: All buttons must work
- **Crashes**: Test thoroughly before submission
- **Login problems**: Provide demo account if needed

### 10.3 Demo Account

If your app requires login, provide a demo account in App Review Information:

```
Demo Account:
Phone: +263771234567
Password: DemoUser123!

Notes: This account has pre-loaded wallet balance for testing payments.
```

### 10.4 Legal Issues
- **Third-party content rights**: Ensure all assets are licensed
- **Trademark usage**: Don't use Apple trademarks incorrectly

---

## 11. Post-Submission

### 11.1 Review Timeline

- **Standard Review**: 24-48 hours typically
- **Expedited Review**: Available for critical issues
- Check status in App Store Connect

### 11.2 Responding to Rejection

If rejected:
1. Read the rejection reasons carefully
2. Address each issue specifically
3. Reply through Resolution Center
4. Resubmit with fixes

### 11.3 After Approval

1. **Release**: Choose manual or automatic release
2. **Phased Release**: Gradually roll out to users
3. **Monitor**: Check Analytics and Crash reports
4. **Ratings**: Respond to user reviews professionally

### 11.4 Updating the App

For updates:
1. Increment version in `app.json`
2. Build new version: `npx eas build --platform ios --profile production`
3. Submit: `npx eas submit --platform ios`
4. Fill in "What's New" for the update

---

## Quick Reference Commands

```bash
# Login to Expo
npx eas login

# Configure credentials
npx eas credentials

# Build for iOS
npx eas build --platform ios --profile production

# Submit to App Store
npx eas submit --platform ios --profile production

# Check build status
npx eas build:list --platform ios

# View logs
npx eas build:view [build-id]
```

---

## Checklist Before Submission

- [ ] All environment variables configured
- [ ] Privacy Policy URL is live and accessible
- [ ] Support email/URL is active
- [ ] App icons meet Apple specifications
- [ ] Screenshots prepared for all required device sizes
- [ ] App description and keywords finalized
- [ ] Demo account created (if needed)
- [ ] Age rating questionnaire completed
- [ ] Privacy labels configured
- [ ] All features tested on real device
- [ ] No placeholder content in app
- [ ] Version number incremented (if update)

---

**Good luck with your submission!** 🍎📱

