# 🚀 Frontend Integration Guide - Wisein Backend
**Last Updated:** November 12, 2025  
**Status:** ✅ All APIs Ready for Integration  
**Base URL:** `http://localhost:3000`

---

## 📋 Quick Start

### 1. Install HTTPie (for testing)
```bash
pip install httpie
```

### 2. Import API Collections
- **Postman:** Import `POSTMAN_COLLECTION.json`
- **HTTPie:** Use `API_COLLECTION.http`
- **cURL:** See examples in `API_DOCUMENTATION.md`

### 3. Test First Endpoint
```bash
http GET http://localhost:3000/
```

---

## 🔐 Authentication

### Step 1: Signup
```bash
http POST http://localhost:3000/auth/signup \
  email=user@example.com \
  password=SecurePass123! \
  name="John Doe"
```

**Response:**
```json
{
  "userId": "usr_123abc",
  "message": "Signup successful. OTP sent to your email."
}
```

### Step 2: Verify OTP
Get the OTP from user's email, then:
```bash
http POST http://localhost:3000/auth/verify-otp \
  email=user@example.com \
  otp=123456
```

**Response:**
```json
{
  "userId": "usr_123abc",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "message": "Email verified successfully."
}
```

### Step 3: Save Token
Store `accessToken` in localStorage for future requests:
```javascript
localStorage.setItem('accessToken', response.accessToken);
```

### Step 4: Use Token in Protected Requests
```bash
http GET http://localhost:3000/auth/onboarding-status \
  "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## 📊 API Endpoints Overview

### Authentication (5 endpoints)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/signup` | POST | ❌ | Create account |
| `/auth/send-otp` | POST | ❌ | Resend OTP |
| `/auth/verify-otp` | POST | ❌ | Verify email |
| `/auth/login` | POST | ❌ | Login user |
| `/auth/refresh-token` | POST | ❌ | Renew access token |

### Onboarding (2 endpoints)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/onboarding-status` | GET | ✅ | Check progress |
| `/auth/select-country` | POST | ✅ | Choose country |

### ID Verification (5 endpoints)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/verification/status` | GET | ✅ | Get status |
| `/auth/digilocker/authorize` | POST | ✅ | Start DigiLocker |
| `/auth/digilocker/verify` | POST | ✅ | Complete DigiLocker |
| `/auth/stripe-identity/create-session` | POST | ✅ | Start Stripe Identity |
| `/auth/stripe-identity/verify` | POST | ✅ | Complete Stripe Identity |

### Video Upload (1 endpoint)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/upload-video` | POST | ✅ | Upload video |

### Subscriptions (4 endpoints)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/subscription/plans` | GET | ❌ | View plans |
| `/auth/subscription/select-plan` | POST | ✅ | Choose plan |
| `/auth/subscription/current` | GET | ✅ | Check subscription |
| `/auth/subscription/cancel` | POST | ✅ | Cancel subscription |

### Admin (4 endpoints)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/admin/pending-users` | GET | ✅ | Get pending approvals |
| `/admin/users/:userId/approve` | POST | ✅ | Approve user |
| `/admin/users/:userId/reject` | POST | ✅ | Reject user |
| `/admin/dashboard/stats` | GET | ✅ | Dashboard stats |

### Webhooks (1 endpoint)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/webhooks/cashfree` | POST | ❌ | Handle payments |

---

## 💻 Frontend Implementation Examples

### React Example - Login Flow
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' }
});

