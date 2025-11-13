# DigiLocker Verification - Complete Documentation

**Status:** Production Ready ✅  
**Last Updated:** November 13, 2025  
**Version:** 1.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [API Reference](#api-reference)
4. [Implementation Details](#implementation-details)
5. [Testing Guide](#testing-guide)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Quick Start

### Prerequisites
- Backend running: `npm run start:dev`
- User must complete email verification first
- User must select country (India for DigiLocker)
- Environment variables configured:
  - `CASHFREE_API_KEY`
  - `CASHFREE_API_SECRET`
  - `CASHFREE_BASE_URL` (sandbox or production)
  - `CASHFREE_PUBLIC_KEY`

### Complete Flow (7 Steps)

```bash
# 1. Register & verify email
http POST http://localhost:3000/auth/send-otp \
  email=user@example.com username=testuser

# 2. Get OTP (dev only)
http GET http://localhost:3000/auth/debug/otp \
  email==user@example.com

# 3. Verify OTP
http POST http://localhost:3000/auth/verify-otp \
  email=user@example.com otp=123456

# 4. Select country
http POST http://localhost:3000/auth/select-country \
  Authorization:"Bearer YOUR_TOKEN" \
  country=India

# 5. Initiate DigiLocker
http POST http://localhost:3000/api/digilocker/initiate \
  Authorization:"Bearer YOUR_TOKEN" \
  mobileNumber=9876543210

# 6. Open consentUrl in browser, complete DigiLocker auth
# (This is done by user in browser)

# 7. Callback after authentication
http POST http://localhost:3000/api/digilocker/callback \
  Authorization:"Bearer YOUR_TOKEN" \
  verificationId=VER_...

# 8. Complete with data comparison
http POST http://localhost:3000/api/digilocker/complete \
  Authorization:"Bearer YOUR_TOKEN" \
  verificationId=VER_... \
  userProvidedData:='{...}'
```

---

## Overview

### What is DigiLocker Verification?

DigiLocker is an Aadhaar-based digital locker service by the Government of India. Our integration allows users to:
- Verify identity using their Aadhaar
- Link Aadhaar data with their account
- Ensure data matches before completion

### Architecture

```
┌─────────────────┐
│   User Account  │
│  (Email Verified)
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  Select Country (India)   │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ DigiLocker Verification  │
│  (This flow)             │
│  • Initiate              │
│  • Authenticate          │
│  • Complete              │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│   ID_VERIFIED Status     │
│   (Ready for Video)       │
└──────────────────────────┘
```

### Status Progression

- `REGISTERED` → `EMAIL_VERIFIED` → `ID_VERIFIED` → `VIDEO_VERIFIED` (next step)

---

## API Reference

### 1. **POST** `/api/digilocker/initiate`

Initiates DigiLocker verification flow.

**Request:**
```json
{
  "mobileNumber": "9876543210"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "accountExists": true,
  "consentUrl": "https://verification-test.cashfree.com/dgl/...",
  "verificationId": "VER_1702650000000_ABC123",
  "flowType": "signin",
  "message": "DigiLocker account found. Please complete verification."
}
```

**Error Responses:**
| Status | Error |
|--------|-------|
| 400 | Invalid mobile number or user not ID verified |
| 400 | User country not India |
| 409 | DigiLocker account already verified |
| 500 | Cashfree API error |

---

### 2. **POST** `/api/digilocker/callback`

Process callback after user authenticates in DigiLocker.

**Request:**
```json
{
  "verificationId": "VER_1702650000000_ABC123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": "AUTHENTICATED",
  "readyForComparison": true,
  "message": "DigiLocker verification successful. Ready for comparison."
}
```

**Status Values:**
| Status | Meaning |
|--------|---------|
| AUTHENTICATED | User completed DigiLocker auth |
| PENDING | Still authenticating |
| EXPIRED | Session expired (>24 hours) |
| CONSENT_DENIED | User rejected document sharing |

---

### 3. **POST** `/api/digilocker/complete`

Complete verification by comparing user data with DigiLocker.

**Request:**
```json
{
  "verificationId": "VER_1702650000000_ABC123",
  "userProvidedData": {
    "nameAsPerAadhaar": "JOHN DOE",
    "dateOfBirth": "1990-05-15",
    "gender": "Male",
    "country": "India",
    "state": "Maharashtra",
    "district": "Mumbai",
    "pincode": "400001",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apartment 4B"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Identity verification completed successfully",
  "verified": true,
  "comparisonDetails": {
    "nameMatch": true,
    "dobMatch": true,
    "genderMatch": true,
    "stateMatch": true,
    "pincodeMatch": true,
    "mismatches": []
  }
}
```

On success:
- `UserVerification.verified` = `true`
- `User.status` = `ID_VERIFIED`
- User can now proceed to video verification

---

### 4. **GET** `/api/digilocker/status/:verificationId`

Get current verification status.

**Response:**
```json
{
  "status": "AUTHENTICATED",
  "readyForComparison": true,
  "message": "Ready for data comparison"
}
```

---

### 5. **GET** `/api/digilocker/user-status`

Get user's overall verification status.

**Response:**
```json
{
  "success": true,
  "verified": true,
  "verificationType": "DIGILOCKER",
  "message": "User is verified"
}
```

---

### 6. **GET** `/api/digilocker/health`

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-11-13T23:00:00.000Z",
  "service": "DigiLocker Verification",
  "status": "operational"
}
```

---

## Implementation Details

### Country Gating

DigiLocker verification is **India-only**. Server-side checks ensure:
- User must have `user.country === 'India'`
- Non-Indian users receive 400 error with Stripe Identity redirect
- Checks in: `initiateVerification()`, `processCallback()`, `completeVerification()`

### Cashfree Signature

Cashfree requires `x-cf-signature` on all requests:
- **Algorithm:** RSA OAEP-SHA1
- **Data:** `${clientId}.${timestamp}`
- **Output:** Base64 encoded
- **Implementation:** `getCashfreeSignature()` in `src/utils/cashfree/public-key.ts`

### Session Management

- **Expiration:** 24 hours from creation
- **Auto-cleanup:** Via `/api/digilocker/admin/cleanup-expired`
- **Status:** INITIATED → AUTHENTICATED → SUCCESS

### Data Comparison Logic

Compares these critical fields (all must match):
1. **Name** - Case insensitive, special chars ignored
2. **DOB** - Converted to ISO format (YYYY-MM-DD)
3. **Gender** - Normalized (M/F/Other)
4. **State** - Whitespace & special chars removed
5. **Pincode** - Exact match (6 digits)

---

## Testing Guide

### Quick Test (5 minutes)

1. Start backend: `npm run start:dev`
2. Run test script: `bash test-digilocker.sh`
3. Follow prompts to complete flow

### Manual Test

Use `DIGILOCKER_TEST_FLOW.http` file in VS Code REST Client:
```
# Install REST Client extension
# Open file in VS Code
# Click "Send Request" on each step
```

### Test Data

```
Email: testuser@example.com
Username: testuser123
OTP (dev): 123456
Mobile: 9876543210
Country: India

Aadhaar Data (Example):
- Name: JOHN DOE
- DOB: 1990-05-15
- Gender: Male
- State: Maharashtra
- Pincode: 400001
```

---

## Troubleshooting

### "Please select your country before starting ID verification"

**Cause:** User hasn't selected country  
**Fix:** Call `POST /auth/select-country` with `country=India`

### "DigiLocker verification is available only for users in India"

**Cause:** `user.country` is not "India"  
**Fix:** Update user's country to India before initiating

### "Data mismatch"

**Cause:** User-provided data doesn't match Aadhaar  
**Fix:** Verify exact spelling, DOB format, gender selection, pincode

### "Account already verified"

**Cause:** DigiLocker account is linked to another user  
**Fix:** Use different mobile number

### "x-cf-signature missing" or "Signature mismatch"

**Cause:** Invalid public key or timestamp  
**Fix:** 
- Verify `CASHFREE_PUBLIC_KEY` is correct in `.env`
- Check Cashfree credentials are valid
- Review backend logs for signature generation errors

### "404 Route Not Found" from Cashfree

**Cause:** Endpoint path or base URL mismatch  
**Fix:**
- Verify `CASHFREE_BASE_URL` matches Cashfree docs
- Check endpoint: `/verification/digilocker/document/{type}?verification_id=...`
- Review debug logs for exact request URL

---

## FAQ

**Q: Can non-Indian users use DigiLocker?**  
A: No. Non-Indian users must use Stripe Identity verification. This is enforced server-side.

**Q: How long is a verification session valid?**  
A: 24 hours from creation. After that, user must initiate a new session.

**Q: Can a user verify multiple times?**  
A: If already verified, system returns success but won't re-verify. To change verification, use admin endpoints.

**Q: What documents are supported?**  
A: Currently only Aadhaar. PAN and Driving License support can be added.

**Q: Is there automatic face detection?**  
A: No, currently manual admin review. ML integration for auto-detection is TODO.

**Q: Where is DigiLocker data stored?**  
A: Only comparison result and verified fields are stored in `UserVerification`. Raw Aadhaar data is not persisted.

**Q: What if DigiLocker is down?**  
A: Return 503 Service Unavailable error and suggest user try again later.

---

## Related Documentation

- [Video Verification](../video-verification/README.md) - Next verification step
- [Complete Verification Flow](../guides/COMPLETE_VERIFICATION_FLOW.md) - Full user journey
- [API Documentation Index](../INDEX.md) - All API endpoints

---

**Support:** Contact backend team for DigiLocker issues
