# Complete API Endpoints Reference

**Date:** November 13, 2025  
**Version:** 1.0 Complete  
**Status:** All endpoints documented

---

## Complete API Endpoint Mapping

### 1. Authentication & User Registration (Auth Module)

**Base Path:** `/api/auth`

```
POST   /send-otp                      - Initiate signup with OTP
POST   /verify-otp                    - Verify OTP (signup or login)
POST   /login                         - Initiate login with OTP
GET    /debug/otp                     - Dev only: Get OTP for testing
POST   /refresh-token                 - Refresh access token
POST   /select-country                - User selects country
GET    /verification/status           - Check verification status
GET    /onboarding-status             - Check onboarding progress
POST   /upload-video                  - Upload verification video
POST   /webhooks/cashfree             - Cashfree webhook handler
```

### 2. ID Verification - DigiLocker (DigiLocker Module)

**Base Path:** `/api/digilocker`

```
POST   /initiate                      - Initiate DigiLocker verification
POST   /callback                      - Handle DigiLocker callback
POST   /complete                      - Complete DigiLocker verification
GET    /status/:verificationId        - Get verification status
GET    /user-status                   - Get user's DigiLocker status
POST   /admin/cleanup-expired         - Admin: Clean up expired sessions
GET    /health                        - Health check
```

### 3. ID Verification - Alternative (Stripe Identity via Auth Module)

**Base Path:** `/api/auth`

```
POST   /stripe-identity/create-session - Create Stripe Identity session
POST   /stripe-identity/verify         - Verify Stripe Identity result
```

### 4. ID Verification - Alternative (DigiLocker via Auth Module)

**Base Path:** `/api/auth`

```
POST   /digilocker/authorize          - Authorize DigiLocker (alternative)
POST   /digilocker/verify             - Verify DigiLocker (alternative)
```

### 5. Video Verification (Video Verification Module)

**Base Path:** `/api/video-verification`

```
POST   /initiate                      - Initiate video session
POST   /submit                        - Submit recorded video
GET    /status                        - Get video verification status
POST   /admin/verify                  - Admin: Approve video
POST   /admin/reject                  - Admin: Reject video
GET    /admin/pending                 - Admin: Get pending videos
GET    /health                        - Health check
```

### 6. Subscription Management (Auth Module)

**Base Path:** `/api/auth/subscription`

```
GET    /plans                         - Get available plans
POST   /select-plan                   - Select subscription plan
GET    /current                       - Get current subscription
POST   /cancel                        - Cancel subscription
```

### 7. Admin Operations (Admin Module)

**Base Path:** `/api/admin`

```
GET    /users/pending                 - Get pending users
GET    /users/:id                     - Get user details
POST   /users/:id/approve             - Approve user
POST   /users/:id/reject              - Reject user
GET    /dashboard/stats               - Get dashboard statistics
```

### 8. Health & System (App Module)

**Base Path:** `/`

```
GET    /                              - Health check / Welcome message
```

---

## Endpoint Usage by User Flow

### Complete Onboarding Flow

```
1. send-otp                  (Auth)          → User initiates signup
2. verify-otp               (Auth)          → User verifies email
3. select-country           (Auth)          → User selects country
4. initiate                 (DigiLocker)    → Start ID verification
5. [User redirected to DigiLocker]
6. callback                 (DigiLocker)    → DigiLocker returns data
7. complete                 (DigiLocker)    → Confirm verification
8. [Admin reviews: users/pending → users/:id/approve]
9. initiate                 (Video)         → Start video verification
10. submit                  (Video)         → Submit video
11. [Admin reviews: admin/pending → admin/verify]
12. [Auto-complete onboarding]
13. select-plan             (Auth)          → Choose subscription
14. [Payment processing via Cashfree webhook]
```

---

## Authentication & Security

### JWT Tokens

**Access Token:**
- Validity: 7 days
- Used for: API requests (Authorization header)
- Endpoint: `/auth/send-otp` → `/auth/verify-otp`

**Refresh Token:**
- Validity: 30 days
- Used for: Refreshing access token
- Endpoint: `/auth/refresh-token`

### Protected Endpoints

All endpoints marked with `@UseGuards(JwtAuthGuard)` require valid JWT token:

```
Authorization: Bearer <access_token>
```

**Unprotected Endpoints:**
- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `POST /auth/login`
- `GET /auth/debug/otp` (dev only)
- `GET /auth/subscription/plans`
- `POST /auth/webhooks/cashfree`
- `GET /` (root)

---

## Status Codes & Responses

### Success Responses

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Verification complete |
| 201 | Created | New record created |

### Error Responses

| Code | Meaning | When |
|------|---------|------|
| 400 | Bad Request | Invalid input, missing fields |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Not admin, permission denied |
| 404 | Not Found | User/resource doesn't exist |
| 409 | Conflict | Email already exists, account verified |
| 500 | Server Error | Database/processing error |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

---

## Module Structure

### Auth Module (`/src/auth`)
- **Controller:** `auth.controller.ts` (18 endpoints)
- **Services:** 
  - `auth.service.ts` - Authentication logic
  - `otp.service.ts` - OTP management
  - `verification.service.ts` - Verification logic
  - `subscription.service.ts` - Subscription management

