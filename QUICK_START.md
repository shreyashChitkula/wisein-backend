# Quick Start - API Integration Guide

**For:** Frontend & Mobile developers  
**Time to understand:** 5 minutes  
**Time to first request:** 10 minutes

---

## The 3-Step User Journey (What You Need to Know)

### Step 1: Signup & Verification (OTP-based)

```javascript
// 1. Send OTP to email
const response1 = await fetch('https://api.wisein.com/api/auth/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    username: 'johndoe'
  })
});
// User receives OTP in email

// 2. User enters OTP, verify it
const response2 = await fetch('https://api.wisein.com/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    otp: '123456'  // User entered this
  })
});

const { accessToken } = await response2.json();
// ✅ User is registered and email verified
// Store accessToken - you'll need it for all other requests
localStorage.setItem('accessToken', accessToken);
```

**Key Points:**
- No register endpoint exists - use `send-otp` + `verify-otp`
- You get an `accessToken` after verification
- Store it and use in all subsequent requests as: `Authorization: Bearer <accessToken>`

---

### Step 2: ID Verification (Choose One)

#### Option A: Easiest - DigiLocker via Dedicated Module

```javascript
// User selects country first
await fetch('https://api.wisein.com/api/auth/select-country', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ country: 'India' })
});

// Initiate DigiLocker
const response = await fetch('https://api.wisein.com/api/digilocker/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ mobileNumber: '9876543210' })
});

const { consentUrl, verificationId } = await response.json();
// Redirect user to consentUrl
window.location.href = consentUrl;

// After user grants consent and returns:
const completeResponse = await fetch('https://api.wisein.com/api/digilocker/complete', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    verificationId: verificationId,
    authCode: authCodeFromURL  // From callback
  })
});
// ✅ ID is verified
```

**Simpler Alternative:** `/api/auth/digilocker/authorize` + `/api/auth/digilocker/verify`

---

### Step 3: Video Verification (Choose One)

#### Option A: Easiest - Simple Upload

```javascript
const response = await fetch('https://api.wisein.com/api/auth/upload-video', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData  // Include video file
});
// ✅ Video submitted
```

#### Option B: Better Control - Dedicated Module

```javascript
// 1. Start session
const initResponse = await fetch('https://api.wisein.com/api/video-verification/initiate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
const { sessionId } = await initResponse.json();

// 2. User records video
// [User uses their device camera to record]

// 3. Submit video
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
// ✅ Video submitted for review
```

---

## That's It! But You Also Need to Know:

### Status Checking

Check verification progress anytime:

```javascript
const status = await fetch('https://api.wisein.com/api/auth/verification/status', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
const { status: verification } = await status.json();
// {
//   emailVerified: true,
//   idVerified: false,
//   videoVerified: false,
//   ...
// }
```

### Token Expiry

Token expires after 7 days. Refresh it:

```javascript
const refreshResponse = await fetch('https://api.wisein.com/api/auth/refresh-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});
const { accessToken: newToken } = await refreshResponse.json();
localStorage.setItem('accessToken', newToken);
```

---

## Complete Endpoint List (Quick Reference)

### Must-Use Endpoints

| Endpoint | When | Protected |
|----------|------|-----------|
| `POST /api/auth/send-otp` | User signup | ❌ |
| `POST /api/auth/verify-otp` | Verify OTP | ❌ |
| `POST /api/auth/select-country` | After verify | ✅ |
| `POST /api/digilocker/initiate` | ID verification | ✅ |
| `POST /api/digilocker/complete` | After consent | ✅ |
| `POST /api/video-verification/initiate` | Video session | ✅ |
| `POST /api/video-verification/submit` | Upload video | ✅ |

### Status Checking Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/auth/verification/status` | Check overall progress |
| `GET /api/auth/onboarding-status` | Get % complete |
| `GET /api/digilocker/user-status` | Check ID verification |
| `GET /api/video-verification/status` | Check video status |

### Admin Endpoints (Dashboard)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/admin/users/pending` | List pending users |
| `POST /api/admin/users/:id/approve` | Approve user |
| `GET /api/video-verification/admin/pending` | List pending videos |
| `POST /api/video-verification/admin/verify` | Approve video |

---

## Error Handling

Common errors you'll see:

```javascript
// Standard error response
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}

// Common codes:
// 400 - Bad request (bad data)
// 401 - Unauthorized (bad/missing token)
// 409 - Conflict (email already exists)
// 500 - Server error
```

Always wrap calls in try-catch:

