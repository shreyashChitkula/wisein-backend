# Backend API Documentation - Complete Reference

**Last Updated:** November 13, 2025  
**Version:** 2.0 - Comprehensive All Endpoints  
**Status:** ✅ All 30+ endpoints documented

---

## Quick API Reference - Complete Endpoint List

### 1. Authentication & User Registration (Auth Module) - 9 Endpoints

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/api/auth/send-otp` | ❌ | Initiate signup/login with OTP |
| POST | `/api/auth/verify-otp` | ❌ | Verify OTP for signup/login |
| POST | `/api/auth/login` | ❌ | Start login flow |
| GET | `/api/auth/debug/otp` | ❌ | Dev: Get OTP for testing |
| POST | `/api/auth/select-country` | ✅ | User selects country |
| GET | `/api/auth/verification/status` | ✅ | Check verification progress |
| POST | `/api/auth/refresh-token` | ❌ | Refresh access token |
| GET | `/api/auth/onboarding-status` | ✅ | Check onboarding status |
| POST | `/api/auth/upload-video` | ✅ | Upload verification video |

### 2. DigiLocker ID Verification (Dedicated Module) - 7 Endpoints

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/api/digilocker/initiate` | ✅ | Check DigiLocker account |
| POST | `/api/digilocker/callback` | ❌ | Handle DigiLocker callback |
| POST | `/api/digilocker/complete` | ✅ | Complete DigiLocker flow |
| GET | `/api/digilocker/status/:id` | ✅ | Get verification status |
| GET | `/api/digilocker/user-status` | ✅ | Get user's DigiLocker status |
| POST | `/api/digilocker/admin/cleanup-expired` | ✅ | Admin: Cleanup expired |
| GET | `/api/digilocker/health` | ❌ | Health check |

### 3. Alternative ID Verification Methods (Auth Module) - 4 Endpoints

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/api/auth/digilocker/authorize` | ✅ | Alt: Authorize DigiLocker |
| POST | `/api/auth/digilocker/verify` | ✅ | Alt: Verify DigiLocker |
| POST | `/api/auth/stripe-identity/create-session` | ✅ | Create Stripe session |
| POST | `/api/auth/stripe-identity/verify` | ✅ | Verify Stripe result |

### 4. Video Verification (Dedicated Module) - 7 Endpoints

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/api/video-verification/initiate` | ✅ | Create video session |
| POST | `/api/video-verification/submit` | ✅ | Submit recorded video |
| GET | `/api/video-verification/status` | ✅ | Get verification status |
| POST | `/api/video-verification/admin/verify` | ✅ | Admin: Approve video |
| POST | `/api/video-verification/admin/reject` | ✅ | Admin: Reject video |
| GET | `/api/video-verification/admin/pending` | ✅ | Admin: List pending |
| GET | `/api/video-verification/health` | ❌ | Health check |

### 5. Subscription Management (Auth Module) - 4 Endpoints

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/api/auth/subscription/plans` | ❌ | Get available plans |
| POST | `/api/auth/subscription/select-plan` | ✅ | Select plan |
| GET | `/api/auth/subscription/current` | ✅ | Get current subscription |
| POST | `/api/auth/subscription/cancel` | ✅ | Cancel subscription |
| POST | `/api/auth/webhooks/cashfree` | ❌ | Payment webhook |

### 6. Payment Processing (Payment Module) - 6 Endpoints ⭐ NEW

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/api/payment/order` | ✅ | Create payment order |
| POST | `/api/payment/subscription` | ✅ | Create subscription |
| GET | `/api/payment/status/:orderId` | ❌ | Get order status |
| GET | `/api/payment/subscription/:userId` | ✅ | Check user subscription |
| GET | `/api/payment/history/:userId` | ✅ | Get payment history |
| POST | `/api/payment/webhook` | ❌ | Cashfree webhook |

### 7. Admin Operations (Admin Module) - 5 Endpoints

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/api/admin/users/pending` | ✅ | Get pending users |
| GET | `/api/admin/users/:id` | ✅ | Get user details |
| POST | `/api/admin/users/:id/approve` | ✅ | Approve user |
| POST | `/api/admin/users/:id/reject` | ✅ | Reject user |
| GET | `/api/admin/dashboard/stats` | ✅ | Dashboard statistics |

### 8. System Endpoints - 1 Endpoint

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | ❌ | Health check |

**Total: 43 Endpoints across 6 modules**

---

## Complete User Journey Map

```
Phase 1: Authentication
  POST /api/auth/send-otp           → Send OTP to user
  POST /api/auth/verify-otp         → Verify OTP (Email confirmed)
  