### DigiLocker Module (`/src/digilocker`)
- **Controller:** `digilocker.controller.ts` (7 endpoints)
- **Service:** `digilocker-verification.service.ts`
- **Purpose:** ID verification via DigiLocker/Cashfree

### Video Verification Module (`/src/video-verification`)
- **Controller:** `video-verification.controller.ts` (7 endpoints)
- **Service:** `video-verification.service.ts`
- **Purpose:** Liveness & face matching verification

### Admin Module (`/src/admin`)
- **Controller:** `admin.controller.ts` (5 endpoints)
- **Service:** `admin.service.ts`
- **Purpose:** Admin approval workflow

---

## Database Models

### User
```
- id: string (primary)
- email: string (unique)
- username: string
- status: enum (REGISTERED, EMAIL_VERIFIED, ID_VERIFIED, VIDEO_VERIFIED, VERIFIED)
- emailVerified: boolean
- country: string
- createdAt, updatedAt
```

### UserVerification
```
- userId: string (FK to User)
- digiLockerData: JSON (extracted from DigiLocker)
- verificationSource: enum (DIGILOCKER, STRIPE_IDENTITY)
- verified: boolean
- verifiedBy: string (admin ID)
- verifiedAt: DateTime
```

### UserVideoVerification
```
- userId: string (FK to User, unique)
- videoUrl: string
- videoDuration: number
- videoFormat: string
- videoSize: number
- status: enum (PENDING, VERIFIED, REJECTED, FAILED)
- verified: boolean
- verifiedBy: string (admin ID)
- faceMatchScore: number (0.0-1.0)
- verifiedAt: DateTime
```

### VideoVerificationSession
```
- sessionId: string (unique)
- userId: string (FK to User)
- status: enum (INITIATED, RECORDING, SUBMITTED, PROCESSING, COMPLETED, EXPIRED)
- recordingUrl: string
- expiresAt: DateTime
```

### Subscription
```
- userId: string (FK to User)
- planId: string
- status: enum (ACTIVE, CANCELLED, EXPIRED)
- startDate, endDate, renewalDate
- amount, currency
```

---

## Common Request/Response Examples

### Example 1: Registration (OTP-based)

**Step 1: Send OTP**
```bash
POST /api/auth/send-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe"
}

Response (200):
{
  "message": "OTP sent to your email",
  "status": 200
}
```

**Step 2: Verify OTP**
```bash
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}

Response (200):
{
  "userId": "clx...",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "message": "Email verified successfully"
}
```

### Example 2: Select Country & DigiLocker

```bash
# Select country
POST /api/auth/select-country
Authorization: Bearer <accessToken>

{
  "country": "India"
}

# Initiate DigiLocker
POST /api/digilocker/initiate
Authorization: Bearer <accessToken>

{
  "mobileNumber": "9876543210"
}

Response (200):
{
  "success": true,
  "accountExists": true,
  "consentUrl": "https://...",
  "verificationId": "VER_...",
  "message": "DigiLocker account found"
}
```

### Example 3: Video Upload

```bash
POST /api/video-verification/initiate
Authorization: Bearer <accessToken>

Response (200):
{
  "success": true,
  "sessionId": "VID_...",
  "expiresAt": "2025-11-13T23:45:00Z",
  "instructions": {...}
}

# Then submit video
POST /api/video-verification/submit
Authorization: Bearer <accessToken>

{
  "sessionId": "VID_...",
  "videoUrl": "https://storage.com/video.mp4",
  "videoDuration": 28,
  "videoFormat": "mp4",
  "videoSize": 5242880
}
```

### Example 4: Admin Approval

```bash
# Get pending users
GET /api/admin/users/pending
Authorization: Bearer <adminToken>

# Get user details
GET /api/admin/users/user_123
Authorization: Bearer <adminToken>

# Approve user
POST /api/admin/users/user_123/approve
Authorization: Bearer <adminToken>

{
  "notes": "Verification approved"
}
```

---

## Testing

### Development Helper Endpoints

```bash
# Get OTP without email (dev only)
GET /api/auth/debug/otp?email=test@example.com

# Video verification health check
GET /api/video-verification/health

# DigiLocker health check
GET /api/digilocker/health
```

### Testing Flow

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser"}'

# 2. Get OTP (dev)
curl http://localhost:3000/api/auth/debug/otp?email=test@example.com

# 3. Verify
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'

# 4. Get token from response, use in Authorization header
# 5. Continue with select-country, digilocker, video, etc.
```

---

## Important Notes

### Two Ways to Access Verification

**Option 1: Via Auth Module (Simplified)**
-- `/api/auth/digilocker/authorize`
-- `/api/auth/digilocker/verify`
-- `/api/auth/stripe-identity/create-session`
-- `/api/auth/stripe-identity/verify`

**Option 2: Via Dedicated Modules (Advanced)**
-- `/api/digilocker/*` - Full DigiLocker integration
-- `/api/video-verification/*` - Complete video verification

Use Option 2 for more control and detailed status tracking.

### Session & Expiry

- **DigiLocker Session:** 30 minutes
- **Video Recording Window:** 30 minutes
- **OTP Validity:** 10 minutes
- **Access Token:** 7 days
- **Refresh Token:** 30 days

---

**Last Updated:** November 13, 2025  
**Maintained by:** Backend Team
