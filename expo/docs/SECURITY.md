# How Far - Security Documentation

## Overview

This document outlines the security measures implemented in the How Far app to protect user data, prevent fraud, and ensure safe financial transactions.

---

## 🔐 Authentication Security

### Phone + Password Authentication
- **Password Hashing**: PBKDF2-SHA256 with 100,000 iterations
- **Salt**: 16 bytes of cryptographically random data per password
- **Constant-time comparison**: Prevents timing attacks

### Session Management
- JWT tokens with automatic refresh
- Sessions persist securely via AsyncStorage
- Token expiry: 1 hour (configurable)

### Admin PIN Security
- 6-digit PIN required for all payment operations
- PIN stored as SHA-256 hash
- Failed attempts logged to audit trail
- Lockout after 5 failed attempts (recommended)

---

## 💳 Payment Security

### Encryption at Rest
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Length**: 256 bits
- **IV**: 96 bits, randomly generated per encryption
- **Data Protected**:
  - Bank account numbers
  - Account holder names
  - Branch codes

### Transaction Security
- **Idempotency keys**: Prevent duplicate transactions
- **Reference tracking**: Unique references for all transactions
- **Audit trail**: All financial operations logged

### Settlement Security
- Admin approval required for all payouts
- PIN verification before payment processing
- Real-time audit logging
- Batch processing with reconciliation

---

## 🛡️ Database Security (Supabase RLS)

### Row Level Security Policies
All tables have RLS enabled with the following patterns:

| Table | Policy |
|-------|--------|
| users | Users can only read/update their own data |
| wallets | Users can only view their own wallet |
| transactions | Users see only their transactions |
| drivers | Drivers can update their own profile |
| daily_settlements | Admins only |
| admin_audit_log | Admins only |

### Service Role Usage
- Service role key only used in Edge Functions
- Never exposed to client
- Used for admin operations that bypass RLS

---

## 🔒 API Security

### Edge Functions
- All functions require valid JWT authentication
- CORS headers properly configured
- Input validation on all endpoints
- Rate limiting (recommended via Supabase)

### Admin Endpoints
- Double authentication: JWT + PIN
- Role verification from database
- All actions logged with IP address

---

## 🚨 Fraud Prevention

### Transaction Limits
- Daily top-up limit: $10,000 (configurable)
- Per-transaction limits
- Velocity checks (recommended)

### Settlement Safeguards
- 24-hour delay between ride and settlement
- Manual admin approval required
- Batch processing prevents individual manipulation
- Complete audit trail

### Monitoring
- All admin actions logged
- Failed login attempts tracked
- Suspicious activity alerts (recommended)

---

## 📱 Mobile App Security

### Data Storage
- Sensitive data stored in AsyncStorage (encrypted on iOS)
- No PII stored in plain text
- Session tokens auto-expire

### Network Security
- All communication over HTTPS
- Certificate pinning (recommended)
- No sensitive data in URLs

### Code Security
- No hardcoded secrets
- Environment variables for all config
- API keys stored securely

---

## 🔑 Secrets Management

### Required Secrets (Supabase)
```
SUPABASE_URL                    # Supabase project URL
SUPABASE_ANON_KEY              # Public anon key
SUPABASE_SERVICE_ROLE_KEY      # Service role key (Edge Functions only)
BANK_DETAILS_ENCRYPTION_KEY    # 32-byte AES key (base64)
ECOCASH_MERCHANT_CODE          # EcoCash integration
ECOCASH_API_KEY                # EcoCash API key
PAYNOW_INTEGRATION_ID          # Paynow integration
PAYNOW_INTEGRATION_KEY         # Paynow key
CRON_SECRET_TOKEN              # For scheduled jobs
```

### Generating Encryption Key
```bash
# Generate 32-byte key
openssl rand -base64 32
```

---

## ✅ Security Checklist

### Before Launch
- [ ] All secrets set in production Supabase
- [ ] RLS policies tested
- [ ] Admin accounts created with secure PINs
- [ ] Audit logging verified
- [ ] Rate limiting configured
- [ ] Error messages don't leak information
- [ ] SSL/TLS certificates valid
- [ ] Penetration testing completed

### Ongoing
- [ ] Regular security audits
- [ ] Monitor audit logs weekly
- [ ] Rotate encryption keys annually
- [ ] Update dependencies monthly
- [ ] Review failed login attempts
- [ ] Check for unusual transaction patterns

---

## 🆘 Incident Response

### If Data Breach Suspected
1. Immediately disable affected admin accounts
2. Rotate all API keys and secrets
3. Review audit logs for unauthorized access
4. Notify affected users within 72 hours
5. Report to relevant authorities if required

### Contact
- Security issues: [security@howfar.app]
- Emergency: [Contact admin team]

---

## 📚 Compliance

### GDPR Considerations
- User data deletion on request
- Data export capability
- Privacy policy accessible
- Consent management

### PCI DSS Considerations
- No card data stored
- Payment processing via Paynow/EcoCash
- Encryption of financial data
- Access controls in place

---

*Last Updated: December 2024*