Phase 2: Profile Setup
  POST /api/auth/select-country     → User selects country
  
Phase 3: ID Verification (Choose One)
  Option A (Dedicated DigiLocker Module):
  POST /api/digilocker/initiate   → Check DigiLocker account
  [User grants consent on DigiLocker]
  POST /api/digilocker/callback   → Receive DigiLocker callback
  POST /api/digilocker/complete   → Confirm verification
  
  Option B (Auth Module Alternative):
  POST /api/auth/digilocker/authorize
  POST /api/auth/digilocker/verify
  
  Option C (Stripe Identity):
  POST /api/auth/stripe-identity/create-session
  POST /api/auth/stripe-identity/verify

Phase 4: Admin Review (ID Documents)
  GET /api/admin/users/pending       → [Admin] Get pending users
  GET /api/admin/users/:id           → [Admin] Review user details
  POST /api/admin/users/:id/approve  → [Admin] Approve ID
  (OR)
  POST /api/admin/users/:id/reject   → [Admin] Reject ID

Phase 5: Video Verification (Choose One)
  Option A (Dedicated Video Module):
    POST /api/video-verification/initiate → Create session
    POST /api/video-verification/submit   → Submit video
  
  Option B (Simple Upload via Auth):
    POST /api/auth/upload-video       → Upload video

Phase 6: Admin Review (Video)
  GET /api/video-verification/admin/pending  → [Admin] Get pending
  POST /api/video-verification/admin/verify  → [Admin] Approve
  (OR)
  POST /api/video-verification/admin/reject  → [Admin] Reject

Phase 7: Subscription
  GET /api/auth/subscription/plans  → View plans
  POST /api/auth/subscription/select-plan → Select plan
  [Payment via Cashfree]
  POST /api/auth/webhooks/cashfree  → Payment confirmation webhook

Phase 8: Auto-Complete
  Status: FULLY_VERIFIED ✅
  
Status Checks at Any Time:
  GET /api/auth/verification/status     → Check progress
  GET /api/auth/onboarding-status       → Check completion %
  GET /api/digilocker/user-status       → Check ID status
  GET /api/video-verification/status    → Check video status
  GET /api/auth/subscription/current    → Check subscription
```

---

## Detailed Endpoint Documentation

### Authentication Endpoints

#### 1. Send OTP (Registration/Login Start)

**Endpoint:** `POST /api/auth/send-otp`

**Purpose:** Initiates signup or login by sending OTP to user's email

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

**Status Codes:**
- `200` - OTP sent successfully
- `400` - Invalid email format
- `409` - Email already registered (for signup)

---

#### 2. Verify OTP (Complete Registration/Login)

**Endpoint:** `POST /api/auth/verify-otp`

**Purpose:** Verifies OTP and completes email verification

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
  "userId": "clx1234567890",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Email verified successfully"
}
```

**Status Codes:**
- `200` - Verified successfully
- `400` - Invalid or expired OTP
- `404` - User not found

**Usage:**
```javascript
const response = await fetch('https://api.wisein.com/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', otp: '123456' })
});
const { accessToken } = await response.json();
localStorage.setItem('accessToken', accessToken);
```

---

#### 3. Get OTP (Development Only)

**Endpoint:** `GET /api/auth/debug/otp`

**Purpose:** Retrieves OTP without sending email (development/testing only)

**Query Parameters:**
- `email` (required) - User's email address

**Response (200):**
```json
{
  "email": "test@example.com",
  "otp": "123456",
  "expiresAt": "2025-11-13T10:30:00Z"
}
```

---

#### 4. Select Country

**Endpoint:** `POST /api/auth/select-country`

**Protected:** ✅ (Requires JWT token)

