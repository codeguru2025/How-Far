# DevOps Guide for How Far

This document covers deployment, CI/CD, monitoring, and operational procedures for the How Far application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Configuration](#environment-configuration)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Deployment Procedures](#deployment-procedures)
5. [Monitoring & Health Checks](#monitoring--health-checks)
6. [Secrets Management](#secrets-management)
7. [Runbooks](#runbooks)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Mobile Apps                           │
│              (iOS & Android - Built with Expo)               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Platform                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  PostgreSQL  │  │ Edge Functions│  │  Realtime        │   │
│  │  (Database)  │  │  (Deno)       │  │  (WebSockets)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   PayNow     │  │ Google Maps  │  │    Infobip       │   │
│  │  (Payments)  │  │   (Maps)     │  │    (SMS/OTP)     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

### Required Environment Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard > Settings > API |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key | Google Cloud Console |
| `EXPO_PUBLIC_PAYNOW_ID` | PayNow Integration ID | PayNow Dashboard |
| `EXPO_PUBLIC_PAYNOW_KEY` | PayNow Integration Key | PayNow Dashboard |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `MAPBOX_SECRET_TOKEN` | Mapbox secret token (for native builds) |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Mapbox public token |

### Setting Up Secrets

#### GitHub Actions Secrets

Add these secrets in your GitHub repository (Settings > Secrets > Actions):

```
EXPO_TOKEN              # Get from expo.dev account settings
SUPABASE_ACCESS_TOKEN   # Get from Supabase Dashboard > Account
SUPABASE_PROJECT_REF    # Your project reference ID
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
EXPO_PUBLIC_PAYNOW_ID
EXPO_PUBLIC_PAYNOW_KEY
MAPBOX_SECRET_TOKEN
```

#### EAS Secrets

For EAS Build, set secrets using the Expo CLI:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co"
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
# ... repeat for all secrets
```

---

## CI/CD Pipeline

### Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push and pull request:

1. **Lint & Type Check** - Validates TypeScript code
2. **Security Audit** - Scans for vulnerabilities and leaked secrets
3. **Supabase Validation** - Checks Edge Function syntax

### Build & Deploy (`.github/workflows/build.yml`)

Triggered by:
- Manual dispatch (workflow_dispatch)
- Version tags (v*.*.*)

Stages:
1. **Pre-flight Checks** - Validates code before building
2. **Deploy Supabase** - Deploys Edge Functions (production only)
3. **Build App** - Builds iOS and Android apps with EAS
4. **Submit** - Submits to app stores (production releases only)

### Manual Build Commands

```bash
# Development build
cd expo-app
npm run build:dev

# Preview build
npm run build:preview

# Production build
npm run build:prod
```

---

## Deployment Procedures

### Deploying Edge Functions

```bash
# Using the deploy script (Windows)
.\scripts\deploy.ps1 prod

# Manual deployment
cd supabase
supabase functions deploy paynowWebhook --no-verify-jwt
supabase functions deploy health --no-verify-jwt
supabase functions deploy creditWallet
# ... etc
```

### Database Migrations

```bash
# Push migrations to production
supabase db push

# Generate a new migration
supabase migration new migration_name
```

### OTA Updates (Expo Updates)

For JS-only changes, use OTA updates:

```bash
cd expo-app
eas update --channel production --message "Bug fix for X"
```

---

## Monitoring & Health Checks

### Health Check Endpoint

**URL:** `https://<project-ref>.supabase.co/functions/v1/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "latency": 45,
  "version": "1.0.0",
  "checks": {
    "database": { "status": "ok", "latency": 23 },
    "paynow": { "status": "configured" }
  }
}
```

**Status Codes:**
- `200` - All systems healthy
- `503` - Some systems degraded

### Monitoring Recommendations

1. **Uptime Monitoring:** Use services like UptimeRobot or Pingdom to monitor the health endpoint
2. **Error Tracking:** Consider adding Sentry for error tracking:
   ```bash
   npm install @sentry/react-native
   ```
3. **Analytics:** Expo provides built-in analytics at expo.dev

### Log Access

View Edge Function logs:
```bash
supabase functions logs paynowWebhook --tail
```

---

## Secrets Management

### DO NOT COMMIT

The following should NEVER be committed to version control:

- `.env` files
- `google-service-account.json`
- `*.keystore`, `*.jks`, `*.p12`, `*.pem`
- Any file containing API keys or tokens

### Rotating Secrets

1. **Supabase Keys:** Rotate in Dashboard > Settings > API
2. **Google Maps:** Rotate in Google Cloud Console
3. **PayNow:** Contact PayNow support
4. **EAS Secrets:** `eas secret:delete` + `eas secret:create`

---

## Runbooks

### Runbook: PayNow Webhook Not Receiving Payments

1. Check webhook is deployed: `supabase functions list`
2. Check logs: `supabase functions logs paynowWebhook --tail`
3. Verify PayNow result URL is set correctly
4. Check hash verification (ensure `PAYNOW_CLIENT_KEY` secret is set)
5. Test with manual webhook call

### Runbook: App Crashes on Startup

1. Check EAS build logs for errors
2. Verify all environment variables are set
3. Check Supabase connection (health endpoint)
4. Review crash logs in Expo dashboard

### Runbook: Database Migration Failed

1. Check migration syntax: `supabase db diff`
2. Review error message carefully
3. If stuck, reset with: `supabase db reset` (CAUTION: destroys data)
4. Re-run: `supabase db push`

### Runbook: Rolling Back a Release

1. In App Store Connect / Google Play Console, halt the rollout
2. Build previous version:
   ```bash
   git checkout v1.0.0
   eas build --profile production
   eas submit
   ```

---

## Quick Reference

### Important URLs

| Service | URL |
|---------|-----|
| Supabase Dashboard | https://supabase.com/dashboard |
| Expo Dashboard | https://expo.dev |
| EAS Builds | https://expo.dev/accounts/[owner]/projects/how-far/builds |
| Google Play Console | https://play.google.com/console |
| App Store Connect | https://appstoreconnect.apple.com |

### Useful Commands

```bash
# Check build status
eas build:list

# View specific build
eas build:view

# Cancel a build
eas build:cancel

# Check app status
eas submit:status

# View Supabase functions
supabase functions list
```

---

## Contact

For urgent production issues, contact the development team.

