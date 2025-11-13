# Authentication Flow Documentation

## Overview

The authentication system uses a **unified OTP-based flow** for both registration and login. The same verification endpoint handles both flows by detecting the OTP purpose (register vs login) stored server-side. This design eliminates duplicate code and simplifies the client integration.

---

## Key Design Principles

1. **Single OTP verification endpoint** — `POST /auth/verify-otp` handles both registration and login verification.
2. **OTP purpose tagging** — OTPs are stored with a `purpose` field ('register' | 'login') to disambiguate flows.
3. **In-memory OTP storage** (development) — OTPs are kept in memory with expiry and attempt tracking. For production, migrate to Redis with TTL and atomic operations.
4. **Unified token issuance** — Both flows issue access + refresh tokens after successful verification.
5. **User status-based logic** — Registration verification marks the user `EMAIL_VERIFIED`; login verification does not change status (user must already be EMAIL_VERIFIED or higher).

---

## Registration Flow

### Step 1: Send OTP for Registration

**Endpoint:** `POST /auth/send-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username123"
}
```

**Request Validation:**
- `email`: must be valid email format and unique in the database.
- `username`: 3–20 characters, must be unique in the database.

**Server Actions:**
1. Check if email already exists → return `409 Conflict` if user found.
2. Check if username already exists → return `409 Conflict` if duplicate.
3. Create a new user in the database with:
   - `email`
   - `username`
   - `status`: `REGISTERED` (initial state)
   - `role`: `INDIVIDUAL` (default)
4. Generate a 6-digit OTP.
5. Store OTP in memory with metadata:
   - `email` (key)
   - `otp`: 6-digit code
   - `expiresAt`: 10 minutes from now
   - `attempts`: 0 (failed attempts counter)
   - `purpose`: `'register'`
   - `username`: stored for reference
6. Send OTP via email using `MailService`:
   - Attempts SMTP send to user's email.
   - Falls back to console.log if mail delivery fails (development mode).
7. Return response.

**Response (Success - 201):**
```json
{
  "userId": "user-id-here",
  "message": "OTP sent successfully",
  "status": 200
}
```

**Response (Email Exists - 409):**
```json
{
  "statusCode": 409,
  "message": "User already exists with this email",
  "error": "Conflict"
}
```

**Response (Username Taken - 409):**
```json
{
  "statusCode": 409,
  "message": "Username already taken",
  "error": "Conflict"
}
```

---

### Step 2: Verify OTP for Registration

**Endpoint:** `POST /auth/verify-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Request Validation:**
- `email`: must be valid email format.
- `otp`: must be exactly 6 digits.

**Server Actions:**
1. Look up the OTP record in memory using `email` as key.
2. If not found → return `400 Bad Request` "No OTP found for this email".
3. Check if OTP has expired (compared to `expiresAt`):
   - If expired → delete OTP record and return `400 Bad Request` "OTP has expired".
4. Check if too many failed attempts (`attempts >= 3`):
   - If exceeded → delete OTP record and return `400 Bad Request` "Too many failed attempts. Request a new OTP."
5. Compare provided OTP with stored OTP:
   - If mismatch → increment `attempts` counter and return `400 Bad Request` "Invalid OTP".
6. **If OTP is valid:**
   - Look up user by email in database.
   - Update user's `status` from `REGISTERED` to `EMAIL_VERIFIED`.
   - Create an `OtpVerification` audit record in the database:
     - `userId`: user's ID
     - `otp`: the OTP that was verified
     - `expiresAt`: expiry time
     - `attempts`: final attempt count
     - `isVerified`: `true`
   - Delete OTP from memory (consumed).
7. Generate JWT access token:
   - Payload: `{ sub: userId, email }`
   - Expiry: 7 days
8. Generate JWT refresh token:
   - Payload: `{ sub: userId, type: 'refresh' }`
   - Expiry: 30 days
9. Persist refresh token to database (`RefreshToken` table):
   - `userId`: user's ID
   - `token`: refresh token
   - `expiresAt`: 30 days from now
10. Return response with both tokens.

**Response (Success - 201):**
```json
{
  "userId": "user-id-here",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "message": "Email verified successfully."
}
```

**Response (No OTP - 400):**
```json
{
  "statusCode": 400,
  "message": "No OTP found for this email",
  "error": "Bad Request"
}
```

**Response (Invalid OTP - 400):**
```json
{
  "statusCode": 400,
  "message": "Invalid OTP",
  "error": "Bad Request"
}
```

---

## Login Flow

### Step 1: Send OTP for Login

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Request Validation:**
- `email`: must be valid email format.

**Server Actions:**
1. Look up user by email in database.
2. If user not found → return `401 Unauthorized` "User not found. Please register first using /auth/send-otp".
3. Check user's status:
   - If status is `REGISTERED` (not yet verified) → return `400 Bad Request` "Please verify your email first."
   - User must be `EMAIL_VERIFIED` or higher to proceed.
4. Generate a 6-digit OTP.
5. Store OTP in memory with metadata:
   - `email` (key)
   - `otp`: 6-digit code
   - `expiresAt`: 10 minutes from now
   - `attempts`: 0
   - `purpose`: `'login'`
   - `username`: not stored for login flow
6. Send OTP via email using `MailService`:
   - Attempts SMTP send to user's email.
   - Falls back to console.log if mail delivery fails.
7. Return response.

**Response (Success - 200):**
```json
{
  "message": "OTP sent to your email",
  "status": 200
}
```

**Response (User Not Found - 401):**
```json
{
  "statusCode": 401,
  "message": "User not found. Please register first using /auth/send-otp",
  "error": "Unauthorized"
}
```

**Response (User Not Verified - 400):**
```json
{
  "statusCode": 400,
  "message": "Please verify your email first.",
  "error": "Bad Request"
}
```

---

### Step 2: Verify OTP for Login

**Endpoint:** `POST /auth/verify-otp` (Same endpoint as registration)

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "654321"
}
```