**Purpose:** User selects their country for localized services

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "country": "India"
}
```

**Response (200):**
```json
{
  "userId": "clx1234567890",
  "country": "India",
  "message": "Country selected successfully"
}
```

---

#### 5. Check Verification Status

**Endpoint:** `GET /api/auth/verification/status`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Check overall verification progress

**Response (200):**
```json
{
  "userId": "clx1234567890",
  "status": {
    "emailVerified": true,
    "countrySelected": true,
    "idVerified": false,
    "videoVerified": false,
    "subscriptionActive": false,
    "completedSteps": ["send-otp", "verify-otp", "select-country"]
  }
}
```

---

#### 6. Check Onboarding Status

**Endpoint:** `GET /api/auth/onboarding-status`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Get overall onboarding progress percentage

**Response (200):**
```json
{
  "userId": "clx1234567890",
  "currentStep": "id-verification",
  "percentageComplete": 40,
  "nextStep": "video-verification",
  "estimatedTimeRemaining": "15 minutes"
}
```

---

#### 7. Refresh Token

**Endpoint:** `POST /api/auth/refresh-token`

**Purpose:** Refresh expired access token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

---

### DigiLocker Verification Endpoints

#### 1. Initiate DigiLocker Verification

**Endpoint:** `POST /api/digilocker/initiate`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Check if user has DigiLocker account and get consent URL

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
  "consentUrl": "https://cashfree.digilocker.io/consent?...",
  "verificationId": "VER_clx1234567890",
  "message": "DigiLocker account found. Please grant consent."
}
```

**Usage:**
```javascript
const response = await fetch('https://api.wisein.com/api/digilocker/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ mobileNumber: '9876543210' })
});
const { consentUrl } = await response.json();
window.location.href = consentUrl; // Redirect user
```

---

#### 2. DigiLocker Callback

**Endpoint:** `POST /api/digilocker/callback`

**Purpose:** Receives consent data from DigiLocker (internal use)

**Called By:** DigiLocker system after user grants consent

---

#### 3. Complete DigiLocker Verification

**Endpoint:** `POST /api/digilocker/complete`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Finalize DigiLocker verification with auth code

**Request:**
```json
{
  "verificationId": "VER_clx1234567890",
  "authCode": "AUTH_CODE_FROM_DIGILOCKER"
}
```

**Response (200):**
```json
{
  "success": true,
  "verified": true,
  "data": {
    "name": "John Doe",
    "documentType": "Aadhaar",
    "documentNumber": "xxxx xxxx xxxx 1234",
    "dateOfBirth": "1990-01-01",
    "gender": "M"
  },
  "message": "ID verified successfully"
}
```

---

#### 4. Get DigiLocker Status

**Endpoint:** `GET /api/digilocker/status/:verificationId`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Check status of a specific DigiLocker verification

**Response (200):**
```json
{
  "verificationId": "VER_clx1234567890",
  "status": "COMPLETED",
  "verified": true,
  "createdAt": "2025-11-13T10:00:00Z",
  "completedAt": "2025-11-13T10:15:00Z"
}
```

---

#### 5. Get User's DigiLocker Status

**Endpoint:** `GET /api/digilocker/user-status`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Get DigiLocker verification status for current user

**Response (200):**
```json
{
  "userId": "clx1234567890",
  "hasVerification": true,
  "verified": true,
  "lastVerificationId": "VER_clx1234567890",
  "verifiedAt": "2025-11-13T10:15:00Z",
  "expiresAt": "2026-11-13T10:15:00Z"
}
```

---

#### 6. DigiLocker Health Check

**Endpoint:** `GET /api/digilocker/health`

**Purpose:** Check if DigiLocker service is healthy

**Response (200):**
```json
{
  "status": "healthy",
  "service": "DigiLocker",
  "timestamp": "2025-11-13T10:30:00Z"
}
```

---

### Video Verification Endpoints

#### 1. Initiate Video Session

**Endpoint:** `POST /api/video-verification/initiate`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Create a new video verification session

**Response (200):**
```json
{
  "success": true,
  "sessionId": "VID_clx1234567890",
  "expiresAt": "2025-11-13T11:00:00Z",
  "recordingDurationLimit": 60,
  "instructions": {
    "requirements": [
      "Face visible and centered",
      "Good lighting",
      "Clear audio",
      "No glasses or face coverings"
    ],
    "maxDuration": "60 seconds"
  }
}
```

---

#### 2. Submit Recorded Video

**Endpoint:** `POST /api/video-verification/submit`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Submit recorded video for verification

**Request:**
```json
{
  "sessionId": "VID_clx1234567890",
  "videoUrl": "https://storage.com/video_abc123.mp4",
  "videoDuration": 45,
  "videoFormat": "mp4",
  "videoSize": 5242880
}
```

**Response (200):**
```json
{
  "success": true,
  "submitted": true,
  "status": "PROCESSING",
  "message": "Video submitted for processing"
}
```

---

#### 3. Get Video Verification Status

**Endpoint:** `GET /api/video-verification/status`

**Protected:** ✅ (Requires JWT token)

**Purpose:** Get current video verification status

