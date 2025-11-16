# User Onboarding Guide - Complete Flow

**Last Updated:** November 16, 2025  
**Version:** 2.0  
**Status:** Production Ready ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Flow Diagram](#complete-flow-diagram)
3. [Step-by-Step Guide](#step-by-step-guide)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Frontend Integration](#frontend-integration)
6. [Status Progression](#status-progression)
7. [Error Handling](#error-handling)
8. [Testing Guide](#testing-guide)

---

## Overview

WiseIn uses a **7-step onboarding process** to ensure all users are verified and authenticated before accessing the platform. The flow progresses from email verification through ID verification, video verification, admin approval, and finally subscription/payment.

### User Status Progression

```
REGISTERED → EMAIL_VERIFIED → ID_VERIFIED → VIDEO_VERIFIED → ADMIN_APPROVED → ACTIVE
```

### Prerequisites

- Backend server running (`npm run start:dev`)
- Database configured and migrated
- Environment variables set (see `.env.example`)
- Frontend application ready

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER ONBOARDING FLOW                          │
└─────────────────────────────────────────────────────────────────┘

Step 1: Email Registration & Verification
  ├─ POST /auth/send-otp (email, username)
  ├─ GET /auth/debug/otp?email=... (dev only)
  └─ POST /auth/verify-otp (email, otp)
      ↓
      Status: EMAIL_VERIFIED
      Returns: accessToken, refreshToken

Step 2: Country Selection
  └─ POST /auth/select-country (country)
      ↓
      Country stored in user profile

Step 3: ID Verification (Choose One)
  
  Option A: DigiLocker (India Only)
    ├─ POST /api/digilocker/initiate (mobileNumber)
    ├─ User redirected to DigiLocker consent URL
    ├─ DigiLocker redirects to ${FRONTEND_URL}/digilocker/callback
    ├─ POST /api/digilocker/callback (verificationId)
    └─ POST /api/digilocker/complete (verificationId, userProvidedData)
        ↓
        Status: ID_VERIFIED

  Option B: Stripe Identity (Non-India)
    ├─ POST /auth/stripe-identity/create-session
    ├─ User completes Stripe Identity flow
    └─ POST /auth/stripe-identity/verify (verificationSessionId)
        ↓
        Status: ID_VERIFIED

Step 4: Video Verification
  ├─ POST /api/video-verification/initiate
  ├─ User records video (client-side)
  ├─ Upload video to storage (S3/Cloudinary)
  └─ POST /api/video-verification/submit (sessionId, videoUrl, metadata)
      ↓
      Status: VIDEO_VERIFIED (pending admin review)

Step 5: Admin Review
  ├─ GET /api/admin/users/pending (admin only)
  ├─ GET /api/admin/users/:id (admin only)
  ├─ POST /api/admin/users/:id/approve (admin only)
  └─ (OR) POST /api/admin/users/:id/reject (admin only)
      ↓
      Status: ADMIN_APPROVED (if approved)

Step 6: Subscription Selection
  ├─ GET /auth/subscription/plans
  └─ POST /auth/subscription/select-plan (planId)
      ↓
      Plan selected

Step 7: Payment & Activation
  ├─ POST /api/payment/order (amount, currency, phone)
  ├─ User redirected to payment URL
  ├─ Payment webhook: POST /api/payment/webhook
  └─ GET /api/payment/status/:orderId
      ↓
      Status: ACTIVE
      User can access platform
```

---

## Step-by-Step Guide

### Step 1: Email Registration & Verification

**Purpose:** Create user account and verify email address

#### 1.1 Send OTP

**Endpoint:** `POST /auth/send-otp`

**Request:**
```json
{
  "email": "user@example.com",
  "username": "johndoe"
}
```

**Response (200):**
```json
{
  "message": "OTP sent to your email",
  "status": 200
}
```

**Frontend Implementation:**
```javascript
async function sendOTP(email, username) {
  const response = await fetch('http://localhost:3000/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username })
  });
  return response.json();
}
```

#### 1.2 Get OTP (Development Only)

**Endpoint:** `GET /auth/debug/otp?email=user@example.com`

**Response (200):**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Note:** Only available in development mode.

#### 1.3 Verify OTP

**Endpoint:** `POST /auth/verify-otp`

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "userId": "clxyz123...",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Email verified successfully"
}
```

**Important:**
- Store `accessToken` and `refreshToken` securely
- Use `accessToken` in `Authorization: Bearer <token>` header for all protected endpoints
- `accessToken` expires in 7 days
- `refreshToken` expires in 30 days

**Frontend Implementation:**
```javascript
async function verifyOTP(email, otp) {
  const response = await fetch('http://localhost:3000/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  
  const data = await response.json();
  
  // Store tokens
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('userId', data.userId);
  
  return data;
}
```

**Status After Step 1:** `EMAIL_VERIFIED`

---

### Step 2: Country Selection

**Purpose:** Set user's country for region-specific features (payment methods, plans, ID verification)

**Endpoint:** `POST /auth/select-country`

**Request:**
```json
{
  "country": "India"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Country selected successfully"
}
```

**Frontend Implementation:**
```javascript
async function selectCountry(country, token) {
  const response = await fetch('http://localhost:3000/auth/select-country', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ country })
  });
  return response.json();
}
```

**Important:**
- Must be called before ID verification
- Determines which ID verification method is available:
  - **India:** DigiLocker
  - **Other countries:** Stripe Identity

---

### Step 3: ID Verification

Choose the appropriate method based on user's country.

#### Option A: DigiLocker (India Only)

**Purpose:** Verify identity using Aadhaar via DigiLocker

##### 3A.1 Initiate DigiLocker Verification

**Endpoint:** `POST /api/digilocker/initiate`

**Request:**
```json
{
  "mobileNumber": "9876543210"
}
```

**Response (200):**
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

**Frontend Implementation:**
```javascript
async function initiateDigiLocker(mobileNumber, token) {
  const response = await fetch('http://localhost:3000/api/digilocker/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ mobileNumber })
  });
  
  const data = await response.json();
  
  // Store verificationId for callback
  sessionStorage.setItem('digilockerVerificationId', data.verificationId);
  
  // Redirect user to DigiLocker
  window.location.href = data.consentUrl;
  
  return data;
}
```

##### 3A.2 Handle DigiLocker Callback

**Endpoint:** `POST /api/digilocker/callback`

**Note:** DigiLocker automatically redirects to `${FRONTEND_URL}/digilocker/callback` after user completes authentication.

**Request:**
```json
{
  "verificationId": "VER_1702650000000_ABC123"
}
```

**Response (200):**
```json
{
  "success": true,
  "status": "AUTHENTICATED",
  "readyForComparison": true,
  "message": "DigiLocker verification successful. Ready for comparison."
}
```

**Frontend Callback Page Implementation:**
```javascript
// In /digilocker/callback page
async function handleDigiLockerCallback() {
  // Get verificationId from URL params or sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const verificationId = urlParams.get('verification_id') 
                      || sessionStorage.getItem('digilockerVerificationId');
  
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3000/api/digilocker/callback', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ verificationId })
  });
  
  const data = await response.json();
  
  if (data.success && data.readyForComparison) {
    // Redirect to data entry form
    navigate('/verify/enter-data', { state: { verificationId } });
  }
}
```

##### 3A.3 Complete DigiLocker Verification

**Endpoint:** `POST /api/digilocker/complete`

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

**Response (200):**
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

**Status After Step 3A:** `ID_VERIFIED`

#### Option B: Stripe Identity (Non-India)

**Purpose:** Verify identity using Stripe Identity for international users

##### 3B.1 Create Stripe Identity Session

**Endpoint:** `POST /auth/stripe-identity/create-session`

**Request:**
```json
{}
```

**Response (200):**
```json
{
  "sessionId": "vs_1234567890",
  "clientSecret": "pi_1234567890_secret_...",
  "url": "https://verify.stripe.com/start/..."
}
```

##### 3B.2 Verify Stripe Identity

**Endpoint:** `POST /auth/stripe-identity/verify`

**Request:**
```json
{
  "verificationSessionId": "vs_1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "verified": true,
  "message": "Identity verified successfully"
}
```

**Status After Step 3B:** `ID_VERIFIED`

---

### Step 4: Video Verification

**Purpose:** Record and submit verification video for admin review

#### 4.1 Initiate Video Session

**Endpoint:** `POST /api/video-verification/initiate`

**Request:**
```json
{}
```

**Response (200):**
```json
{
  "sessionId": "VID_1702650000000_ABC123",
  "expiresAt": "2025-11-17T10:30:00.000Z",
  "instructions": {
    "maxDuration": 30,
    "acceptedFormats": ["mp4", "webm"],
    "maxSize": 10485760
  }
}
```

#### 4.2 Submit Video

**Endpoint:** `POST /api/video-verification/submit`

**Request:**
```json
{
  "sessionId": "VID_1702650000000_ABC123",
  "videoUrl": "https://storage.example.com/videos/video123.mp4",
  "videoDuration": 28,
  "videoFormat": "mp4",
  "videoSize": 5242880
}
```

**Response (200):**
```json
{
  "success": true,
  "status": "PENDING",
  "message": "Video submitted for review"
}
```

**Frontend Implementation:**
```javascript
// 1. Record video using MediaRecorder API
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
const mediaRecorder = new MediaRecorder(stream);
const chunks = [];

mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'video/mp4' });
  
  // 2. Upload to storage (S3, Cloudinary, etc.)
  const videoUrl = await uploadToStorage(blob);
  
  // 3. Submit to backend
  await submitVideo(sessionId, videoUrl, metadata);
};

// 4. Check status
async function checkVideoStatus(token) {
  const response = await fetch('http://localhost:3000/api/video-verification/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}
```

**Status After Step 4:** `VIDEO_VERIFIED` (pending admin review)

---

### Step 5: Admin Review

**Purpose:** Admin reviews and approves/rejects user verification

**Note:** These endpoints are admin-only and require `ADMIN` role.

#### 5.1 Get Pending Users

**Endpoint:** `GET /api/admin/users/pending`

**Response (200):**
```json
{
  "success": true,
  "count": 5,
  "users": [
    {
      "id": "user123",
      "email": "user@example.com",
      "status": "VIDEO_VERIFIED",
      "videoUrl": "https://...",
      "submittedAt": "2025-11-16T10:00:00.000Z"
    }
  ]
}
```

#### 5.2 Get User Details

**Endpoint:** `GET /api/admin/users/:id`

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "status": "VIDEO_VERIFIED",
    "videoUrl": "https://...",
    "verification": { ... }
  }
}
```

#### 5.3 Approve User

**Endpoint:** `POST /api/admin/users/:id/approve`

**Response (200):**
```json
{
  "success": true,
  "message": "User approved successfully"
}
```

#### 5.4 Reject User

**Endpoint:** `POST /api/admin/users/:id/reject`

**Request:**
```json
{
  "reason": "Video quality insufficient"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User rejected"
}
```

**Status After Step 5 (if approved):** `ADMIN_APPROVED`

---

### Step 6: Subscription Selection

**Purpose:** User selects subscription plan

#### 6.1 Get Available Plans

**Endpoint:** `GET /auth/subscription/plans`

**Response (200):**
```json
{
  "plans": {
    "individualPlans": [
      {
        "id": "individual_monthly",
        "name": "Individual Monthly",
        "price": 99,
        "currency": "INR",
        "billing": "monthly"
      }
    ],
    "companyPlans": [
      {
        "id": "company_monthly",
        "name": "Company Monthly",
        "price": 499,
        "currency": "INR",
        "billing": "monthly"
      }
    ]
  }
}
```

#### 6.2 Select Plan

**Endpoint:** `POST /auth/subscription/select-plan`

**Request:**
```json
{
  "planId": "individual_monthly"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Plan selected successfully"
}
```

---

### Step 7: Payment & Activation

**Purpose:** Process payment and activate user account

#### 7.1 Create Payment Order

**Endpoint:** `POST /api/payment/order`

**Request:**
```json
{
  "amount": 1000,
  "currency": "INR",
  "phone": "9876543210"
}
```

**Response (200):**
```json
{
  "success": true,
  "orderId": "order_1763236527549",
  "payment_session_id": "session_...",
  "paymentUrl": "https://payments-test.cashfree.com/order/#session_...",
  "data": { ... }
}
```

**Frontend Implementation:**
```javascript
async function createPaymentOrder(amount, currency, phone, token) {
  const response = await fetch('http://localhost:3000/api/payment/order', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount, currency, phone })
  });
  
  const data = await response.json();
  
  // Redirect user to payment URL
  window.location.href = data.paymentUrl;
  
  return data;
}
```

#### 7.2 Check Payment Status

**Endpoint:** `GET /api/payment/status/:orderId`

**Response (200):**
```json
{
  "success": true,
  "status": "SUCCESS",
  "data": { ... }
}
```

#### 7.3 Payment Webhook

**Endpoint:** `POST /api/payment/webhook`

**Note:** This is called automatically by Cashfree when payment is completed. No frontend action needed.

**Status After Step 7:** `ACTIVE` (user can access platform)

---

## API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/send-otp` | Public | Send OTP to email |
| POST | `/auth/verify-otp` | Public | Verify OTP and get tokens |
| GET | `/auth/debug/otp` | Public (dev only) | Get OTP for testing |
| POST | `/auth/login` | Public | Initiate login flow |
| POST | `/auth/select-country` | JWT | Select country |
| GET | `/auth/verification/status` | JWT | Check verification progress |
| GET | `/auth/onboarding-status` | JWT | Check onboarding completion |
| POST | `/auth/refresh-token` | Public | Refresh access token |

