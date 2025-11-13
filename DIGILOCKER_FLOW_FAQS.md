# Quick Answers - DigiLocker Integration FAQs

**Date:** November 13, 2025

---

## ❓ Question 1: "We have a route to get otp during dev.. how is this used?"

### Answer: Yes, there's a debug endpoint for rapid local testing

**Endpoint:** `GET /auth/debug/otp`

### How to Use It:

```bash
# Step 1: Send OTP (creates the OTP)
http POST http://localhost:3000/auth/send-otp \
  email=testuser@example.com \
  username=testuser123

# Step 2: Retrieve OTP without waiting for email delivery
http GET http://localhost:3000/auth/debug/otp email==testuser@example.com

# Response:
{
  "email": "testuser@example.com",
  "otp": "123456"
}

# Step 3: Use that OTP to verify
http POST http://localhost:3000/auth/verify-otp \
  email=testuser@example.com \
  otp=123456
```

### Why It Exists:
- 🚀 **Speed:** No need to wait for email delivery during local testing
- 🔧 **Dev-friendly:** Accelerates iteration
- 📧 **Email-less:** Works without configuring email service

### Important Notes:
✅ **Works in development** (`NODE_ENV !== 'production'`)  
❌ **Disabled in production** (returns 403 Forbidden)  
⚠️ Use only for local testing, not staging/production

---

## ❓ Question 2: "Is this according to the actual flow? Or are we missing anything?"

### Answer: **YES, this IS the actual, complete flow.** ✅

### What's Implemented:

```
┌─────────────────────────────────────────────────┐
│ PHASE 1: EMAIL AUTHENTICATION                   │
├─────────────────────────────────────────────────┤
│ 1. POST /auth/send-otp                         │
│    Input: email + username                      │
│    Output: OTP sent (and retrievable via debug) │
│                                                 │
│ 2. POST /auth/verify-otp                       │
│    Input: email + otp                          │
│    Output: accessToken + refreshToken           │
│    Status: User is now EMAIL_VERIFIED           │
│                                                 │
│ 3. [OPTIONAL] POST /auth/select-country        │
│    Input: country code                         │
│    Output: Country preference saved             │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ PHASE 2: DIGILOCKER AADHAAR VERIFICATION        │
├─────────────────────────────────────────────────┤
│ 4. POST /digilocker/initiate                   │
│    Input: mobileNumber (Aadhaar-linked)        │
│    Output: consentUrl + verificationId          │
│    Status: Session INITIATED                    │
│                                                 │
│ 5. [BROWSER] Open consentUrl                   │
│    User authenticates with Aadhaar/DigiLocker  │
│    Cashfree handles entire auth flow            │
│                                                 │
│ 6. POST /digilocker/callback                   │
│    Input: verificationId                        │
│    Output: Status AUTHENTICATED                 │
│    Status: Session AUTHENTICATED                │
│                                                 │
│ 7. POST /digilocker/complete                   │
│    Input: verificationId + userProvidedData    │
│    Action: Compare Aadhaar data vs provided    │
│    Output: Verification result + comparison     │
│    Status: User is now ID_VERIFIED ✅           │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ PHASE 3: STATUS VERIFICATION (Anytime)          │
├─────────────────────────────────────────────────┤
│ 8. GET /digilocker/user-status                 │
│    Output: { verified: true/false }             │
│    ✅ USE THIS TO CHECK IF VERIFIED             │
└─────────────────────────────────────────────────┘
```

### Is Anything Missing? **NO.** ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Email OTP auth | ✅ Complete | Industry standard |
| JWT tokens | ✅ Complete | 7-day access, 30-day refresh |
| DigiLocker integration | ✅ Complete | Full Aadhaar verification |
| Data comparison | ✅ Complete | Detailed match/mismatch reporting |
| Session management | ✅ Complete | Auto-cleanup after 24 hours |
| Error handling | ✅ Complete | Comprehensive error responses |
| Database schema | ✅ Complete | All fields for verification tracking |
| Testing guides | ✅ Complete | Multiple formats (HTTP, curl, bash) |
| Debug endpoints | ✅ Complete | Dev-only OTP retrieval |