// Add token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      try {
        const response = await axios.post(
          'http://localhost:3000/auth/refresh-token',
          { refreshToken }
        );
        localStorage.setItem('accessToken', response.data.accessToken);
        // Retry original request
        return api(error.config);
      } catch (err) {
        // Logout user
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Signup
async function signup(email, password, name) {
  const response = await api.post('/auth/signup', {
    email, password, name
  });
  return response.data;
}

// Verify OTP
async function verifyOtp(email, otp) {
  const response = await api.post('/auth/verify-otp', {
    email, otp
  });
  localStorage.setItem('accessToken', response.data.accessToken);
  return response.data;
}

// Login
async function login(email, password) {
  const response = await api.post('/auth/login', {
    email, password
  });
  localStorage.setItem('accessToken', response.data.accessToken);
  localStorage.setItem('refreshToken', response.data.refreshToken);
  return response.data;
}

// Protected request
async function getOnboardingStatus() {
  const response = await api.get('/auth/onboarding-status');
  return response.data;
}
```

### Vue.js Example - Using Axios
```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor
axiosInstance.interceptors.request.use(config => {
  const token = sessionStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = sessionStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${API_BASE}/auth/refresh-token`,
            { refreshToken }
          );
          sessionStorage.setItem('accessToken', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axiosInstance(error.config);
        } catch (err) {
          sessionStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
```

### Next.js Example - API Route Wrapper
```javascript
// pages/api/auth/signup.js
import axios from 'axios';

const backendAPI = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const response = await backendAPI.post('/auth/signup', req.body);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Server error'
    });
  }
}
```

---

## 🔑 Token Management

### Store Tokens
```javascript
// After successful login/verify
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);
```

### Send Token
```javascript
// Every protected request
headers: {
  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
  'Content-Type': 'application/json'
}
```

### Refresh Token
```javascript
// When access token expires
async function refreshToken() {
  try {
    const response = await axios.post(
      'http://localhost:3000/auth/refresh-token',
      {
        refreshToken: localStorage.getItem('refreshToken')
      }
    );
    localStorage.setItem('accessToken', response.data.accessToken);
    return response.data.accessToken;
  } catch (error) {
    // Logout user
    localStorage.clear();
    window.location.href = '/login';
  }
}
```

---

## 📤 File Upload (Video)

### JavaScript Example
```javascript
async function uploadVideo(file) {
  const formData = new FormData();
  formData.append('video', file);

  const response = await fetch(
    'http://localhost:3000/auth/upload-video',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: formData
    }
  );

  return response.json();
}
```

### React Component Example
```javascript
import React, { useState } from 'react';

function VideoUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('Video must be less than 100MB');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch(
        'http://localhost:3000/auth/upload-video',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: formData
        }
      );

      const data = await response.json();
      console.log('Video uploaded:', data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/*"
        onChange={handleUpload}
        disabled={loading}
      />
      {loading && <p>Uploading...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default VideoUpload;
```

---

## 💳 Subscription Flow

### Get Available Plans
```bash
http GET http://localhost:3000/auth/subscription/plans
```

**Response:**
```json
{
  "individualPlans": [
    {
      "id": "price_individual_pro",
      "name": "Pro",
      "price": 9.99,
      "features": ["1:1 calls", "Post feature", "Job applications"]
    }
  ],
  "companyPlans": [...]
}
```

### Select Plan & Create Checkout
```bash
http POST http://localhost:3000/auth/subscription/select-plan \
  "Authorization: Bearer TOKEN" \
  planType=INDIVIDUAL \
  planName=Pro
```

**Response:**
```json
{
  "checkoutUrl": "https://cashfree.com/checkout/pay/...",
  "cashfreeOrderId": "order_123",
  "amount": 9.99
}
```

### Redirect to Checkout
```javascript
// Redirect user to Cashfree checkout
window.location.href = checkoutUrl;
```

---

## ❌ Error Handling

### Common Errors
```javascript
try {
  await api.post('/auth/login', { email, password });
} catch (error) {
  const status = error.response?.status;
  const message = error.response?.data?.message;

  if (status === 400) {
    // Bad request - invalid input
    console.error('Invalid input:', message);
  } else if (status === 401) {
    // Unauthorized - invalid credentials or token expired
    console.error('Unauthorized:', message);
  } else if (status === 409) {
    // Conflict - email already exists
    console.error('Email already exists');
  } else if (status === 500) {
    // Server error
    console.error('Server error:', message);
  }
}
```

### Response Format
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "email should be an email"
}
```

---

## 🧪 Testing Endpoints

### Using HTTPie
```bash
# Signup
http POST localhost:3000/auth/signup \
  email=test@example.com \
  password=SecurePass123! \
  name="Test User"

# Login
http POST localhost:3000/auth/login \
  email=test@example.com \
  password=SecurePass123!

# Get status with token
http GET localhost:3000/auth/onboarding-status \
  "Authorization: Bearer YOUR_TOKEN_HERE"

# Get public plans
http GET localhost:3000/auth/subscription/plans
```

### Using cURL
```bash
# Signup
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","name":"Test"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Protected endpoint
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/auth/onboarding-status
```

---

## 📋 Onboarding Status Statuses

| Status | Description | Next Step |
|--------|-------------|-----------|
| `REGISTERED` | Just signed up | Verify OTP |
| `EMAIL_VERIFIED` | Email verified | Select Country |
| `ID_VERIFIED` | ID verified via DigiLocker/Stripe | Upload Video |
| `VIDEO_VERIFIED` | Video uploaded | Wait for admin approval |
| `APPROVED` | Admin approved | Select subscription |
| `ACTIVE` | Subscription active | ✅ Onboarded! |

---

## 🚀 Environment Variables

### Frontend (.env or .env.local)
```
REACT_APP_API_URL=http://localhost:3000
REACT_APP_API_TIMEOUT=30000
```

### Next.js (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Vue (.env)
```
VUE_APP_API_URL=http://localhost:3000
```

---

## 📊 Available Documentation

| Document | Purpose |
|----------|---------|
| `API_DOCUMENTATION.md` | Complete API reference with all details |
| `TEST_RESULTS_AND_LOGS.md` | Test results and performance metrics |
| `API_COLLECTION.http` | HTTPie test collection |
| `POSTMAN_COLLECTION.json` | Postman collection (import directly) |
| `FRONTEND_INTEGRATION_GUIDE.md` | This file |

---

## ✅ Pre-Integration Checklist

- [ ] Backend running (`npm run start:dev`)
- [ ] Can call `/` endpoint successfully
- [ ] Understand authentication flow (Signup → OTP → Login)
- [ ] Understand token management (store, send, refresh)
- [ ] Know error codes and responses
- [ ] Set up API client (Axios/Fetch)
- [ ] Set up interceptors for token refresh
- [ ] Test signup flow
- [ ] Test login flow
- [ ] Test protected endpoints
- [ ] Ready to integrate into UI

---

## 🆘 Common Issues & Solutions

### Issue: 401 Unauthorized on protected endpoint
**Solution:** 
- Check if token is stored correctly
- Verify token is in Authorization header
- Refresh token if expired

### Issue: 409 Conflict on signup
**Solution:**
- Email already exists
- Use different email or login instead

### Issue: 400 Bad Request
**Solution:**
- Check request body format
- Verify all required fields are present
- Verify email format, password length, etc.

### Issue: Multipart upload fails
**Solution:**
- Use FormData for file upload
- Set Content-Type to multipart/form-data
- Don't manually set Content-Type header (browser will set it)

---

## 📞 Quick Reference

**API Base URL:** `http://localhost:3000`  
**Auth Header:** `Authorization: Bearer {token}`  
**Content-Type:** `application/json` (except file uploads)  
**Token Expiry:** 7 days (access), 30 days (refresh)  
**OTP Expiry:** 10 minutes  
**Max OTP Attempts:** 3

---

## 🎯 Next Steps

1. **Set up HTTP client** (Axios/Fetch)
2. **Implement authentication flow** (signup → OTP → login)
3. **Add token management** (store, refresh, send)
4. **Build UI components** for each step
5. **Test all endpoints** using provided collections
6. **Set up error handling** for all responses
7. **Implement loading states** during API calls
8. **Add error messages** for users
9. **Test on mobile** (if needed)
10. **Deploy to staging** for full testing

---

**Status:** ✅ Ready for Frontend Integration  
**All 22 APIs:** Working and Tested  
**Last Updated:** November 12, 2025