**Response (200):**
```json
{
  "userId": "clx1234567890",
  "status": "PENDING",
  "lastSubmission": "2025-11-13T10:45:00Z",
  "sessionId": "VID_clx1234567890",
  "verifiedAt": null
}
```

---

#### 4. Admin: Verify Video

**Endpoint:** `POST /api/video-verification/admin/verify`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** Admin approves a video submission

**Request:**
```json
{
  "userId": "clx1234567890",
  "faceMatchScore": 0.95,
  "notes": "Clear video, identity verified"
}
```

**Response (200):**
```json
{
  "success": true,
  "verified": true,
  "userId": "clx1234567890",
  "message": "Video verified successfully"
}
```

---

#### 5. Admin: Reject Video

**Endpoint:** `POST /api/video-verification/admin/reject`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** Admin rejects a video submission

**Request:**
```json
{
  "userId": "clx1234567890",
  "reason": "Face not clearly visible",
  "notes": "Video quality insufficient"
}
```

**Response (200):**
```json
{
  "success": true,
  "verified": false,
  "userId": "clx1234567890",
  "message": "Video rejected. User can retry."
}
```

---

#### 6. Admin: Get Pending Videos

**Endpoint:** `GET /api/video-verification/admin/pending`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** List all pending video verifications

**Response (200):**
```json
{
  "count": 5,
  "pending": [
    {
      "userId": "clx1234567890",
      "userName": "John Doe",
      "email": "john@example.com",
      "submittedAt": "2025-11-13T10:45:00Z",
      "videoUrl": "https://storage.com/video_abc123.mp4",
      "status": "PENDING"
    }
  ]
}
```

---

#### 7. Video Verification Health Check

**Endpoint:** `GET /api/video-verification/health`

**Purpose:** Check if video verification service is healthy

**Response (200):**
```json
{
  "status": "healthy",
  "service": "VideoVerification",
  "timestamp": "2025-11-13T10:30:00Z"
}
```

---

### Admin Operations Endpoints

#### 1. Get Pending Users

**Endpoint:** `GET /api/admin/users/pending`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** List users pending approval

**Response (200):**
```json
{
  "count": 3,
  "users": [
    {
      "userId": "clx1234567890",
      "email": "user@example.com",
      "username": "johndoe",
      "status": "ID_VERIFIED",
      "registeredAt": "2025-11-13T09:00:00Z",
      "lastUpdate": "2025-11-13T10:15:00Z"
    }
  ]
}
```

---

#### 2. Get User Details

**Endpoint:** `GET /api/admin/users/:id`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** Get detailed information about a specific user

**Response (200):**
```json
{
  "userId": "clx1234567890",
  "email": "user@example.com",
  "username": "johndoe",
  "country": "India",
  "status": "ID_VERIFIED",
  "emailVerified": true,
  "idVerified": true,
  "videoVerified": false,
  "createdAt": "2025-11-13T09:00:00Z",
  "verifications": {
    "digiLocker": {
      "verified": true,
      "verifiedAt": "2025-11-13T10:15:00Z",
      "data": { "name": "John Doe", "documentType": "Aadhaar" }
    },
    "video": {
      "verified": false,
      "status": "PENDING"
    }
  }
}
```

---

#### 3. Approve User

**Endpoint:** `POST /api/admin/users/:id/approve`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** Admin approves a user for verification

**Request:**
```json
{
  "notes": "All verification documents approved"
}
```

**Response (200):**
```json
{
  "success": true,
  "userId": "clx1234567890",
  "status": "VERIFIED",
  "message": "User approved successfully"
}
```

---

#### 4. Reject User

**Endpoint:** `POST /api/admin/users/:id/reject`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** Admin rejects a user

**Request:**
```json
{
  "reason": "Document not readable",
  "notes": "Please resubmit clear copy of ID"
}
```

**Response (200):**
```json
{
  "success": true,
  "userId": "clx1234567890",
  "status": "REJECTED",
  "message": "User rejected. Notification sent."
}
```

---

#### 5. Get Dashboard Statistics

**Endpoint:** `GET /api/admin/dashboard/stats`

**Protected:** ✅ (Requires JWT token + Admin role)

**Purpose:** Get system-wide statistics

**Response (200):**
```json
{
  "totalUsers": 1250,
  "verifiedUsers": 890,
  "pendingReview": 45,
  "rejectedUsers": 12,
  "stats": {
    "emailVerified": 1200,
    "idVerified": 890,
    "videoVerified": 812,
    "subscriptionActive": 756
  },
  "graphData": {
    "dailySignups": [50, 75, 120, ...],
    "verificationTrend": [45, 60, 75, ...]
  }
}
```