### What About Production?

| Item | Status |
|------|--------|
| Email service | ⚠️ Needs config (SendGrid, AWS SES, etc.) |
| Cashfree credentials | ⚠️ Needs your API keys |
| Database | ⚠️ Needs your PostgreSQL instance |
| Logging | ✅ Ready (using NestJS Logger) |
| Rate limiting | ⚠️ Recommended to add |
| HTTPS | ✅ Code is HTTPS-ready |

---

## ❓ Question 3: "How do we know whether digilocker verification is complete?"

### Answer: Check the `verified` field in the user-status endpoint

### Method 1: Via API (Recommended) ⭐

```bash
http GET http://localhost:3000/api/v1/digilocker/user-status \
  Authorization:"Bearer YOUR_ACCESS_TOKEN"
```

**Response - NOT Verified:**
```json
{
  "success": true,
  "verified": false,
  "message": "User verification pending"
}
```

**Response - VERIFIED:** ✅
```json
{
  "success": true,
  "verified": true,
  "verificationType": "DIGILOCKER",
  "message": "User is verified"
}
```

**👉 When you see `"verified": true`, the DigiLocker verification is COMPLETE!**

---

### Method 2: Via Database Query (Detailed) 📊

```sql
SELECT 
  userId,
  verified,              -- true = COMPLETE ✅
  verificationStatus,    -- Should be 'VERIFIED'
  verifiedAt,           -- Timestamp when completed
  digilockerAccountId,  -- Aadhaar account linked
  comparisonResult      -- JSON showing which fields matched
FROM "UserVerification"
WHERE userId = 'YOUR_USER_ID';
```

**Expected result when complete:**
```
verified: true
verificationStatus: VERIFIED
verifiedAt: 2025-11-13 10:30:45.123Z
digilockerAccountId: 1234567890123456
comparisonResult: {"nameMatch": true, "dobMatch": true, ...}
```

---

### Method 3: Check User Status (High-level) 👤

```bash
http GET http://localhost:3000/auth/me \
  Authorization:"Bearer YOUR_ACCESS_TOKEN"
```

**Look for the status field:**
```json
{
  "id": "user_123...",
  "status": "ID_VERIFIED",  -- This means DigiLocker is complete ✅
  "email": "user@example.com"
}
```

**Status progression:**
- `REGISTERED` → Created
- `EMAIL_VERIFIED` → Email verified
- **`ID_VERIFIED`** ← DigiLocker complete ✅
- `VIDEO_VERIFIED` → Additional video (if needed)
- `APPROVED` → Final approval
- `ACTIVE` → Ready to use

---

## 📋 Summary Table

| Question | Answer | Reference |
|----------|--------|-----------|
| OTP route in dev? | Yes, `GET /auth/debug/otp` | DIGILOCKER_TESTING_GUIDE.md |
| Actual flow? | Yes, complete ✅ | DIGILOCKER_FLOW_DETAILED.md |
| Missing anything? | No, all implemented ✅ | DIGILOCKER_API_DOCUMENTATION.md |
| How to know if verified? | Check `verified: true` | See above ⬆️ |
| Which endpoint to check? | `/digilocker/user-status` | **Use this!** ⭐ |
| Database field to check? | `UserVerification.verified` | Set to `true` when complete |

---

## 🚀 Next Steps

1. ✅ Configure Cashfree credentials in `.env`
2. ✅ Start backend: `npm run start:dev`
3. ✅ Test Phase 1: Email auth flow
4. ✅ Test Phase 2: DigiLocker flow
5. ✅ Check Phase 3: Verify status with `/user-status`
6. ✅ Integrate into frontend
7. ✅ Deploy to production

---

**All questions answered! Ready to proceed with testing.** 🎉

