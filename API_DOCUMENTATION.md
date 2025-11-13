# 🚀 Wisein Backend - Comprehensive API Documentation
**Last Updated:** November 12, 2025  
**Status:** ✅ All APIs Tested and Working  
**Base URL:** `http://localhost:3000`

> NOTE: Older, duplicate documentation files in this folder have been removed and consolidated. The DigiLocker flow is server-enforced to be India-only — non-Indian users must use the Stripe identity verification flow. See `DIGILOCKER_TESTING_GUIDE.md` for testing examples and `src/digilocker/services/digilocker-verification.service.ts` for the enforcement logic.

---

## 📋 Quick Summary

| Endpoint Category | Count | Status |
|------------------|-------|--------|
| Authentication | 5 | ✅ Working |
| Onboarding | 2 | ✅ Working |
| ID Verification | 5 | ✅ Working |
| Video Verification | 1 | ✅ Working |
| Subscriptions | 4 | ✅ Working |
| Admin | 4 | ✅ Working |
| Webhooks | 1 | ✅ Working |
| **Total** | **22** | **✅ All Working** |

---

## 🔐 Authentication Flow

```
1. SIGNUP → Creates account (REGISTERED status)
2. SEND OTP → Request OTP code
3. VERIFY OTP → Verify email (EMAIL_VERIFIED status)
4. LOGIN → Get access & refresh tokens
5. REFRESH TOKEN → Renew access token when expired
```

---

## 📑 Detailed Endpoint Documentation

### 1️⃣ AUTHENTICATION ENDPOINTS

#### POST `/auth/signup`
**Description:** Create a new user account  
**Authentication:** None  
**Status Code:** 201 Created  

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Validation:**
- Email: Valid email format required
- Password: Minimum 8 characters
- Name: Minimum 2 characters

**Response:**
```json
{
  "userId": "usr_123abc",
  "message": "Signup successful. OTP sent to your email."
}
```

**Error Cases:**
- `409 Conflict`: Email already registered
- `400 Bad Request`: Invalid input format

---

#### POST `/auth/send-otp`
**Description:** Resend OTP to user's email  
**Authentication:** None  
**Status Code:** 200 OK  

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP sent to your email",
  "email": "user@example.com"
}
```

---

#### POST `/auth/verify-otp`
**Description:** Verify email with OTP code  
**Authentication:** None  
**Status Code:** 201 Created  

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Validation:**
- OTP: Exactly 6 digits
- OTP Expiry: 10 minutes from creation
- Max Attempts: 3 failed attempts, then must request new OTP

**Response:**
```json
{
  "userId": "usr_123abc",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "message": "Email verified successfully."
}
```

**Error Cases:**
- `400 Bad Request`: Invalid or expired OTP
- `400 Bad Request`: Too many failed attempts
- `404 Not Found`: User not found

---

#### POST `/auth/login`
**Description:** Login with email and password  
**Authentication:** None  
**Status Code:** 201 Created  

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "userId": "usr_123abc",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "message": "Login successful"
}
```

**Error Cases:**
- `401 Unauthorized`: Invalid credentials
- `400 Bad Request`: Email not verified yet (status: REGISTERED)

**Token Details:**
- `accessToken`: Valid for 7 days
- `refreshToken`: Valid for 30 days

---