### DigiLocker Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/digilocker/initiate` | JWT | Start DigiLocker verification |
| POST | `/api/digilocker/callback` | JWT | Handle DigiLocker callback |
| POST | `/api/digilocker/complete` | JWT | Complete verification with data |
| GET | `/api/digilocker/status/:id` | JWT | Get verification status |
| GET | `/api/digilocker/user-status` | JWT | Get user's DigiLocker status |
| GET | `/api/digilocker/health` | Public | Health check |

### Video Verification Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/video-verification/initiate` | JWT | Create video session |
| POST | `/api/video-verification/submit` | JWT | Submit video for review |
| GET | `/api/video-verification/status` | JWT | Check video status |

### Payment Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/payment/order` | JWT | Create payment order |
| GET | `/api/payment/status/:orderId` | Public | Check payment status |
| GET | `/api/payment/history/:userId` | JWT | Get payment history |
| POST | `/api/payment/webhook` | Public | Cashfree webhook |

### Subscription Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/auth/subscription/plans` | JWT | Get available plans |
| POST | `/auth/subscription/select-plan` | JWT | Select subscription plan |
| GET | `/auth/subscription/current` | JWT | Get current subscription |

### Admin Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/admin/users/pending` | JWT (Admin) | Get pending users |
| GET | `/api/admin/users/:id` | JWT (Admin) | Get user details |
| POST | `/api/admin/users/:id/approve` | JWT (Admin) | Approve user |
| POST | `/api/admin/users/:id/reject` | JWT (Admin) | Reject user |