**Server Actions:**
1. Look up the OTP record in memory using `email` as key.
2. If not found → return `400 Bad Request` "No OTP found for this email".
3. Check if OTP has expired:
   - If expired → delete OTP record and return `400 Bad Request` "OTP has expired".
4. Check if too many failed attempts (`attempts >= 3`):
   - If exceeded → delete OTP record and return `400 Bad Request` "Too many failed attempts. Request a new OTP."
5. Compare provided OTP with stored OTP:
   - If mismatch → increment `attempts` counter and return `400 Bad Request` "Invalid OTP".
6. **If OTP is valid:**
   - Check the OTP record's `purpose` field:
     - If `purpose === 'register'` → execute registration verification logic (see Registration Step 2).
     - If `purpose === 'login'` → execute login verification logic below.
7. **For login verification:**
   - Look up user by email in database.
   - **Do NOT change user status** (user is already EMAIL_VERIFIED or higher).
   - Delete OTP from memory (consumed).
   - Generate JWT access token (same as registration).
   - Generate JWT refresh token (same as registration).
   - Persist refresh token to database (`RefreshToken` table).
   - Return response with both tokens.

**Response (Success - 200):**
```json
{
  "userId": "user-id-here",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "message": "Login successful"
}
```

**Response (Invalid OTP - 400):**
```json
{
  "statusCode": 400,
  "message": "Invalid OTP",
  "error": "Bad Request"
}
```

---

## Development Helper

### Get OTP (Dev Only)

**Endpoint:** `GET /auth/debug/otp?email=...`

**Query Parameters:**
- `email`: the email address for which to retrieve the OTP.

**Authorization:** None (dev only; disabled in production).

**Response:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (No OTP):**
```json
{
  "email": "user@example.com",
  "otp": null
}
```

**Response (Production):**
```json
{
  "statusCode": 403,
  "message": "Not allowed in production",
  "error": "Forbidden"
}
```

---

## Data Models

### OTP Storage (In-Memory)

**Key:** `email` (string)

**Value:** 
```typescript
{
  otp: string;           // 6-digit code
  expiresAt: Date;       // 10 minutes from generation
  attempts: number;      // Failed attempt counter (max 3)
  purpose: 'register' | 'login';  // Disambiguates flow
  username?: string;     // Only for registration flow
}
```

---

### Database Schema

#### User Table
```
id: string (CUID)
email: string (unique)
username: string? (unique, nullable)
status: UserStatus (REGISTERED | EMAIL_VERIFIED | ID_VERIFIED | ...)
role: UserRole (INDIVIDUAL | COMPANY_ADMIN | ADMIN)
passwordHash: string? (nullable)
createdAt: DateTime
updatedAt: DateTime
...other fields
```

#### OtpVerification Table (Audit)
```
id: string (CUID)
userId: string (foreign key to User, unique)
otp: string
expiresAt: DateTime
attempts: number
isVerified: boolean
createdAt: DateTime
updatedAt: DateTime
```

#### RefreshToken Table
```
id: string (CUID)
userId: string (foreign key to User)
token: string (unique, the actual JWT)
expiresAt: DateTime
createdAt: DateTime
updatedAt: DateTime
```

---

## Error Handling