#### POST `/auth/refresh-token`
**Description:** Get new access token using refresh token  
**Authentication:** None  
**Status Code:** 200 OK  

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "message": "Token refreshed successfully"
}
```

**Error Cases:**
- `401 Unauthorized`: Refresh token expired or invalid

---

### 2️⃣ ONBOARDING ENDPOINTS

#### GET `/auth/onboarding-status`
**Description:** Get user's current onboarding progress  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 200 OK  

**Response:**
```json
{
  "status": "EMAIL_VERIFIED",
  "completedSteps": ["Email Verified"],
  "nextStep": "Select Country",
  "details": {
    "email": "user@example.com",
    "country": null,
    "verificationMethod": "STRIPE_IDENTITY",
    "verification": null,
    "subscription": null
  }
}
```

**Possible Statuses:**
1. `REGISTERED` → Next: Verify OTP
2. `EMAIL_VERIFIED` → Next: Select Country
3. `ID_VERIFIED` → Next: Upload Video
4. `VIDEO_VERIFIED` → Next: Await Admin Approval
5. `APPROVED` → Next: Select Subscription
6. `ACTIVE` → Onboarding Complete

---

#### POST `/auth/select-country`
**Description:** Select country (determines ID verification method)  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 201 Created  

**Request:**
```json
{
  "country": "India"
}
```

**Response:**
```json
{
  "userId": "usr_123abc",
  "verificationMethod": "DIGILOCKER",
  "message": "Country selected: India. Next step: DIGILOCKER verification."
}
```

**Country Mapping:**
- `India` → DIGILOCKER verification
- `Other countries` → STRIPE_IDENTITY verification

---

### 3️⃣ ID VERIFICATION ENDPOINTS

#### GET `/auth/verification/status`
**Description:** Get current ID verification status  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 200 OK  

**Response:**
```json
{
  "status": "NOT_STARTED",
  "method": null,
  "verifiedData": null,
  "videoUrl": null,
  "frameUrl": null,
  "verifiedAt": null,
  "rejectionReason": null
}
```

**Verification Statuses:**
- `NOT_STARTED`: No verification initiated
- `PENDING`: Verification in progress
- `VERIFIED`: ID verified
- `REJECTED`: Verification rejected

---

#### POST `/auth/digilocker/authorize`
**Description:** Initiate DigiLocker OAuth authorization flow  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 200 OK  

**Response:**
```json
{
  "authUrl": "https://digilocker.gov.in/oauth/authorize?client_id=..."
}
```

**Next Steps:**
1. Redirect user to `authUrl`
2. User authorizes on DigiLocker
3. DigiLocker redirects to callback with authorization code
4. Send authorization code to `/auth/digilocker/verify`

---

#### POST `/auth/digilocker/verify`
**Description:** Verify using DigiLocker authorization code  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 201 Created  

**Request:**
```json
{
  "authorizationCode": "AUTH_CODE_FROM_DIGILOCKER"
}
```

**Response:**
```json
{
  "status": "VERIFIED",
  "method": "DIGILOCKER",
  "verifiedData": {
    "name": "John Doe",
    "documentType": "AADHAAR",
    "documentNumber": "****1234"
  },
  "verifiedAt": "2025-11-12T10:30:00.000Z"
}
```

---

#### POST `/auth/stripe-identity/create-session`
**Description:** Create Stripe Identity verification session (for non-India)  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 201 Created  

**Response:**
```json
{
  "verificationSessionId": "vs_1234567890",
  "clientSecret": "vs_client_secret_123",
  "url": "https://stripe.com/identity/verify/vs_1234567890"
}
```

---

#### POST `/auth/stripe-identity/verify`
**Description:** Verify Stripe Identity verification session result  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 201 Created  

**Request:**
```json
{
  "verificationSessionId": "vs_1234567890"
}
```

**Response:**
```json
{
  "status": "VERIFIED",
  "method": "STRIPE_IDENTITY",
  "verifiedAt": "2025-11-12T10:35:00.000Z"
}
```

---

### 4️⃣ VIDEO VERIFICATION ENDPOINTS

#### POST `/auth/upload-video`
**Description:** Upload video for manual verification  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 201 Created  
**Content-Type:** multipart/form-data  

**Request:**
```
POST /auth/upload-video
Content-Type: multipart/form-data