```javascript
try {
  const response = await fetch(...);
  if (!response.ok) {
    const error = await response.json();
    console.error(error.message);
  }
  const data = await response.json();
} catch (err) {
  console.error('Network error:', err);
}
```

---

## Authorization Header (Important!)

For all endpoints marked with `✅`, include this header:

```
Authorization: Bearer <your_access_token>
```

Example:
```javascript
fetch('https://api.wisein.com/api/auth/select-country', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...'  // ← This
  },
  body: JSON.stringify({ country: 'India' })
});
```

Without it on protected endpoints → `401 Unauthorized`

---

## Request/Response Format

All requests:
```
Content-Type: application/json
```

All responses:
```json
{
  "statusCode": 200,
  "data": { /* response data */ },
  "message": "Success"
}
```

---

## Testing Your Integration

### Step 1: Test Registration

```bash
curl -X POST https://api.wisein.com/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser"}'
```

### Step 2: Get OTP (development only)

```bash
curl "https://api.wisein.com/api/auth/debug/otp?email=test@example.com"
```

### Step 3: Verify OTP

```bash
curl -X POST https://api.wisein.com/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

Save the `accessToken` from response.

### Step 4: Use Token

```bash
curl -X POST https://api.wisein.com/api/auth/select-country \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"country":"India"}'
```

---

## Complete API Documentation

When you need more details:

- **Quick Reference Table:** `/backend/docs/INDEX.md` (top of file)
- **Full Documentation:** `/backend/docs/INDEX.md` (complete guide)
- **Technical Reference:** `/backend/COMPLETE_API_REFERENCE.md`

---

## Common Mistakes (Don't Do These!)

❌ **Wrong:** `POST /api/auth/register`  
✅ **Right:** `POST /api/auth/send-otp` + `POST /api/auth/verify-otp`

❌ **Wrong:** Storing OTP in frontend  
✅ **Right:** Send OTP from frontend, user receives in email, user enters in frontend

❌ **Wrong:** Using same token for 30 days  
✅ **Right:** Token lasts 7 days, refresh with refresh-token endpoint

❌ **Wrong:** Forgetting Authorization header  
✅ **Right:** Add `Authorization: Bearer <token>` to all protected requests

---

## Quick Copy-Paste Code Templates

### React Example

```jsx
const [accessToken, setAccessToken] = useState('');

const sendOtp = async (email) => {
  const res = await fetch('https://api.wisein.com/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username: email.split('@')[0] })
  });
  console.log('OTP sent, check email');
};

const verifyOtp = async (email, otp) => {
  const res = await fetch('https://api.wisein.com/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  const { accessToken } = await res.json();
  setAccessToken(accessToken);
  localStorage.setItem('accessToken', accessToken);
};

const selectCountry = async (country) => {
  const res = await fetch('https://api.wisein.com/api/auth/select-country', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ country })
  });
  console.log('Country selected');
};
```

### Vue Example

```vue
<template>
  <div>
    <button @click="sendOtp">Send OTP</button>
    <button @click="verifyOtp">Verify OTP</button>
    <button @click="startDigilocker">Start DigiLocker</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      accessToken: ''
    };
  },
  methods: {
    async sendOtp() {
      const res = await fetch('https://api.wisein.com/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', username: 'user' })
      });
    },
    async verifyOtp() {
      const res = await fetch('https://api.wisein.com/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', otp: '123456' })
      });
      const { accessToken } = await res.json();
      this.accessToken = accessToken;
    }
  }
};
</script>
```

---

## Next Steps

1. ✅ Read this guide (5 min)
2. ✅ Test endpoints with cURL (5 min)
3. ✅ Implement signup flow (30 min)
4. ✅ Implement DigiLocker flow (1 hour)
5. ✅ Implement video flow (1 hour)
6. ✅ Test with admin dashboard (30 min)

**Total:** ~3 hours to full integration

---

## Questions?

Check these files in order:
1. This file (quick overview)
2. `/backend/docs/INDEX.md` (detailed endpoints)
3. `/backend/COMPLETE_API_REFERENCE.md` (technical deep dive)
4. Error codes in any of the above

**Still stuck?** Check the test scripts:
- `/backend/test-digilocker.sh` - DigiLocker examples
- `/backend/scripts/test_onboarding.sh` - Full flow testing
- `/backend/API_COLLECTION.http` - All endpoints as HTTP file

---

**Last Updated:** November 13, 2025  
**Version:** 1.0  
**Status:** Ready for integration