---

## Frontend Integration

### Complete React Example

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState(localStorage.getItem('accessToken'));
  const navigate = useNavigate();

  // Step 1: Email Verification
  const handleEmailVerification = async (email, username) => {
    // Send OTP
    await fetch('/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username })
    });
    
    // Show OTP input
    setStep(2);
  };

  const handleOTPVerification = async (email, otp) => {
    const response = await fetch('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    
    const data = await response.json();
    setToken(data.accessToken);
    localStorage.setItem('accessToken', data.accessToken);
    setStep(3);
  };

  // Step 2: Country Selection
  const handleCountrySelection = async (country) => {
    await fetch('/auth/select-country', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ country })
    });
    setStep(4);
  };

  // Step 3: ID Verification
  const handleDigiLockerInitiate = async (mobileNumber) => {
    const response = await fetch('/api/digilocker/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mobileNumber })
    });
    
    const data = await response.json();
    sessionStorage.setItem('digilockerVerificationId', data.verificationId);
    window.location.href = data.consentUrl;
  };

  // Step 4: Video Verification
  const handleVideoSubmit = async (videoUrl, metadata) => {
    const response = await fetch('/api/video-verification/initiate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const { sessionId } = await response.json();
    
    await fetch('/api/video-verification/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId, videoUrl, ...metadata })
    });
    
    setStep(5);
  };

  // Step 5: Wait for admin approval
  useEffect(() => {
    if (step === 5) {
      const interval = setInterval(async () => {
        const response = await fetch('/auth/verification/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.status === 'ADMIN_APPROVED') {
          setStep(6);
          clearInterval(interval);
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [step, token]);

  // Step 6: Subscription
  const handlePlanSelection = async (planId) => {
    await fetch('/auth/subscription/select-plan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ planId })
    });
    setStep(7);
  };

  // Step 7: Payment
  const handlePayment = async (amount, currency, phone) => {
    const response = await fetch('/api/payment/order', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, currency, phone })
    });
    
    const data = await response.json();
    window.location.href = data.paymentUrl;
  };

  return (
    <div className="onboarding-container">
      {step === 1 && <EmailVerificationStep onSubmit={handleEmailVerification} />}
      {step === 2 && <OTPVerificationStep onSubmit={handleOTPVerification} />}
      {step === 3 && <CountrySelectionStep onSubmit={handleCountrySelection} />}
      {step === 4 && <DigiLockerStep onSubmit={handleDigiLockerInitiate} />}
      {step === 5 && <VideoVerificationStep onSubmit={handleVideoSubmit} />}
      {step === 6 && <SubscriptionStep onSubmit={handlePlanSelection} />}
      {step === 7 && <PaymentStep onSubmit={handlePayment} />}
    </div>
  );
}
```

---

## Status Progression

### User Status Values

| Status | Description | Next Action |
|--------|-------------|-------------|
| `REGISTERED` | User account created, email not verified | Verify email |
| `EMAIL_VERIFIED` | Email verified, can proceed | Select country |
| `ID_VERIFIED` | ID verification complete | Upload video |
| `VIDEO_VERIFIED` | Video submitted, pending review | Wait for admin |
| `ADMIN_APPROVED` | Admin approved, ready for payment | Select plan & pay |
| `ACTIVE` | Payment complete, full access | Access platform |

### Check Status

**Endpoint:** `GET /auth/verification/status`

**Response:**
```json
{
  "status": "ID_VERIFIED",
  "progress": 50,
  "completedSteps": ["email", "country", "id"],
  "pendingSteps": ["video", "admin", "payment"]
}
```

---

## Error Handling

### Common Errors

| Error Code | Message | Solution |
|------------|---------|----------|
| 400 | Invalid OTP | Request new OTP |
| 400 | Country not selected | Call `/auth/select-country` |
| 400 | User not ID verified | Complete ID verification first |
| 401 | Unauthorized | Check token, refresh if expired |
| 409 | Email already exists | Use login flow instead |
| 500 | Server error | Retry after some time |

### Error Handling Example

```javascript
async function apiCall(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      // Handle specific errors
      if (response.status === 401) {
        // Token expired, refresh it
        await refreshToken();
        // Retry request
        return apiCall(url, options);
      }
      
      throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## Testing Guide

### Quick Test Flow

```bash
# 1. Send OTP
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser"}'

# 2. Get OTP (dev only)
curl http://localhost:3000/auth/debug/otp?email=test@example.com

# 3. Verify OTP
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'

# 4. Select Country
curl -X POST http://localhost:3000/auth/select-country \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"country":"India"}'

# 5. Initiate DigiLocker
curl -X POST http://localhost:3000/api/digilocker/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"9876543210"}'

# 6. Check Status
curl http://localhost:3000/auth/verification/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Related Documentation

- [DigiLocker Verification](./digilocker/README.md) - Detailed DigiLocker guide
- [Payment Integration](./payment/PAYMENT_API.md) - Payment flow details
- [Video Verification](./video-verification/README.md) - Video verification guide
- [API Reference](./INDEX.md) - Complete API documentation

---

**Last Updated:** November 16, 2025  
**Version:** 2.0  
**Status:** Production Ready ✅

