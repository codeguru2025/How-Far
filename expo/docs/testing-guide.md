# Ndeip - Zthin Testing Guide

## Overview

This guide provides comprehensive testing instructions for the Ndeip-Zthin transport platform.

## Prerequisites

- Supabase CLI installed and configured
- Flutter SDK installed
- Edge Functions running locally or deployed

## Running Local Services

### Start Supabase Local Development

```bash
cd ndeip-zthin
supabase start
```

This will start:
- PostgreSQL database
- Auth service
- Edge Functions
- Realtime subscriptions

### Serve Edge Functions Locally

```bash
supabase functions serve
```

## Test Flows

### 1. Phone + Password Authentication

#### Sign Up

```bash
# Create a new user
curl -X POST http://localhost:54321/auth/v1/signup \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "263771234567@ndeip.local",
    "password": "TestPass123!",
    "data": {
      "phone": "+263771234567",
      "first_name": "John",
      "last_name": "Doe"
    }
  }'
```

#### Sign In

```bash
# Sign in with phone + password
curl -X POST http://localhost:54321/auth/v1/token?grant_type=password \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "263771234567@ndeip.local",
    "password": "TestPass123!"
  }'
```

### 2. PayNow Top-Up Flow

#### Initiate Top-Up

```bash
# Get JWT token from sign-in response first
export JWT_TOKEN="your-jwt-token"

# Initiate a $10 top-up
curl -X POST http://localhost:54321/functions/v1/paynowInitiateTopup \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "idempotency_key": "test-topup-001"
  }'
```

Expected Response:
```json
{
  "success": true,
  "transaction_id": "uuid-here",
  "reference": "TOPUP-20231208-ABC123",
  "browser_url": "https://www.paynow.co.zw/payment/...",
  "poll_url": "https://www.paynow.co.zw/interface/pollstatus?guid=...",
  "paynow_reference": "PN123456"
}
```

#### Simulate Webhook (Payment Confirmation)

```bash
# Simulate PayNow webhook callback
curl -X POST http://localhost:54321/functions/v1/paynowWebhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "reference=TOPUP-20231208-ABC123&paynowreference=PN123456&amount=10.00&status=Paid&pollurl=https://www.paynow.co.zw/interface/pollstatus&hash=test-signature"
```

Expected Response:
```json
{
  "success": true,
  "status": "completed",
  "message": "Webhook processed"
}
```

#### Verify Wallet Balance Updated

```bash
# Check wallet balance
curl -X GET "http://localhost:54321/rest/v1/wallets?user_id=eq.your-user-id" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "apikey: your-anon-key"
```

### 3. Ride Payment (QR Code Flow)

#### Setup Driver Session Token

```bash
# As driver, generate QR session token (in production, this is done via the app)
# The driver's QR code contains this session token
export DRIVER_SESSION_TOKEN="DRV_1702034567890_abcdef123456"
```

#### Passenger Pays via QR

```bash
# Passenger initiates payment after scanning QR
curl -X POST http://localhost:54321/functions/v1/createTransaction \
  -H "Authorization: Bearer $PASSENGER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_session_token": "DRV_1702034567890_abcdef123456",
    "amount": 5.00,
    "ride_id": "optional-ride-uuid",
    "tip_amount": 1.00,
    "idempotency_key": "ride-payment-001"
  }'
```

Expected Response:
```json
{
  "success": true,
  "transaction_id": "uuid-here",
  "reference": "RIDE-20231208-XYZ789",
  "passenger_new_balance": 4.00,
  "message": "Payment successful"
}
```

### 4. Driver Bank Details

#### Save Encrypted Bank Details

```bash
# As driver
curl -X POST "http://localhost:54321/rest/v1/driver_bank_details" \
  -H "Authorization: Bearer $DRIVER_JWT_TOKEN" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "driver_id": "driver-uuid",
    "bank_name_encrypted": "encrypted-value",
    "account_number_encrypted": "encrypted-value",
    "account_holder_name_encrypted": "encrypted-value",
    "branch_code_encrypted": "encrypted-value",
    "country": "ZWE",
    "currency": "USD"
  }'
```

### 5. Settlement Export (Admin Only)

#### Generate Settlement Batch

```bash
# As admin
curl -X POST http://localhost:54321/functions/v1/settleDriverPayout \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period": "daily",
    "dry_run": true
  }'
```

Expected Response (dry run):
```json
{
  "success": true,
  "batch_id": "BATCH-20231208-ABC123",
  "settlement_count": 5,
  "total_amount": 250.00,
  "csv_data": "Driver ID,Driver Name,...",
  "settlements": [
    {
      "driver_id": "uuid",
      "driver_name": "John Driver",
      "amount": 50.00,
      "transaction_count": 10
    }
  ],
  "message": "Dry run completed. No settlements created."
}
```

## Flutter App Tests

### Run Unit Tests

```bash
cd flutter_app
flutter test
```

### Run Integration Tests

```bash
flutter test integration_test/
```

### Test Specific Features

```bash
# Auth tests
flutter test test/auth_test.dart

# Wallet tests
flutter test test/wallet_test.dart
```

## Database Testing

### Reset Test Database

```bash
supabase db reset
```

### Run Migrations

```bash
supabase db push
```

### Seed Test Data

```sql
-- Insert test user
INSERT INTO users (phone, password_hash, first_name, last_name, role)
VALUES ('+263771234567', '$pbkdf2-sha256$...', 'Test', 'User', 'passenger');

-- Insert test driver
INSERT INTO users (phone, password_hash, first_name, last_name, role)
VALUES ('+263777654321', '$pbkdf2-sha256$...', 'Test', 'Driver', 'driver');
```

## PayNow Testing Mode

Set the following environment variable to enable mock responses:

```bash
supabase secrets set PAYNOW_DEV_MODE=true
```

In dev mode:
- `paynowInitiateTopup` returns mock PayNow URLs
- Webhooks can be simulated without signature verification
- No actual payments are processed

## Troubleshooting

### Common Issues

1. **Auth errors**: Ensure phone number is in E.164 format (+263...)
2. **Webhook failures**: Check PAYNOW_WEBHOOK_SECRET matches
3. **Encryption errors**: Verify BANK_DETAILS_ENCRYPTION_KEY is 32 bytes
4. **RLS errors**: Check user has correct role and permissions

### Logs

```bash
# View Edge Function logs
supabase functions logs paynowInitiateTopup

# View all logs
supabase logs
```

## Production Checklist

- [ ] Set SMS_DEV_MODE=false
- [ ] Set PAYNOW_DEV_MODE=false
- [ ] Configure real PayNow credentials
- [ ] Set secure BANK_DETAILS_ENCRYPTION_KEY
- [ ] Enable rate limiting
- [ ] Configure monitoring/alerts



