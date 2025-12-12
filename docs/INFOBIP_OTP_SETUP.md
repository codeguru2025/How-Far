# Infobip OTP Setup Guide

**How Far - Phone Verification with Infobip 2FA**

This guide walks you through setting up Infobip's 2FA (Two-Factor Authentication) service for phone number verification in the How Far app.

---

## Table of Contents

1. [Create Infobip Account](#1-create-infobip-account)
2. [Get Your API Key](#2-get-your-api-key)
3. [Find Your Base URL](#3-find-your-base-url)
4. [Create 2FA Application](#4-create-2fa-application)
5. [Create Message Template](#5-create-message-template)
6. [Configure Environment Variables](#6-configure-environment-variables)
7. [Deploy Functions](#7-deploy-functions)
8. [Testing](#8-testing)
9. [Production Considerations](#9-production-considerations)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Create Infobip Account

### 1.1 Sign Up for Trial

1. Go to [infobip.com/signup](https://www.infobip.com/signup)
2. Fill in your details:
   - Email address
   - Password
   - Company name (can be "How Far" or your company)
   - Country
3. Verify your email address
4. Complete the account setup

### 1.2 Trial Account Features

With a trial account, you get:
- **Free SMS credits** for testing
- Access to all APIs
- Limited to sending to verified numbers only

To send to any number, you'll need to:
- Verify your business
- Add payment method
- Switch to a paid plan

---

## 2. Get Your API Key

### 2.1 Navigate to API Keys

1. Log in to [portal.infobip.com](https://portal.infobip.com)
2. In the left sidebar, go to **Developer Tools** → **API Keys**

### 2.2 Create New API Key

1. Click **Create API Key**
2. Configure:
   - **Name**: `how-far-production` (or similar)
   - **Expiration**: Set as needed (or never expire)
   - **Allowed IPs**: Leave empty for now (or add your server IPs)
   
3. **API Scopes** - Enable these:
   - `2fa:application:read`
   - `2fa:application:write`
   - `2fa:pin:send`
   - `2fa:pin:verify`
   - `sms:message:send` (optional, for regular SMS)

4. Click **Save**
5. **COPY AND SAVE THE API KEY** - It won't be shown again!

```
Your API Key looks like: a1b2c3d4e5f6g7h8i9j0...
```

---

## 3. Find Your Base URL

### 3.1 Locate Base URL

1. In the Infobip portal, look at the homepage/dashboard
2. Your base URL is displayed prominently
3. It looks like: `xxxxx.api.infobip.com`

**Example Base URLs:**
- `2g3k8j.api.infobip.com`
- `xyz123.api.infobip.com`

### 3.2 Or Find in Account Settings

1. Go to **Settings** → **Account**
2. Look for "API Base URL" or similar

---

## 4. Create 2FA Application

You can create the 2FA application either through the portal or via API.

### Option A: Via Portal (Recommended)

1. In the left sidebar, go to **Apps** → **2FA**
2. Click **Create Application**
3. Configure:
   - **Name**: `How Far OTP`
   - **PIN Attempts**: `5` (max attempts before PIN invalidates)
   - **PIN Time to Live**: `10m` (PIN expires after 10 minutes)
   - **Allow Multiple Verifications**: `No`
   - **Verify PIN Limit**: `1/3s` (rate limiting)
   - **Send PIN Per Application Limit**: `10000/1d`
   - **Send PIN Per Phone Number Limit**: `5/1d`

4. Click **Save**
5. **Copy the Application ID** - You'll need this!

### Option B: Via API

Using curl or Postman:

```bash
curl -X POST "https://YOUR_BASE_URL/2fa/2/applications" \
  -H "Authorization: App YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "How Far OTP",
    "enabled": true,
    "configuration": {
      "pinAttempts": 5,
      "allowMultiplePinVerifications": false,
      "pinTimeToLive": "10m",
      "verifyPinLimit": "1/3s",
      "sendPinPerApplicationLimit": "10000/1d",
      "sendPinPerPhoneNumberLimit": "5/1d"
    }
  }'
```

Response:
```json
{
  "applicationId": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
  "name": "How Far OTP",
  "configuration": {...}
}
```

**Save the `applicationId`!**

---

## 5. Create Message Template

### Option A: Via Portal

1. In your 2FA application, go to **Message Templates**
2. Click **Create Template**
3. Configure:
   - **Message Text**: `Your How Far verification code is: {{pin}}. Valid for 10 minutes. Do not share this code.`
   - **PIN Length**: `6`
   - **PIN Type**: `NUMERIC`
   - **Sender ID**: `HowFar` (or your registered sender ID)
   - **Language**: `en`

4. Click **Save**
5. **Copy the Message ID** - You'll need this!

### Option B: Via API

```bash
curl -X POST "https://YOUR_BASE_URL/2fa/2/applications/YOUR_APP_ID/messages" \
  -H "Authorization: App YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messageText": "Your How Far verification code is: {{pin}}. Valid for 10 minutes. Do not share this code.",
    "pinLength": 6,
    "pinType": "NUMERIC",
    "senderId": "HowFar",
    "language": "en"
  }'
```

Response:
```json
{
  "messageId": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
  "applicationId": "...",
  "messageText": "...",
  "pinLength": 6,
  "pinType": "NUMERIC",
  "senderId": "HowFar"
}
```

**Save the `messageId`!**

---

## 6. Configure Environment Variables

### 6.1 Supabase Secrets

Set these secrets in your Supabase project:

```bash
# Navigate to your project
cd how-far

# Set Infobip secrets
supabase secrets set INFOBIP_API_KEY="your-api-key-here"
supabase secrets set INFOBIP_BASE_URL="xxxxx.api.infobip.com"
supabase secrets set INFOBIP_2FA_APP_ID="your-application-id"
supabase secrets set INFOBIP_2FA_MESSAGE_ID="your-message-id"
```

### 6.2 Verify Secrets

```bash
supabase secrets list
```

You should see:
```
INFOBIP_API_KEY
INFOBIP_BASE_URL
INFOBIP_2FA_APP_ID
INFOBIP_2FA_MESSAGE_ID
```

---

## 7. Deploy Functions

### 7.1 Run Database Migration

```bash
supabase db push
```

This creates the `otp_requests` table for tracking OTP requests.

### 7.2 Deploy Edge Functions

```bash
# Deploy OTP functions
supabase functions deploy sendOTP --no-verify-jwt
supabase functions deploy verifyOTP --no-verify-jwt
supabase functions deploy resendOTP --no-verify-jwt
```

### 7.3 Verify Deployment

```bash
supabase functions list
```

You should see `sendOTP`, `verifyOTP`, and `resendOTP` listed.

---

## 8. Testing

### 8.1 Test Sending OTP

Using curl:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/sendOTP" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+263771234567", "purpose": "verification"}'
```

Expected response:
```json
{
  "success": true,
  "pinId": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
  "message": "OTP sent successfully",
  "expiresIn": 600
}
```

### 8.2 Test Verifying OTP

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/verifyOTP" \
  -H "Content-Type: application/json" \
  -d '{"pinId": "YOUR_PIN_ID", "pin": "123456"}'
```

Expected response (success):
```json
{
  "success": true,
  "verified": true,
  "message": "Phone number verified successfully",
  "phoneNumber": "+263771234567"
}
```

Expected response (wrong PIN):
```json
{
  "success": true,
  "verified": false,
  "error": "Incorrect PIN",
  "attemptsRemaining": 4
}
```

### 8.3 Test in App

The `OTPVerificationScreen` component is ready to use:

```tsx
import { OTPVerificationScreen } from './src/screens/auth/OTPVerificationScreen';

// In your app:
<OTPVerificationScreen
  phoneNumber="+263771234567"
  purpose="registration"
  onVerified={(phone) => {
    console.log('Verified:', phone);
    // Continue with registration
  }}
  onCancel={() => {
    // Go back
  }}
/>
```

---

## 9. Production Considerations

### 9.1 Verify Your Business

For production, you need to:
1. Complete business verification in Infobip portal
2. Add a payment method
3. Purchase SMS credits or set up billing

### 9.2 Register Sender ID

To use custom sender ID (e.g., "HowFar"):
1. Go to **Channels** → **SMS** → **Sender Registration**
2. Submit your sender ID for approval
3. Wait for approval (varies by country)

### 9.3 Rate Limiting

Current limits in the 2FA app config:
- 5 OTP requests per phone number per day
- 5 verification attempts per PIN
- 3 resends per PIN

Adjust in the Infobip portal as needed.

### 9.4 Monitor Usage

In Infobip portal:
1. Go to **Analyze** → **Logs**
2. Filter by 2FA
3. Monitor delivery rates and failures

---

## 10. Troubleshooting

### Error: "OTP service not configured"

**Cause**: Missing environment variables

**Solution**: 
```bash
supabase secrets list
# Verify all 4 INFOBIP_* secrets are set
```

### Error: "Invalid API key"

**Cause**: Wrong API key or missing scopes

**Solution**:
1. Verify API key in Infobip portal
2. Check API key has correct scopes
3. Regenerate if needed

### Error: "Application not found"

**Cause**: Wrong application ID

**Solution**:
1. Go to Infobip portal → Apps → 2FA
2. Copy correct application ID
3. Update secret: `supabase secrets set INFOBIP_2FA_APP_ID="correct-id"`

### Error: "Message template not found"

**Cause**: Wrong message ID or template deleted

**Solution**:
1. Go to Infobip portal → Your 2FA App → Message Templates
2. Copy correct message ID
3. Update secret: `supabase secrets set INFOBIP_2FA_MESSAGE_ID="correct-id"`

### SMS Not Received

**Possible causes**:
1. **Trial account**: Can only send to verified numbers
2. **Invalid number format**: Must be international format (+263...)
3. **Network issues**: Check Infobip logs for delivery status

**Solution**:
1. Verify your phone number in Infobip portal for trial
2. Check number format is correct
3. Check Analyze → Logs in Infobip portal

### Rate Limited

**Error**: "Please wait before requesting another code"

**Solution**: This is working as intended. Wait 1 minute between requests.

---

## Quick Reference

### Environment Variables

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `INFOBIP_API_KEY` | `a1b2c3d4e5...` | Your Infobip API key |
| `INFOBIP_BASE_URL` | `2g3k8j.api.infobip.com` | Your Infobip base URL |
| `INFOBIP_2FA_APP_ID` | `XXXXXXXX-XXXX-...` | 2FA Application ID |
| `INFOBIP_2FA_MESSAGE_ID` | `XXXXXXXX-XXXX-...` | Message Template ID |

### API Endpoints

| Function | Path | Method |
|----------|------|--------|
| Send OTP | `/functions/v1/sendOTP` | POST |
| Verify OTP | `/functions/v1/verifyOTP` | POST |
| Resend OTP | `/functions/v1/resendOTP` | POST |

### Commands

```bash
# Set secrets
supabase secrets set INFOBIP_API_KEY="..."
supabase secrets set INFOBIP_BASE_URL="..."
supabase secrets set INFOBIP_2FA_APP_ID="..."
supabase secrets set INFOBIP_2FA_MESSAGE_ID="..."

# Deploy functions
supabase functions deploy sendOTP --no-verify-jwt
supabase functions deploy verifyOTP --no-verify-jwt
supabase functions deploy resendOTP --no-verify-jwt

# Check logs
supabase functions logs sendOTP
supabase functions logs verifyOTP
```

---

## Support

- **Infobip Documentation**: [infobip.com/docs](https://www.infobip.com/docs)
- **Infobip Support**: [support.infobip.com](https://support.infobip.com)
- **How Far Support**: support@howfar.app

---

**Setup complete!** 🔐 Your app now has secure phone verification.