| Status | Scenario | Message |
|--------|----------|---------|
| 400 | Email already exists | "User already exists with this email" |
| 400 | Username already taken | "Username already taken" |
| 400 | No OTP found | "No OTP found for this email" |
| 400 | OTP expired | "OTP has expired" |
| 400 | Too many attempts | "Too many failed attempts. Request a new OTP." |
| 400 | Invalid OTP | "Invalid OTP" |
| 400 | User not verified | "Please verify your email first." |
| 401 | User not found (login) | "User not found. Please register first using /auth/send-otp" |
| 403 | Debug endpoint in production | "Not allowed in production" |

---

## Security Considerations

1. **OTP Expiry:** OTPs expire after 10 minutes to prevent brute-force attacks.
2. **Attempt Limiting:** Maximum 3 failed OTP verification attempts before the OTP is invalidated.
3. **Token Expiry:**
   - Access tokens: 7 days (can be shortened to hours for stricter security).
   - Refresh tokens: 30 days (can be shortened for newly registered accounts).
4. **Refresh Token Rotation (Recommended for Production):**
   - Issue a new refresh token on each use.
   - Invalidate the old refresh token immediately.
   - Prevents token replay and reuse attacks.
5. **Rate Limiting (Recommended):**
   - Limit OTP send requests per email (e.g., 3 per hour).
   - Limit OTP send requests per IP address (e.g., 10 per hour).
   - Implement exponential backoff for repeated failures.
6. **HTTPS Only:** In production, enforce HTTPS to prevent token interception.
7. **HttpOnly Cookies:** Store refresh tokens in HttpOnly, Secure cookies (if browser-based).
8. **OTP Storage Upgrade:** For production, replace in-memory storage with Redis:
   - Atomic operations (check-and-delete prevents race conditions).
   - TTL support (automatic cleanup).
   - Distributed cache support (multiple backend instances).

---

## Testing Workflow

### Quick Test (Using HTTPie)

```bash
# 1. Send registration OTP
http POST http://localhost:3000/auth/send-otp \
  email=testuser@example.com \
  username=testuser123

# 2. Get OTP (dev only)
http GET http://localhost:3000/auth/debug/otp \
  email=testuser@example.com

# 3. Verify registration OTP
http POST http://localhost:3000/auth/verify-otp \
  email=testuser@example.com \
  otp=123456

# 4. Send login OTP
http POST http://localhost:3000/auth/login \
  email=testuser@example.com

# 5. Get login OTP (dev only)
http GET http://localhost:3000/auth/debug/otp \
  email=testuser@example.com

# 6. Verify login OTP
http POST http://localhost:3000/auth/verify-otp \
  email=testuser@example.com \
  otp=654321
```

### Using cURL

```bash
# Send registration OTP
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","username":"testuser123"}'

# Get OTP
curl "http://localhost:3000/auth/debug/otp?email=testuser@example.com"

# Verify OTP
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","otp":"123456"}'
```

---

## Future Enhancements

1. **Redis-backed OTP storage** — Replace in-memory store for distributed, production-ready caching.
2. **Refresh token rotation** — Issue new refresh token on each use; invalidate old token.
3. **Rate limiting** — Prevent brute-force and abuse via rate-limit middleware.
4. **Device fingerprinting** — Track and allow revoking tokens per device.
5. **Two-factor authentication (2FA)** — Require SMS/TOTP after email verification.
6. **Account recovery** — Add forgot-password flow using recovery codes.
7. **Audit logging** — Enhanced logging of authentication events for security analysis.
8. **Email verification link** — Alternative to OTP for less tech-savvy users.

---

## Implementation Details

### Key Services

- **`OtpService`** — Handles OTP generation, storage, and verification.
- **`AuthService`** — Orchestrates signup, login, and token generation.
- **`MailService`** — Sends OTP emails via SMTP (fallback to console).
- **`JwtService`** (NestJS) — JWT token generation and verification.

### Key DTOs (Data Transfer Objects)

- **`SendOtpDto`** — `{ email, username }` for registration OTP request.
- **`VerifyOtpDto`** — `{ email, otp }` for OTP verification (registration or login).
- **`LoginDto`** — `{ email }` for login OTP request.

### Key Controller Routes

- `POST /auth/send-otp` — Start registration flow.
- `POST /auth/verify-otp` — Complete registration or login verification.
- `POST /auth/login` — Start login flow.
- `GET /auth/debug/otp` — Retrieve in-memory OTP (dev only).

---

## Conclusion

This unified OTP-based authentication system provides:
- ✅ **Simplified API** — One verify endpoint for both registration and login.
- ✅ **Reduced code duplication** — Shared OTP logic and token issuance.
- ✅ **Clear flow** — Purpose tagging disambiguates OTP use.
- ✅ **Development friendly** — Debug endpoint for easy local testing.
- ✅ **Production ready** — Extensible design for future security enhancements (Redis, rate-limiting, 2FA).