---

## Subscription Management Endpoints

#### 1. Get Available Plans

**Endpoint:** `GET /api/auth/subscription/plans`

**Response (200):**
```json
{
  "plans": [
    {
      "id": "plan_basic",
      "name": "Basic",
      "price": 99,
      "currency": "INR",
      "duration": 30,
      "features": ["ID verification", "Basic reports"]
    },
    {
      "id": "plan_premium",
      "name": "Premium",
      "price": 299,
      "currency": "INR",
      "duration": 30,
      "features": ["ID verification", "Video verification", "Advanced reports"]
    }
  ]
}
```

---

#### 2. Select Subscription Plan

**Endpoint:** `POST /api/auth/subscription/select-plan`

**Protected:** ✅ (Requires JWT token)

**Request:**
```json
{
  "planId": "plan_premium"
}
```

**Response (200):**
```json
{
  "success": true,
  "subscriptionId": "sub_clx1234567890",
  "planId": "plan_premium",
  "amount": 299,
  "currency": "INR",
  "paymentLink": "https://checkout.cashfree.com/...",
  "message": "Proceed to payment"
}
```

---

#### 3. Get Current Subscription

**Endpoint:** `GET /api/auth/subscription/current`

**Protected:** ✅ (Requires JWT token)

**Response (200):**
```json
{
  "subscriptionId": "sub_clx1234567890",
  "planId": "plan_premium",
  "status": "ACTIVE",
  "startDate": "2025-11-13",
  "endDate": "2025-12-13",
  "renewalDate": "2025-12-13",
  "amount": 299,
  "currency": "INR"
}
```

---

#### 4. Cancel Subscription

**Endpoint:** `POST /api/auth/subscription/cancel`

**Protected:** ✅ (Requires JWT token)

**Response (200):**
```json
{
  "success": true,
  "subscriptionId": "sub_clx1234567890",
  "status": "CANCELLED",
  "message": "Subscription cancelled successfully"
}
```

---

## Error Codes & Status Codes

### HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input, missing fields |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Not admin, permission denied |
| 404 | Not Found | User/resource doesn't exist |
| 409 | Conflict | Email already exists, duplicate |
| 500 | Server Error | Database/internal error |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

---

## Security & Authentication

### JWT Tokens

**Access Token:**
- Validity: 7 days
- Used for: All API requests (in Authorization header)
- Obtained from: `/auth/verify-otp` or `/auth/refresh-token`

**Refresh Token:**
- Validity: 30 days
- Used for: Refreshing expired access token
- Endpoint: `/auth/refresh-token`

### Protected Endpoints

All endpoints marked with `✅` require valid JWT token in Authorization header:

```
Authorization: Bearer <your_access_token>
```

### Public Endpoints

Endpoints marked with `❌` don't require authentication:
- `/auth/send-otp`
- `/auth/verify-otp`
- `/auth/login`
- `/auth/debug/otp`
- `/auth/subscription/plans`
- `/auth/webhooks/cashfree`
- `/digilocker/callback`
- `/digilocker/health`
- `/video-verification/health`
- `/`

---

## Integration Examples

### Example 1: Complete Registration Flow

```javascript
// Step 1: Send OTP
const sendOtpResponse = await fetch('https://api.wisein.com/api/auth/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    username: 'johndoe'
  })
});

// Step 2: Verify OTP
const verifyResponse = await fetch('https://api.wisein.com/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    otp: userEnteredOTP
  })
});

const { accessToken, refreshToken, userId } = await verifyResponse.json();
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### Example 2: DigiLocker Verification

```javascript
// Step 1: Initiate DigiLocker
const digiResponse = await fetch('https://api.wisein.com/api/digilocker/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ mobileNumber: '9876543210' })
});

const { consentUrl, verificationId } = await digiResponse.json();
window.location.href = consentUrl; // Redirect user

