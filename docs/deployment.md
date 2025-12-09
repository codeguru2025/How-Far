# 🚀 Deployment Guide

## Overview

This guide covers deploying Ndeip-Zthin to production.

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Supabase project created and linked
- [ ] PayNow merchant account verified
- [ ] App Store / Play Store accounts ready
- [ ] Domain for deep links configured

## 1. Supabase Setup

### Link Project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
```

### Set Secrets

```bash
supabase secrets set PAYNOW_CLIENT_KEY=your-key
supabase secrets set PAYNOW_CLIENT_SECRET=your-secret
```

### Run Migrations

```bash
supabase db push
```

### Deploy Functions

```bash
supabase functions deploy paynowWebhook --no-verify-jwt
supabase functions deploy creditWallet --no-verify-jwt
supabase functions deploy reconcilePayments --no-verify-jwt
```

## 2. App Build

### Configure EAS

Edit `expo-app/eas.json` with your credentials.

### Build Android

```bash
cd expo-app
eas build --platform android --profile production
```

### Build iOS

```bash
eas build --platform ios --profile production
```

## 3. Submit to Stores

### Google Play Store

```bash
eas submit --platform android --profile production
```

### Apple App Store

```bash
eas submit --platform ios --profile production
```

## 4. Post-Deployment

### Monitoring

1. Check Supabase Dashboard for function logs
2. Monitor error rates in the Analytics tab
3. Set up alerts for failed webhooks

### Rollback

If issues occur:

```bash
# Revert to previous function version
supabase functions deploy paynowWebhook@previous --no-verify-jwt
```

## Environment-Specific Configs

| Environment | Supabase | PayNow |
|-------------|----------|--------|
| Development | Local | Sandbox |
| Staging | Staging project | Sandbox |
| Production | Production project | Live |

