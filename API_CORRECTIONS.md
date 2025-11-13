# API Endpoints Corrections

**Date:** November 13, 2025  
**Status:** Corrected

## Issues Found & Fixed

### Issue 1: Non-existent `/api/auth/register` Endpoint

**Before:** Documentation referenced `POST /api/auth/register`  
**Actual:** No such endpoint exists  
**Correction:** Updated to use actual OTP-based authentication flow:
 - `POST /api/auth/send-otp` - Initiates registration with OTP
 - `POST /api/auth/verify-otp` - Verifies OTP to complete registration

### Issue 2: Non-existent DigiLocker Endpoints

**Before:** Referenced non-existent endpoints:
-- `POST /api/digilocker/initiate`
-- `POST /api/digilocker/complete`
-- `GET /api/admin/digilocker/pending`
-- `GET /api/admin/digilocker/{userId}`
-- `POST /api/admin/digilocker/{userId}/approve`
-- `POST /api/admin/digilocker/{userId}/reject`

**Actual:** Correct endpoints are:
 - `POST /api/auth/select-country` - User selects country before DigiLocker
 - `POST /api/auth/digilocker/authorize` - Start DigiLocker verification
 - `POST /api/auth/digilocker/verify` - Verify DigiLocker response
 - `POST /api/auth/stripe-identity/create-session` - Alternative (Stripe Identity)
 - `POST /api/auth/stripe-identity/verify` - Verify Stripe Identity

### Issue 3: Non-existent Video Verification Endpoints

**Before:** Referenced non-existent endpoints:
-- `POST /api/video-verification/initiate`
-- `POST /api/video-verification/submit`
-- `GET /api/video-verification/status`
-- `POST /api/video-verification/admin/verify`
-- `POST /api/video-verification/admin/reject`
-- `GET /api/video-verification/admin/pending`

**Actual:** Correct endpoint is:
- `POST /api/auth/upload-video` - Upload/submit verification video

### Issue 4: Non-existent Logout Endpoint

**Before:** Referenced `POST /api/auth/logout`  
**Actual:** No logout endpoint (stateless JWT)  
**Correction:** Removed from documentation

---

## Corrected API Endpoints

### Authentication & Registration (OTP-based)

```
POST   /api/auth/send-otp                      (Initiate signup/email verification)
POST   /api/auth/verify-otp                    (Verify OTP for signup or login)
POST   /api/auth/login                         (Initiate login flow)
GET    /api/auth/debug/otp                     (Dev only - get OTP for testing)
POST   /api/auth/refresh-token                 (Refresh access token)
POST   /api/auth/select-country                (User selects country)
GET    /api/auth/verification/status           (Check verification status)
GET    /api/auth/onboarding-status             (Check onboarding progress)
```

### ID Verification (DigiLocker & Stripe Identity)

```
POST   /api/auth/digilocker/authorize          (Start DigiLocker verification)
POST   /api/auth/digilocker/verify             (Verify DigiLocker response)
POST   /api/auth/stripe-identity/create-session (Create Stripe Identity session)
POST   /api/auth/stripe-identity/verify        (Verify Stripe Identity response)
```

### Video Verification

```
POST   /api/auth/upload-video                  (Upload/submit verification video)
```

### Subscription Management

```
GET    /api/auth/subscription/plans            (Get available subscription plans)
POST   /api/auth/subscription/select-plan      (Select a subscription plan)
GET    /api/auth/subscription/current          (Get current subscription)
POST   /api/auth/subscription/cancel           (Cancel current subscription)
POST   /api/auth/webhooks/cashfree             (Cashfree webhook for payment updates)
```

---

## Files Updated

1. **`docs/INDEX.md`**
   - Fixed API endpoints listing
   - Updated integration examples (5 complete examples)
   - Fixed testing guides
   - Corrected error handling documentation

2. **`docs/guides/COMPLETE_VERIFICATION_FLOW.md`**
   - Phase 1: Updated to OTP-based signup (send-otp → verify-otp)
   - Phase 2: Fixed to use verify-otp for email verification
   - Phase 3: Updated to use correct auth/digilocker endpoints
   - Phase 4: Updated to use auth/upload-video endpoint
   - Removed non-existent video verification session logic

3. **Additional documentation** now reflects actual API

---

## Key Changes in User Flow

### Before (Incorrect)
```
register → verify-email link → digilocker/initiate → ... → video-verification/initiate → ...
```

### After (Correct)
```
send-otp → verify-otp → select-country → digilocker/authorize → digilocker/verify → upload-video
```

---

## Testing Commands (Corrected)

### Registration & Email Verification
```bash
# 1. Send OTP
http POST http://localhost:3000/api/auth/send-otp \
  email=test@example.com \
  username="testuser"

# 2. Get OTP (dev only)
http GET "http://localhost:3000/api/auth/debug/otp?email=test@example.com"

# 3. Verify OTP
http POST http://localhost:3000/api/auth/verify-otp \
  email=test@example.com \
  otp=123456
```

### Select Country
```bash
http POST http://localhost:3000/api/auth/select-country \
  Authorization:"Bearer $TOKEN" \
  country="India"
```

### DigiLocker Verification
```bash
# 1. Authorize
http POST http://localhost:3000/api/auth/digilocker/authorize \
  Authorization:"Bearer $TOKEN"

# 2. Verify (after Cashfree redirect)
http POST http://localhost:3000/api/auth/digilocker/verify \
  Authorization:"Bearer $TOKEN" \
  encryptedResponse="..."
```

### Video Upload
```bash
# Upload video file
http POST http://localhost:3000/api/auth/upload-video \
  Authorization:"Bearer $TOKEN" \
  < video.mp4
```

---

## Status

✅ All endpoint references corrected  
✅ Integration examples updated  
✅ Testing guides fixed  
✅ User flow documentation accurate  
✅ Complete verification flow documented correctly  

---

**Maintained by:** Backend Team  
**Last Updated:** November 13, 2025
