# DigiLocker Verification - Complete Documentation

**Status:** Production Ready ✅  
**Last Updated:** November 16, 2025  
**Version:** 2.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [API Reference](#api-reference)
4. [Frontend Integration](#frontend-integration)
5. [Implementation Details](#implementation-details)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

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
  - `FRONTEND_URL` (for redirect URI)

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

# 6. User completes DigiLocker auth in browser
# (Redirects back to ${FRONTEND_URL}/digilocker/callback)

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
- **Automatic redirect back to your webpage after completion**

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
│  • Initiate              │
│  • Redirect to DigiLocker│
│  • User authenticates     │
│  • Redirects back to app  │
│  • Callback processing    │
│  • Complete with data    │
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

Initiates DigiLocker verification flow and generates consent URL with redirect URI.

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

**Important:** 
- Store `verificationId` in sessionStorage before redirecting
- Redirect user to `consentUrl`
- After DigiLocker completion, user will be redirected to `${FRONTEND_URL}/digilocker/callback`

**Error Responses:**
| Status | Error |
|--------|-------|
| 400 | Invalid mobile number or user not email verified |
| 400 | User country not India |
| 409 | DigiLocker account already verified |
| 500 | Cashfree API error |

---

### 2. **POST** `/api/digilocker/callback`

Process callback after user authenticates in DigiLocker and is redirected back.

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

**Frontend Integration:**
See [Frontend Integration](#frontend-integration) section below for complete React/Vue/Angular examples.

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
  "timestamp": "2025-11-16T23:00:00.000Z",
  "service": "DigiLocker Verification",
  "status": "operational"
}
```

---

## Frontend Integration

### Step 1: Create Callback Page

Create a page at `/digilocker/callback` in your frontend. This is where DigiLocker will redirect users after completion.

**React Example:**
```javascript
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function DigiLockerCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing DigiLocker response...');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {async processCallback(
    userId: string,
    dto: ProcessDigiLockerCallbackDto,
  ): Promise<DigiLockerCallbackResponseDto> {
    this.logger.log(
      `Processing DigiLocker callback for user: ${userId}, verification: ${dto.verificationId}`,
    );

    try {
      // Ensure caller is eligible for DigiLocker (India-only)
      const caller = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!caller) throw new BadRequestException('User not found');
      if (caller.country && caller.country.toLowerCase() !== 'india') {
        this.logger.warn(`User ${userId} attempted DigiLocker callback but country is ${caller.country}`);
        throw new BadRequestException(
          'DigiLocker verification is available only for users in India. Please use Stripe verification for users outside India.',
        );
      }

      // Get verification session
      const session = await this.prisma.digiLockerVerificationSession.findUnique({
        where: { verificationId: dto.verificationId },
      });

      if (!session || session.userId !== userId) {
        throw new BadRequestException('Invalid verification session');
      }

      // Check status with Cashfree
      const statusResult = await this.getDigiLockerVerificationStatus(
        dto.verificationId,
      );

      // Update session status
      await this.prisma.digiLockerVerificationSession.update({
        where: { verificationId: dto.verificationId },
        data: {
          status:
            statusResult.status === 'AUTHENTICATED'
              ? 'AUTHENTICATED'
              : 'PENDING',
        },
      });

      return {
        success: statusResult.status === 'AUTHENTICATED',
        status: statusResult.status as VerificationStatus,
        readyForComparison: statusResult.status === 'AUTHENTICATED',
        message:
          statusResult.status === 'AUTHENTICATED'
            ? 'DigiLocker verification successful. Ready for comparison.'
            : 'Verification still pending.',
      };
    } catch (error) {
      this.logger.error(`Error processing callback: ${error.message}`);
      throw error;
    }
  }
      // Get verificationId from URL params OR sessionStorage
      const verificationId = searchParams.get('verification_id') 
                         || sessionStorage.getItem('digilockerVerificationId');

      if (!verificationId) {
        setStatus('error');
        setMessage('Verification session not found. Please start over.');
        setTimeout(() => navigate('/verify'), 3000);
        return;
      }

      // Get auth token
      const token = localStorage.getItem('authToken');
      if (!token) {
        setStatus('error');
        setMessage('Please login to continue');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // Call backend callback endpoint
      const response = await fetch('http://localhost:3000/api/digilocker/callback', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ verificationId })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus('error');
        setMessage(data.message || 'DigiLocker authentication failed');
        setTimeout(() => navigate('/verify'), 3000);
        return;
      }

      // Check if ready for data comparison
      if (data.status === 'AUTHENTICATED' && data.readyForComparison) {
        setStatus('success');
        setMessage('DigiLocker authenticated! Redirecting to data entry...');
        
        // Redirect to data entry form after 1.5 seconds
        setTimeout(() => {
          navigate('/verify/enter-data', { 
            state: { verificationId } 
          });
        }, 1500);
      } else {
        setStatus('error');
        setMessage('Verification incomplete. Please try again.');
        setTimeout(() => navigate('/verify'), 3000);
      }

    } catch (error) {
      setStatus('error');
      setMessage(`Error: ${error.message}`);
      setTimeout(() => navigate('/verify'), 3000);
    }
  }

  return (
    <div className="callback-container">
      {status === 'processing' && (
        <div>
          <div className="spinner"></div>
          <p>{message}</p>
        </div>
      )}
      {status === 'success' && (
        <div className="success">
          <p>✓ {message}</p>
        </div>
      )}
      {status === 'error' && (
        <div className="error">
          <p>✗ {message}</p>
        </div>
      )}
    </div>
  );
}
```

### Step 2: Store VerificationId When Initiating

```javascript
// When calling POST /api/digilocker/initiate
async function startDigiLockerVerification(mobileNumber) {
  const response = await fetch('/api/digilocker/initiate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ mobileNumber })
  });

  const data = await response.json();
  
  // Store verificationId for callback page
  sessionStorage.setItem('digilockerVerificationId', data.verificationId);
  
  // Redirect user to DigiLocker
  window.location.href = data.consentUrl;
}
```

### Step 3: Handle URL Parameters

DigiLocker may append query parameters to the redirect URL:
- `verification_id`: The verification ID
- `status`: Verification status
- `error`: Error message (if any)

Extract these from the URL:
```javascript
const urlParams = new URLSearchParams(window.location.search);
const verificationId = urlParams.get('verification_id');
const status = urlParams.get('status');
const error = urlParams.get('error');
```

**Important Notes:**
- The redirect URI is configured in the backend: `${FRONTEND_URL}/digilocker/callback`
- Make sure `FRONTEND_URL` environment variable is set correctly
- The callback page must be accessible (handle auth redirect if needed)
- Always validate the verificationId before calling the backend
- Clear sessionStorage after successful verification

---

## Implementation Details

### Redirect URI Configuration

The backend automatically configures the redirect URI when creating the consent URL:
- Format: `${FRONTEND_URL}/digilocker/callback`
- Default: `http://localhost:3000/digilocker/callback` (if `FRONTEND_URL` not set)
- Must be whitelisted in Cashfree Dashboard (if required)

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
2. Set `FRONTEND_URL` in `.env`: `FRONTEND_URL=http://localhost:3000`
3. Create callback page at `/digilocker/callback`
4. Follow the flow from initiate → DigiLocker → callback → complete

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

### "Redirect not working"

**Cause:** `FRONTEND_URL` not set or callback page not created  
**Fix:** 
- Set `FRONTEND_URL` in `.env`
- Create callback page at `/digilocker/callback`
- Whitelist redirect URI in Cashfree Dashboard

### "x-cf-signature missing" or "Signature mismatch"

**Cause:** Invalid public key or timestamp  
**Fix:** 
- Verify `CASHFREE_PUBLIC_KEY` is correct in `.env`
- Check Cashfree credentials are valid
- Review backend logs for signature generation errors

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

**Q: Where does DigiLocker redirect after completion?**  
A: To `${FRONTEND_URL}/digilocker/callback` - make sure this page exists and handles the callback.

**Q: Where is DigiLocker data stored?**  
A: Only comparison result and verified fields are stored in `UserVerification`. Raw Aadhaar data is not persisted.

**Q: What if DigiLocker is down?**  
A: Return 503 Service Unavailable error and suggest user try again later.

---

## Related Documentation

- [User Onboarding Guide](../USER_ONBOARDING.md) - Complete onboarding flow
- [Video Verification](../video-verification/README.md) - Next verification step
- [API Documentation Index](../INDEX.md) - All API endpoints

---

**Support:** Contact backend team for DigiLocker issues
