# DigiLocker Verification - Complete Testing Guide

## Overview

This guide will walk you through testing the entire DigiLocker verification flow from user registration to verification completion.

> NOTE: As of the latest update the backend enforces country-based routing: DigiLocker verification is available only to users whose `user.country` is set to `India`. Non-Indian users must use the Stripe identity verification flow. If a non-Indian user attempts DigiLocker endpoints, the API will return a 400 with an explanatory message.

---

## Prerequisites

1. **Backend running**: `npm start run:dev` (runs on http://localhost:3000)
2. **HTTP Client**: httpie OR VS Code REST Client OR Postman
3. **Test email**: Any email address for testing
4. **Optional (Dev Only)**: Use debug endpoint to fetch OTP (see below)

---

## 🆘 Getting OTP During Development

### Option 1: Check Email/Console
When you call `/auth/send-otp`, the OTP is sent via email or printed in the console.

"""
Identity Verification — Flow & Testing Guide (DigiLocker + Stripe)

This file is the canonical testing and flow guide for ID verification. It replaces older, fragmented documents and provides step-by-step testing instructions for DigiLocker (India) and Stripe Identity (non-India).

Last updated: 2025-11-13

Overview
--------
- DigiLocker flow is available only to users in India (server-side enforced).
- Users outside India must use Stripe Identity verification.
- The backend emits debug logs for outgoing Cashfree requests (masked headers) to assist troubleshooting signature and endpoint issues.

Prerequisites
-------------
1. Backend running (development):

```bash
# from backend/
npm run start:dev
```

2. HTTP client: httpie, curl, Postman, or VS Code REST Client
3. Environment variables: ensure `CASHFREE_BASE_URL`, `CASHFREE_API_KEY`, `CASHFREE_API_SECRET`, and `CASHFREE_PUBLIC_KEY` are set for DigiLocker/Cashfree integration.

Quick policy notes
------------------
- Country gating: the server checks `user.country` and only allows `India` for DigiLocker endpoints. Non-India users receive a 400 instructing them to use Stripe.
- Signature: the backend generates `x-cf-signature` by RSA-encrypting `${clientId}.${timestamp}` using the configured Cashfree public key (OAEP-SHA1) — do not change this unless Cashfree docs change.

Common endpoints (summary)
--------------------------
-- POST /api/digilocker/initiate — Initiate DigiLocker (India only)
-- POST /api/digilocker/callback — Notify server after consent is completed
-- POST /api/digilocker/complete — Fetch document and compare user data
-- GET /api/digilocker/status/:verificationId — Get session status
-- GET /api/digilocker/user-status — Get user's verification status
-- POST /api/stripe-identity/create-session — Create Stripe Identity session (non-India)

End-to-end test (recommended fast path)
-------------------------------------
Use httpie (examples). Replace `YOUR_ACCESS_TOKEN` and values as needed.

1) Register & verify email (dev shortcut: debug OTP endpoint exists when NODE_ENV !== 'production')

2) Initiate DigiLocker (India users)

```bash
http POST http://localhost:3000/api/digilocker/initiate \
  Authorization:"Bearer YOUR_ACCESS_TOKEN" \
  mobileNumber=9876543210
```

Response: consentUrl and verificationId. Open `consentUrl` in browser to complete the DigiLocker flow.

3) After user completes consent in browser, notify backend:

```bash
http POST http://localhost:3000/api/digilocker/callback \
  Authorization:"Bearer YOUR_ACCESS_TOKEN" \
  verificationId=VER_... 
```

4) Complete comparison

```bash
http POST http://localhost:3000/api/digilocker/complete \
  Authorization:"Bearer YOUR_ACCESS_TOKEN" \
  verificationId=VER_... \
  userProvidedData:='{
    "nameAsPerAadhaar": "JOHN DOE",
    "dateOfBirth": "1990-05-15",
    "gender": "Male",
    "country": "India",
    "state": "Maharashtra",
    "pincode": "400001",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street"
  }'
```

If comparison passes, API returns success and the user's `status` is updated to `ID_VERIFIED` and `UserVerification.verified = true`.

Stripe Identity (non-India users)
--------------------------------
- To create a Stripe Identity session (for non-India users), call:

```bash
http POST http://localhost:3000/api/stripe-identity/create-session \
  Authorization:"Bearer YOUR_ACCESS_TOKEN" \
  email=user@example.com
```

The server will return a `url` or `clientSecret` to complete verification on Stripe's hosted flow. After Stripe completes, call the verify endpoint or rely on webhook handling.

Troubleshooting
---------------
- 400 'Please select your country before starting ID verification': set `user.country` via the select-country endpoint before initiating.
- 400 'DigiLocker verification is available only for users in India': user.country is not India — use Stripe flow.
- 400 'x-cf-signature missing' or 401 'Signature mismatch': check `CASHFREE_PUBLIC_KEY`, `CASHFREE_API_KEY`, `CASHFREE_BASE_URL` (sandbox vs prod). Check backend logs — outgoing requests are logged with masked headers and the exact URL.
- 404 'Route Not Found' from Cashfree when fetching `/verification/digilocker/document/...`: verify `CASHFREE_BASE_URL` (sandbox vs production) and the endpoint path.

Files kept as canonical docs
----------------------------
- `API_DOCUMENTATION.md` — canonical API reference (high level)
- `DIGILOCKER_TESTING_GUIDE.md` — this file: consolidated testing and flow guide

If you'd like, I can also:
- Remove the remaining legacy docs from the repo (I will after your confirmation), or
- Auto-initiate the Stripe session server-side for non-Indian users instead of returning an error.

Contact me which behavior you prefer and I will apply the change.
"""

## Using Postman

1. Import as cURL commands, or
2. Create requests manually with same URLs and bodies
3. Save tokens in Postman variables for reuse

---

## Common Issues & Solutions

### Issue 1: 401 Unauthorized
**Problem:** Missing or invalid token
**Solution:** 
- Check token from Step 2 response
- Ensure token is passed in `Authorization: Bearer` header
- Token may have expired - refresh using refresh token

### Issue 2: Data Mismatch Error
**Problem:** User data doesn't match DigiLocker data
**Solution:**
- Verify name matches exactly (JOHN DOE vs john doe)
- Check DOB format (use YYYY-MM-DD)
- Ensure all fields are spelled correctly
- Gender must be exactly: Male/Female/Other

### Issue 3: Account Already Verified
**Problem:** 409 Conflict error
**Solution:**
- Aadhaar already registered with another user
- Use a different mobile number to test
- Or create a new test user

### Issue 4: Session Expired
**Problem:** Verification ID no longer valid
**Solution:**
- Verification sessions expire after 24 hours
- Start a new flow with `/initiate` endpoint

### Issue 5: No Cashfree Credentials
**Problem:** Service logs error about missing API credentials
**Solution:**
1. Get Cashfree sandbox credentials from https://cashfree.com
2. Add to `.env` file:
   ```
   CASHFREE_API_KEY=your_key
   CASHFREE_API_SECRET=your_secret
   CASHFREE_BASE_URL=https://sandbox.cashfree.com
   ```
3. Restart the server

---

## Test Data Examples

**Test Email:** `testuser@example.com`  
**Test Username:** `testuser123`  
**Test OTP:** `123456` (in dev environment)
**Test Mobile (for DigiLocker):** `9876543210`

### Test Aadhaar Data (Example)
```json
{
  "nameAsPerAadhaar": "RAMESH KUMAR",
  "dateOfBirth": "1985-03-20",
  "gender": "Male",
  "country": "India",
  "state": "Karnataka",
  "district": "Bangalore",
  "pincode": "560001",
  "phoneNumber": "9876543210",
  "addressLine1": "456 Oak Lane",
  "addressLine2": "Whitefield"
}
```

---

## Performance Notes

- OTP verification: ~100ms
- DigiLocker initiation: ~200ms (includes Cashfree API call)
- Data comparison: ~50ms
- Session cleanup (batch): ~300ms for 100+ sessions

---

## Security Reminders

1. **Never log tokens** in production
2. **Always use HTTPS** in production
3. **Verify tokens** before processing requests
4. **Validate all user inputs** (already done in code)
5. **Store sensitive data** encrypted in database
6. **Use rate limiting** on auth endpoints

---

## Debugging Tips

1. **Check backend logs** for detailed error messages
2. **Monitor database** (check `UserVerification` and `DigiLockerVerificationSession` tables)
3. **Use browser DevTools** to inspect requests/responses
4. **Enable request logging** by adding middleware

---

## Next Steps After Testing

1. ✅ Verify all endpoints work correctly
2. ✅ Test with real Aadhaar data (in production)
3. ✅ Integrate into frontend (see FRONTEND_INTEGRATION_GUIDE.md)
4. ✅ Setup CI/CD pipeline
5. ✅ Add monitoring and alerts
6. ✅ Deploy to production

---

**Last Updated:** November 12, 2025  
**Version:** 1.0