// Step 2: After user grants consent and is redirected back
// Frontend needs to call:
const completeResponse = await fetch('https://api.wisein.com/api/digilocker/complete', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    verificationId: verificationId,
    authCode: authCodeFromCallback
  })
});
```

### Example 3: Video Verification

```javascript
// Step 1: Initiate video session
const videoInitResponse = await fetch('https://api.wisein.com/api/video-verification/initiate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { sessionId } = await videoInitResponse.json();

// Step 2: [User records video]
// Step 3: Submit video
const submitResponse = await fetch('https://api.wisein.com/api/video-verification/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    sessionId: sessionId,
    videoUrl: uploadedVideoUrl,
    videoDuration: 45,
    videoFormat: 'mp4',
    videoSize: videoFileSizeInBytes
  })
});
```

---

## Database Models

### User Model

```prisma
model User {
  id                    String      @id @default(cuid())
  email                 String      @unique
  username              String      @unique
  country               String?
  status                UserStatus  // REGISTERED, EMAIL_VERIFIED, ID_VERIFIED, VIDEO_VERIFIED, VERIFIED
  emailVerified         Boolean     @default(false)
  idVerified            Boolean     @default(false)
  videoVerified         Boolean     @default(false)
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  
  // Relations
  orders                PaymentOrder[]
  paymentRecords        PaymentRecord[]
  subscription          Subscription?
}

enum UserStatus {
  REGISTERED
  EMAIL_VERIFIED
  ID_VERIFIED
  VIDEO_VERIFIED
  VERIFIED
  REJECTED
}
```

### Subscription Model

```prisma
model Subscription {
  id                    String      @id @default(cuid())
  userId                String      @unique
  planId                String
  status                String      // ACTIVE, CANCELLED, EXPIRED
  startDate             DateTime
  endDate               DateTime
  renewalDate           DateTime
  amount                Float
  currency              String      @default("INR")
}
```

### Payment Models ⭐ NEW

```prisma
model PaymentOrder {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  orderId           String   @unique          # order_TIMESTAMP
  paymentSessionId  String?
  
  amount            Float
  currency          String   @default("INR")
  status            PaymentStatus             # PENDING, SUCCESS, FAILED, CANCELLED
  
  customerPhone     String?
  customerEmail     String?
  
  cashfreeOrderId   String?
  cashfreePaymentId String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model PaymentRecord {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  paymentType       PaymentType               # ORDER or SUBSCRIPTION
  
  orderId           String?
  subscriptionId    String?
  
  amount            Float
  currency          String   @default("INR")
  status            PaymentStatus
  
  cashfreeOrderId   String?
  cashfreePaymentId String?
  
  webhookPayload    Json?                     # Full webhook data from Cashfree
  paidAt            DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  CANCELLED
}

enum PaymentType {
  ORDER
  SUBSCRIPTION
}
```

---

## Payment Flow

```
User Initiates Payment
  ↓
POST /api/payment/order (create order)
  ↓ (Backend saves to DB with status=PENDING)
  ↓
Return payment URL (paymentUrl)
  ↓
Frontend redirects user to Cashfree payment page
  ↓
User completes payment
  ↓
Cashfree webhook calls POST /api/payment/webhook
  ↓ (Backend verifies signature & updates DB status→SUCCESS)
  ↓
Frontend polls GET /api/payment/subscription/:userId
  ↓
Confirm payment & grant access to premium features
```

---

## Testing

### Using cURL

```bash
# Send OTP
curl -X POST https://api.wisein.com/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser"}'

# Verify OTP
curl -X POST https://api.wisein.com/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'

# Select Country (with token)
curl -X POST https://api.wisein.com/api/auth/select-country \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"country":"India"}'

# Create Payment Order (with token)
curl -X POST https://api.wisein.com/api/payment/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amount":9999,"currency":"INR","phone":"9876543210"}'

# Check Subscription Status (with token)
curl https://api.wisein.com/api/payment/subscription/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Postman

Import the collection: `API_COLLECTION.http`

---

## Reference Documentation

- **Payment Integration Guide:** [PAYMENT_API.md](payment/PAYMENT_API.md) - Complete payment endpoint documentation
- **Payment Frontend Integration:** [PAYMENT_FRONTEND_INTEGRATION.md](payment/PAYMENT_FRONTEND_INTEGRATION.md) - Step-by-step integration guide for frontend
- **Complete Endpoint Reference:** [COMPLETE_API_REFERENCE.md](../COMPLETE_API_REFERENCE.md)
- **User Journey:** [Complete Verification Flow](guides/COMPLETE_VERIFICATION_FLOW.md)
- **DigiLocker Details:** [DigiLocker Documentation](digilocker/README.md)
- **Video Verification:** [Video Verification Documentation](video-verification/README.md)

---

**Last Updated:** November 13, 2025  
**Version:** 2.1 - Complete API + Payment Integration  
**Status:** ✅ All 43 endpoints documented and validated