video: [binary video file]
```

**Accepted Formats:**
- `.mp4`, `.mov`, `.avi`, `.mkv`
- Max Size: 100MB
- Min Duration: 3 seconds
- Max Duration: 60 seconds

**Response:**
```json
{
  "videoUrl": "https://storage.example.com/videos/usr_123/video.mp4",
  "frameUrl": "https://storage.example.com/frames/usr_123/frame.png",
  "message": "Video uploaded successfully. Awaiting admin review."
}
```

---

### 5️⃣ SUBSCRIPTION ENDPOINTS

#### GET `/auth/subscription/plans`
**Description:** Get all available subscription plans  
**Authentication:** None  
**Status Code:** 200 OK  

**Response:**
```json
{
  "individualPlans": [
    {
      "id": "price_individual_pro",
      "name": "Pro",
      "price": 9.99,
      "currency": "USD",
      "features": ["1:1 calls", "Post feature", "Job applications"]
    },
    {
      "id": "price_individual_premium",
      "name": "Premium",
      "price": 19.99,
      "currency": "USD",
      "features": ["Unlimited 1:1 calls", "Post feature", "Job applications", "AI summaries"]
    }
  ],
  "companyPlans": [
    {
      "id": "price_company_startup",
      "name": "Startup",
      "price": 49.99,
      "currency": "USD",
      "features": ["Up to 5 job postings", "Applicant tracking"]
    },
    {
      "id": "price_company_enterprise",
      "name": "Enterprise",
      "price": 199.99,
      "currency": "USD",
      "features": ["Unlimited job postings", "Advanced analytics", "Dedicated support"]
    }
  ]
}
```

---

#### POST `/auth/subscription/select-plan`
**Description:** Select subscription plan and create Cashfree checkout session  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 201 Created  

**Request:**
```json
{
  "planType": "INDIVIDUAL",
  "planName": "Pro"
}
```

**Response:**
```json
{
  "checkoutUrl": "https://cashfree.com/checkout/pay/...",
  "cashfreeOrderId": "order_123abc",
  "amount": 9.99,
  "currency": "USD",
  "message": "Cashfree checkout session created"
}
```

**Plan Types:**
- `INDIVIDUAL` or `COMPANY`

**Plan Names:**
- Individual: `Pro`, `Premium`
- Company: `Startup`, `Enterprise`

---

#### GET `/auth/subscription/current`
**Description:** Get current active subscription details  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 200 OK  

**Response (with subscription):**
```json
{
  "planName": "Pro",
  "planType": "INDIVIDUAL",
  "price": 9.99,
  "status": "ACTIVE",
  "startDate": "2025-11-12T00:00:00.000Z",
  "endDate": "2026-11-12T00:00:00.000Z",
  "autoRenew": true
}
```

**Response (no subscription):**
```json
{
  "message": "No active subscription"
}
```

---

#### POST `/auth/subscription/cancel`
**Description:** Cancel current subscription  
**Authentication:** ✅ Required (Bearer Token)  
**Status Code:** 200 OK  

**Response:**
```json
{
  "message": "Subscription cancelled successfully",
  "cancelledAt": "2025-11-12T10:45:00.000Z"
}
```

---

### 6️⃣ ADMIN ENDPOINTS

#### GET `/admin/pending-users`
**Description:** Get list of users awaiting admin approval  
**Authentication:** ✅ Required (Bearer Token + Admin Role)  
**Status Code:** 200 OK  

**Response:**
```json
{
  "users": [
    {
      "userId": "usr_123abc",
      "email": "user@example.com",
      "name": "John Doe",
      "status": "VIDEO_VERIFIED",
      "videoUrl": "https://...",
      "frameUrl": "https://...",
      "verifiedAt": "2025-11-12T10:00:00.000Z",
      "country": "India",
      "verification": {
        "method": "DIGILOCKER",
        "status": "VERIFIED"
      }
    }
  ],
  "total": 1
}
```

---

#### POST `/admin/users/:userId/approve`
**Description:** Approve user verification (move to APPROVED status)  
**Authentication:** ✅ Required (Bearer Token + Admin Role)  
**Status Code:** 200 OK  

**Response:**
```json
{
  "userId": "usr_123abc",
  "status": "APPROVED",
  "message": "User approved successfully"
}
```

---

#### POST `/admin/users/:userId/reject`
**Description:** Reject user verification  
**Authentication:** ✅ Required (Bearer Token + Admin Role)  
**Status Code:** 200 OK  

**Request:**
```json
{
  "reason": "Video quality too poor"
}
```

**Response:**
```json
{
  "userId": "usr_123abc",
  "status": "REJECTED",
  "rejectionReason": "Video quality too poor",
  "message": "User rejected successfully"
}
```

---

#### GET `/admin/dashboard/stats`
**Description:** Get admin dashboard statistics  
**Authentication:** ✅ Required (Bearer Token + Admin Role)  
**Status Code:** 200 OK  

**Response:**
```json
{
  "totalUsers": 150,
  "activeUsers": 120,
  "verificationStats": {
    "notStarted": 10,
    "pending": 5,
    "verified": 100,
    "rejected": 35
  },
  "conversionRates": {
    "signupToVerified": "66.67%",
    "verifiedToApproved": "100%",
    "approvedToSubscribed": "85%"
  },
  "revenue": {
    "totalRevenue": "$12,450.00",
    "monthlyRecurring": "$8,300.00",
    "topPlan": "Premium"
  }
}
```

---

### 7️⃣ WEBHOOK ENDPOINTS

#### POST `/auth/webhooks/cashfree`
**Description:** Handle Cashfree payment webhook events  
**Authentication:** None (Cashfree validates signature)  
**Status Code:** 200 OK  

**Event Types:**

**Payment Success:**
```json
{
  "type": "PAYMENT_SUCCESS",
  "data": {
    "order_id": "order_123",
    "payment_id": "payment_456",
    "amount": 9.99
  }
}
```

**Payment Failed:**
```json
{
  "type": "PAYMENT_FAILED",
  "data": {
    "order_id": "order_123",
    "error": "Card declined"
  }
}
```

---

### 8️⃣ ROOT ENDPOINT

#### GET `/`
**Description:** Health check - verify API is running  
**Authentication:** None  
**Status Code:** 200 OK  

**Response:**
```json
{
  "message": "Wisein API is running",
  "version": "1.0.0",
  "timestamp": "2025-11-12T10:50:00.000Z"
}
```

---

## 🔑 Authentication Token Usage

All protected endpoints require an `Authorization` header with a Bearer token:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Getting a Token:**
1. Call `/auth/signup` → Create account
2. Call `/auth/verify-otp` → Verify email and get token
3. OR Call `/auth/login` → Get token directly

**Token Expiry:**
- Access Token: 7 days
- Refresh Token: 30 days
- After expiry: Use refresh token to get new access token

---

## 📊 Common Error Responses

### 400 Bad Request
```json
{
  "message": "Invalid input",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 401 Unauthorized
```json
{
  "message": "Unauthorized",
  "error": "Unauthorized",
  "statusCode": 401
}
```

### 409 Conflict
```json
{
  "message": "Email already registered",
  "error": "Conflict",
  "statusCode": 409
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error",
  "error": "Internal Server Error",
  "statusCode": 500
}
```

---

## 🧪 Testing with HTTPie

### Install HTTPie:
```bash
pip install httpie
```

### Example Commands:

**Signup:**
```bash
http POST http://localhost:3000/auth/signup \
  email=user@example.com \
  password=SecurePass123! \
  name="John Doe"
```

**Login:**
```bash
http POST http://localhost:3000/auth/login \
  email=user@example.com \
  password=SecurePass123!
```

**Protected Endpoint:**
```bash
http GET http://localhost:3000/auth/onboarding-status \
  "Authorization: Bearer TOKEN_HERE"
```

**Get Subscription Plans:**
```bash
http GET http://localhost:3000/auth/subscription/plans
```

---

## 🔄 Complete User Journey

```
1. User Signs Up
   POST /auth/signup
   ↓
2. OTP Sent to Email
   (Automatic)
   ↓
3. User Verifies OTP
   POST /auth/verify-otp
   → Gets access token (EMAIL_VERIFIED)
   ↓
4. User Selects Country
   POST /auth/select-country
   ↓
5. User Verifies ID
   POST /auth/digilocker/verify (India)
   OR
   POST /auth/stripe-identity/verify (Other)
   → Status: ID_VERIFIED
   ↓
6. User Uploads Video
   POST /auth/upload-video
   → Status: VIDEO_VERIFIED
   ↓
7. Admin Reviews
   POST /admin/users/:userId/approve
   → Status: APPROVED
   ↓
8. User Selects Plan
   POST /auth/subscription/select-plan
   → Redirects to Cashfree checkout
   ↓
9. Payment Processed
   Webhook: POST /auth/webhooks/cashfree
   → Status: ACTIVE
   ↓
10. User Onboarded ✅
```

---

## 📝 Logging & Monitoring

### All Requests Logged:
- Request URL, method, parameters, body (sanitized)
- Response status, body, duration
- User ID and timestamp

### Sensitive Data Redacted:
- `password` → `[REDACTED]`
- `otp` → `[REDACTED]`
- `token` → `[REDACTED]`
- `secret` → `[REDACTED]`
- `apiKey` → `[REDACTED]`

### Log Levels:
- 🔵 DEBUG: Low-level details
- 🟢 LOG: Standard information
- 🟡 WARN: Warnings
- 🔴 ERROR: Errors with stack traces

---

## 🚀 Production Deployment Checklist

- [ ] Environment variables configured (.env)
- [ ] Database migrations run (Prisma)
- [ ] SMTP email credentials configured
- [ ] Cashfree sandbox credentials set
- [ ] JWT secret configured
- [ ] CORS configured for frontend domain
- [ ] Rate limiting enabled
- [ ] SSL/TLS certificates installed
- [ ] Logging aggregation configured
- [ ] Monitoring and alerts set up
- [ ] Backup strategy implemented
- [ ] Error tracking (Sentry) configured

---

## 📞 Support

For issues or questions, contact the backend team.

**Last Test Run:** November 12, 2025 ✅  
**All 22 APIs:** Working ✅
