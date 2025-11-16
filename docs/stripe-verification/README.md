# Stripe Verification - Complete Documentation

**Status:** Production Ready ✅  
**Last Updated:** November 15, 2025  
**Version:** 1.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [API Reference](#api-reference)
4. [Implementation Details](#implementation-details)
5. [Environment Variables](#environment-variables)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Quick Start

### Prerequisites
- User must be authenticated (valid JWT token)
- User must NOT be from India (DigiLocker should be used for Indian users)
- Stripe account with Identity API access (optional - placeholder mode available)

### Complete Flow (2 Steps)

```bash
# 1. Create Stripe Identity verification session
curl -X POST http://localhost:3000/api/stripe-verification/create-session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Response:
# {
#   "success": true,
#   "verificationSessionId": "vs_1234567890abcdef",
#   "url": "https://verify.stripe.com/start/vs_1234567890abcdef",
#   "clientSecret": "vs_1234567890abcdef_secret_..."
# }

# 2. User completes verification on Stripe's page
# (User is redirected to the URL from step 1)

# 3. Verify the session result
curl -X POST http://localhost:3000/api/stripe-verification/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationSessionId": "vs_1234567890abcdef"
  }'

# Response:
# {
#   "success": true,
#   "message": "Stripe Identity verification successful",
#   "verificationStatus": "VERIFIED",
#   "verifiedData": { ... }
# }
```

---

## Overview

### What is Stripe Verification?

Stripe Verification uses Stripe Identity API to verify user identity for non-Indian users. It's an alternative to DigiLocker verification, which is specifically for Indian users.

### Why Stripe Verification?

- **International Support:** Available for users outside India
- **Compliance:** Stripe Identity handles KYC/AML requirements
- **User Experience:** Simple, guided verification flow
- **Security:** Industry-standard identity verification

### When to Use Stripe vs DigiLocker

| User Location | Verification Method |
|--------------|-------------------|
| India | DigiLocker (required) |
| Outside India | Stripe Identity (recommended) |

### Status Progression

```
REGISTERED / EMAIL_VERIFIED
    ↓
POST /create-session (get Stripe verification URL)
    ↓
User completes verification on Stripe
    ↓
POST /verify (check verification status)
    ↓
ID_VERIFIED (if successful)
    ↓
Ready for Video Verification
```

### Architecture

```
┌────────────────────────┐
│  Authenticated User    │
│  (Non-India)           │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ POST /create-session    │
│ • Creates Stripe session│
│ • Returns verification URL│
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ User Redirected to      │
│ Stripe Verification     │
│ • Uploads documents    │
│ • Completes verification│
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ POST /verify            │
│ • Checks session status │
│ • Updates user record   │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ User Status Updated     │
│ status = ID_VERIFIED    │
└────────────────────────┘
```

---

## API Reference

### 1. **POST** `/api/stripe-verification/create-session`

Create a Stripe Identity verification session. This generates a URL that the user will be redirected to for identity verification.

**Prerequisites:**
- Valid JWT token
- User must NOT be from India

**Request:**
No request body required

**Response (200 OK):**
```json
{
  "success": true,
  "verificationSessionId": "vs_1234567890abcdef",
  "url": "https://verify.stripe.com/start/vs_1234567890abcdef",
  "clientSecret": "vs_1234567890abcdef_secret_..."
}
```

**If user already verified:**
```json
{
  "success": true,
  "verificationSessionId": "already_verified",
  "url": ""
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | User is from India | Should use DigiLocker instead |
| 401 | Unauthorized | Missing or invalid token |
| 404 | User not found | User ID from token doesn't exist |
| 500 | Failed to create verification session | Stripe API error or internal error |

---

### 2. **POST** `/api/stripe-verification/verify`

Verify the status of a Stripe Identity verification session and update user verification status.

**Prerequisites:**
- Valid JWT token
- User must have created a verification session
- User must NOT be from India

**Request Body:**
```json
{
  "verificationSessionId": "vs_1234567890abcdef"
}
```

**Field Specifications:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| verificationSessionId | string | Yes | Session ID from `/create-session` response |

**Response (200 OK) - Verified:**
```json
{
  "success": true,
  "message": "Stripe Identity verification successful",
  "verificationStatus": "VERIFIED",
  "verifiedData": {
    "name": "John Doe",
    "dateOfBirth": "1990-01-15",
    "documentType": "passport",
    "documentNumber": "P123456789",
    "gender": "male",
    "country": "USA",
    "state": "California",
    "pincode": "90210",
    "addressLine1": "123 Main St",
    "addressLine2": "Apt 4B"
  }
}
```

**Response (200 OK) - Processing:**
```json
{
  "success": false,
  "message": "Verification is still processing. Please check again later.",
  "verificationStatus": "PENDING"
}
```

**Response (200 OK) - Requires Input:**
```json
{
  "success": false,
  "message": "Additional information required. Please complete the verification process.",
  "verificationStatus": "PENDING"
}
```

**Response (200 OK) - Failed/Rejected:**
```json
{
  "success": false,
  "message": "Verification canceled. Please try again.",
  "verificationStatus": "REJECTED"
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | User is from India | Should use DigiLocker instead |
| 400 | Invalid session | Session ID not found or invalid |
| 401 | Unauthorized | Missing or invalid token |
| 404 | User not found | User ID from token doesn't exist |
| 500 | Failed to verify session | Stripe API error or internal error |

---

### 3. **GET** `/api/stripe-verification/status`

Get Stripe verification status for the authenticated user.

**Prerequisites:**
- Valid JWT token

**Response (200 OK) - Verified:**
```json
{
  "success": true,
  "verified": true,
  "status": "VERIFIED",
  "method": "STRIPE_IDENTITY",
  "verifiedData": {
    "name": "John Doe",
    "dateOfBirth": "1990-01-15",
    "documentType": "passport"
  },
  "verifiedAt": "2025-11-15T23:00:00.000Z"
}
```

**Response (200 OK) - Not Started:**
```json
{
  "success": true,
  "verified": false,
  "status": "NOT_STARTED",
  "method": null,
  "verifiedData": null,
  "verifiedAt": null
}
```

**Response (200 OK) - Pending:**
```json
{
  "success": true,
  "verified": false,
  "status": "PENDING",
  "method": "STRIPE_IDENTITY",
  "verifiedData": null,
  "verifiedAt": null
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 401 | Unauthorized | Missing or invalid token |
| 500 | Failed to fetch status | Internal server error |

---

## Implementation Details

### Data Storage

The system stores Stripe verification data in the `UserVerification` table:

```typescript
UserVerification {
  id                // Unique identifier
  userId            // Foreign key to User (unique)
  method            // "STRIPE_IDENTITY"
  verifiedData      // JSON object with verified information
  verificationStatus // "PENDING", "VERIFIED", or "REJECTED"
  verified          // Boolean
  verifiedAt        // Timestamp when verified
  rejectionReason   // Optional rejection reason
  createdAt         // Record creation timestamp
  updatedAt         // Last update timestamp
}
```

### Verification Flow

1. **Create Session:**
   - User calls `/create-session`
   - System creates Stripe Identity verification session
   - Returns session URL and ID

2. **User Verification:**
   - User is redirected to Stripe's verification page
   - User uploads identity documents
   - Stripe processes verification

3. **Verify Session:**
   - User calls `/verify` with session ID
   - System checks Stripe session status
   - If verified, extracts verified data and updates user record
   - Updates `User.status` to `ID_VERIFIED`

### Stripe Session Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| `verified` | Verification successful | Update user to ID_VERIFIED |
| `processing` | Still processing | Return PENDING status |
| `requires_input` | Needs more info | Return PENDING status |
| `canceled` | User canceled | Return REJECTED status |
| `failed` | Verification failed | Return REJECTED status |

### Placeholder Mode

If `STRIPE_SECRET_KEY` is not configured or the `stripe` package is not installed, the system operates in placeholder mode:

- Creates fake session IDs
- Returns placeholder verification data
- Still updates user status (for development/testing)

**To enable real Stripe verification:**
1. Install Stripe package: `npm install stripe`
2. Set `STRIPE_SECRET_KEY` environment variable
3. Restart the application

---

## Environment Variables

### Required (for production)

```env
STRIPE_SECRET_KEY=sk_live_...  # Stripe secret key from dashboard
```

### Optional (for development)

```env
STRIPE_SECRET_KEY=sk_test_...  # Stripe test key for development
```

**Note:** If `STRIPE_SECRET_KEY` is not set, the system will use placeholder mode.

---

## Testing Guide

### Prerequisites

- Backend running: `npm run start:dev`
- Valid JWT token from authentication
- User account with country set (not India)
- Stripe account (optional - placeholder mode available)

### Quick Test (5 minutes)

```bash
# Set your token
TOKEN="your_jwt_token_here"

# 1. Create verification session
curl -X POST http://localhost:3000/api/stripe-verification/create-session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Save the verificationSessionId from response

# 2. Verify session (after user completes on Stripe)
curl -X POST http://localhost:3000/api/stripe-verification/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationSessionId": "vs_..."
  }'

# 3. Check status
curl -X GET http://localhost:3000/api/stripe-verification/status \
  -H "Authorization: Bearer $TOKEN"
```

### Using REST Client (VS Code)

Create `test-stripe-verification.http`:

```http
@baseUrl = http://localhost:3000
@token = your_jwt_token_here

### 1. Create Stripe verification session
POST {{baseUrl}}/api/stripe-verification/create-session
Authorization: Bearer {{token}}

### 2. Verify session (after user completes on Stripe)
POST {{baseUrl}}/api/stripe-verification/verify
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "verificationSessionId": "vs_1234567890abcdef"
}

### 3. Check status
GET {{baseUrl}}/api/stripe-verification/status
Authorization: Bearer {{token}}
```

### Testing with Placeholder Mode

If Stripe is not configured, the system will automatically use placeholder mode:

1. Create session returns fake session ID
2. Verify session returns placeholder data
3. User status is still updated to ID_VERIFIED

This is useful for:
- Development without Stripe account
- Testing the flow
- Local development

---

## Troubleshooting

### "User is from India" error

**Cause:** User's country is set to India  
**Fix:** 
- Indian users must use DigiLocker verification
- Update user's country if incorrect
- Use `/api/digilocker/initiate` instead

### "Stripe package not installed" warning

**Cause:** `stripe` npm package is not installed  
**Fix:** 
```bash
npm install stripe
```
Then restart the application.

### "STRIPE_SECRET_KEY not found" warning

**Cause:** Environment variable not set  
**Fix:**
- Set `STRIPE_SECRET_KEY` in `.env` file
- Use test key for development: `sk_test_...`
- Use live key for production: `sk_live_...`

### "Verification is still processing"

**Cause:** Stripe hasn't finished processing the verification  
**Fix:**
- Wait a few minutes
- Call `/verify` again
- Check Stripe dashboard for session status

### "Additional information required"

**Cause:** Stripe needs more information from the user  
**Fix:**
- User should return to Stripe verification page
- Complete any missing steps
- Call `/verify` again after completion

### Session not found

**Cause:** Invalid or expired session ID  
**Fix:**
- Create a new session with `/create-session`
- Use the new session ID for verification

### Placeholder mode when Stripe is configured

**Cause:** Stripe client failed to initialize  
**Fix:**
- Check `STRIPE_SECRET_KEY` is correct
- Verify Stripe package is installed: `npm list stripe`
- Check application logs for initialization errors

---

## FAQ

**Q: Do I need a Stripe account to use this?**  
A: For production, yes. For development/testing, placeholder mode is available.

**Q: How long does verification take?**  
A: Usually 1-5 minutes after user submits documents. Can take longer for manual review.

**Q: What documents are accepted?**  
A: Stripe Identity accepts passports, driver's licenses, and national ID cards depending on country.

**Q: Can I use this for Indian users?**  
A: No. Indian users must use DigiLocker verification. The API will reject requests from Indian users.

**Q: What happens if verification fails?**  
A: User can create a new session and try again. No limit on retries.

**Q: Is placeholder mode secure?**  
A: No. Placeholder mode is for development only. Always use real Stripe verification in production.

**Q: How do I get Stripe API keys?**  
A: 
1. Sign up at https://stripe.com
2. Go to Developers > API keys
3. Copy your secret key (starts with `sk_test_` or `sk_live_`)

**Q: What's the difference between test and live keys?**  
A: 
- Test keys (`sk_test_...`): For development, no real charges
- Live keys (`sk_live_...`): For production, real verifications

**Q: Can I test without real documents?**  
A: Yes, Stripe provides test mode with test document numbers. See Stripe documentation for test values.

**Q: What data is stored from Stripe?**  
A: Only verified data (name, DOB, document type, address) is stored in `verifiedData` JSON field. No sensitive document images are stored.

---

## Related Documentation

- [DigiLocker Verification](../digilocker/README.md) - Alternative for Indian users
- [Video Verification](../video-verification/README.md) - Next step after ID verification
- [User Onboarding](../USER_ONBOARDING.md) - Complete user journey
- [API Documentation Index](../INDEX.md) - All API endpoints

---

## Stripe Identity Resources

- [Stripe Identity Documentation](https://stripe.com/docs/identity)
- [Stripe Identity API Reference](https://stripe.com/docs/api/identity/verification_sessions)
- [Stripe Test Cards & Data](https://stripe.com/docs/testing)

---

**Support:** Contact backend team for Stripe verification issues

