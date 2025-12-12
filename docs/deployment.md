# 🚀 Deployment Guide

Complete guide for deploying How Far to production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Supabase Deployment](#supabase-deployment)
4. [EAS Configuration](#eas-configuration)
5. [Building the App](#building-the-app)
6. [Store Submission](#store-submission)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying, ensure:

### Infrastructure
- [ ] Supabase project created and configured
- [ ] PayNow merchant account verified and active
- [ ] Google Maps API keys obtained (iOS + Android)
- [ ] Domain for deep links configured (optional)

### Accounts
- [ ] Expo account created (expo.dev)
- [ ] Apple Developer account ($99/year) - for iOS
- [ ] Google Play Console account ($25 one-time) - for Android

### Configuration
- [ ] All environment variables set
- [ ] App bundle identifiers registered
- [ ] Signing credentials configured

### Content
- [ ] Privacy Policy hosted publicly
- [ ] Terms of Service hosted publicly
- [ ] App icons and screenshots ready
- [ ] Store descriptions prepared

---

## Environment Setup

### Required Environment Variables

Create `expo-app/.env` for local development:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# PayNow
EXPO_PUBLIC_PAYNOW_ID=your-merchant-id
EXPO_PUBLIC_PAYNOW_KEY=your-integration-key

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key

# EAS
EAS_PROJECT_ID=your-eas-project-id
```

### Environment Variables for EAS Builds

EAS builds can use environment variables from EAS Secrets:

```bash
# Set secrets for EAS
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --scope project
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --scope project
npx eas secret:create --name EXPO_PUBLIC_PAYNOW_ID --value "your-merchant-id" --scope project
npx eas secret:create --name EXPO_PUBLIC_PAYNOW_KEY --value "your-integration-key" --scope project
npx eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "your-google-maps-key" --scope project
```

Or use the EAS dashboard: expo.dev → Project → Secrets

---

## Supabase Deployment

### 1. Link Project

```bash
# Login to Supabase CLI
supabase login

# Link to your production project
supabase link --project-ref YOUR_PROJECT_ID
```

### 2. Set Supabase Secrets

```bash
# PayNow credentials
supabase secrets set PAYNOW_CLIENT_KEY=your-key
supabase secrets set PAYNOW_CLIENT_SECRET=your-secret

# Infobip OTP (see docs/INFOBIP_OTP_SETUP.md for details)
supabase secrets set INFOBIP_API_KEY=your-api-key
supabase secrets set INFOBIP_BASE_URL=xxxxx.api.infobip.com
supabase secrets set INFOBIP_2FA_APP_ID=your-app-id
supabase secrets set INFOBIP_2FA_MESSAGE_ID=your-message-id

# Other secrets as needed
supabase secrets set SMS_API_KEY=your-sms-key
```

### 3. Run Migrations

```bash
# Push migrations to production
supabase db push

# Or push specific migration
supabase db push --include-all
```

### 4. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy paynowWebhook --no-verify-jwt
supabase functions deploy creditWallet --no-verify-jwt
supabase functions deploy reconcilePayments --no-verify-jwt
supabase functions deploy completeRide --no-verify-jwt
supabase functions deploy requestRide --no-verify-jwt
supabase functions deploy health --no-verify-jwt

# OTP Functions (requires Infobip setup - see docs/INFOBIP_OTP_SETUP.md)
supabase functions deploy sendOTP --no-verify-jwt
supabase functions deploy verifyOTP --no-verify-jwt
supabase functions deploy resendOTP --no-verify-jwt
```

Or use the deploy script:

```powershell
# Windows
.\scripts\deploy.ps1 prod
```

### 5. Configure Webhook URL

After deploying `paynowWebhook`, configure PayNow to call:

```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/paynowWebhook
```

---

## EAS Configuration

### 1. Initialize EAS

```bash
cd expo-app

# Login
npx eas login

# Initialize project
npx eas init
```

### 2. Configure Credentials

#### iOS Credentials

```bash
npx eas credentials --platform ios
```

Options:
- **Managed by Expo (recommended)**: EAS creates and manages certificates
- **Manual**: Provide your own certificates

#### Android Credentials

```bash
npx eas credentials --platform android
```

Options:
- **Create new keystore (recommended)**: EAS generates and stores securely
- **Manual**: Provide your own keystore

### 3. Verify Configuration

Check `expo-app/eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium",
        "credentialsSource": "remote"
      },
      "android": {
        "buildType": "app-bundle",
        "credentialsSource": "remote"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "your-email@example.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

---

## Building the App

### Development Build (Testing)

```bash
# Build development client for testing
npx eas build --platform all --profile development
```

### Preview Build (Internal Testing)

```bash
# Build APK (Android) and Simulator (iOS)
npx eas build --platform all --profile preview
```

### Production Build

```bash
# Build for both platforms
npx eas build --platform all --profile production

# Or separately
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

### Monitor Build

```bash
# List recent builds
npx eas build:list

# View specific build
npx eas build:view <build-id>
```

---

## Store Submission

### Automatic Submission

```bash
# Submit to both stores
npx eas submit --platform all --profile production

# Or separately
npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```

### Manual Submission

See detailed guides:
- [App Store Submission Guide](APP_STORE_SUBMISSION_GUIDE.md)
- [Google Play Submission Guide](GOOGLE_PLAY_SUBMISSION_GUIDE.md)

### Quick Reference

| Platform | Review Time | Process |
|----------|-------------|---------|
| iOS | 24-48 hours | Human review required |
| Android | Few hours to 7 days | Mostly automated |

---

## Post-Deployment

### Monitoring

1. **Supabase Dashboard**
   - Check function logs
   - Monitor database performance
   - Review error rates

2. **Expo Dashboard**
   - Check update stats
   - Monitor crash reports

3. **Store Dashboards**
   - Android Vitals (Play Console)
   - App Analytics (App Store Connect)

### OTA Updates

For JavaScript-only changes:

```bash
# Push update to production channel
npx eas update --channel production --message "Bug fixes"
```

**Note**: Native code changes require new builds.

### Rollback

If issues occur with functions:

```bash
# View function versions
supabase functions list

# Re-deploy previous version
# (Keep backups of your function code)
```

For app issues:
- Use phased/staged rollout
- Pause rollout if issues detected
- Submit hotfix build

---

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
cd expo-app
rm -rf node_modules
npm install
npx eas build --platform android --profile production --clear-cache
```

### Credential Issues

```bash
# Reset credentials
npx eas credentials --platform ios
# Choose "Set up new credentials"
```

### Submit Failures

**Android:**
- Verify service account has correct permissions
- Check package name matches Play Console

**iOS:**
- Verify Apple ID and App Store Connect ID
- Check bundle ID is registered

### Function Errors

```bash
# View function logs
supabase functions logs paynowWebhook

# Test function locally
supabase functions serve paynowWebhook --no-verify-jwt
```

---

## Environment Matrix

| Environment | Supabase | PayNow | EAS Channel |
|-------------|----------|--------|-------------|
| Development | Local | Sandbox | development |
| Preview | Staging project | Sandbox | preview |
| Production | Production project | Live | production |

---

## Security Reminders

1. **Never commit secrets**
   - `.env` files in `.gitignore`
   - Use EAS Secrets for builds
   - Use Supabase Secrets for functions

2. **Rotate credentials regularly**
   - Update PayNow keys quarterly
   - Rotate API keys if compromised

3. **Monitor access**
   - Review Supabase access logs
   - Monitor for unusual activity

---

## Quick Commands Reference

```bash
# === SUPABASE ===
supabase login
supabase link --project-ref PROJECT_ID
supabase db push
supabase functions deploy FUNCTION_NAME --no-verify-jwt
supabase secrets set KEY=VALUE
supabase functions logs FUNCTION_NAME

# === EAS ===
npx eas login
npx eas init
npx eas credentials
npx eas build --platform PLATFORM --profile PROFILE
npx eas submit --platform PLATFORM --profile PROFILE
npx eas update --channel CHANNEL --message "MESSAGE"
npx eas build:list
npx eas secret:create --name NAME --value VALUE --scope project

# === LOCAL DEV ===
cd expo-app
npm start
npm run android
npm run ios
```

---

**Need help?** Contact: devops@howfar.app

---

Last updated: December 2025
