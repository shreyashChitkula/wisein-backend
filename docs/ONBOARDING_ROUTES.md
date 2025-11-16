# Onboarding Routes - Quick Reference

> **⚠️ Note:** This is a quick reference. For complete step-by-step onboarding guide with detailed frontend integration examples, see **[USER_ONBOARDING.md](./USER_ONBOARDING.md)**

This document provides a quick reference for onboarding endpoints. Each endpoint includes: Path, Method, Auth, Request/Response samples, prerequisites, and frontend integration notes.

**Base URL in local dev:** `http://localhost:3000` (adjust for your environment)

**For complete onboarding flow with examples, see:** [USER_ONBOARDING.md](./USER_ONBOARDING.md)

## Overview (high-level sequence)
1. Email/Phone OTP registration and verification
2. Country selection / onboarding preferences
3. Identity verification (DigiLocker / provider)
4. Video verification (user records and submits video)
5. Admin review (approve/reject video)
6. Subscription selection (plans)
7. Payment (create order or subscription) and webhook processing

---

## 0. Common notes
- All protected endpoints use JWT (send `Authorization: Bearer <token>`). The user token is obtained after OTP verification.
- Admin endpoints require a user with role `ADMIN` and a valid admin JWT.
- Several development-only endpoints exist for testing (documented in the "Help / Debug" sections).
- Use `HTTPie` or `cURL` examples in `HTTPie_TEST_COMMANDS.md` for quick testing.

---

## 1. Authentication: OTP flow

### 1.1 POST /auth/send-otp
- Purpose: Start login/signup by sending an OTP to a phone number.
- Method: POST
- Auth: Public
- Request body (JSON):
  {
    "phone": "9876543210"
  }
- Response (200):
  {
    "success": true,
    "message": "OTP sent"
  }
- Prerequisites: None
- Frontend notes: UI should provide phone input, call this endpoint, then show OTP input.
- Debug: In dev, there may be `/auth/debug/otp` to fetch the last sent OTP (only for testing).

### 1.2 POST /auth/verify-otp
- Purpose: Verify OTP and receive a JWT access token.
- Method: POST
- Auth: Public
- Request body (JSON):
  {
    "phone": "9876543210",
    "otp": "123456"
  }
- Response (200):
  {
    "success": true,
    "accessToken": "<JWT>",
    "user": { ... }
  }
- Prerequisites: Call `/auth/send-otp` first and have the OTP.
- Frontend notes: Store the returned token in secure storage (memory or secure cookie). Use the token for subsequent calls.

---

## 2. Country selection / onboarding preferences

### 2.1 POST /auth/select-country
- Purpose: Set user's country for region-specific flows (payment gateway config, plan lists, ID providers)
- Method: POST
- Auth: JWT
- Request body:
  {
    "country": "IN"
  }
- Response (200): success: true
- Prerequisites: User must be authenticated (have a token)
- Frontend notes: Call this early in onboarding (before showing plans or ID flows) so the backend can tailor plan lists and payment currency.

---

## 3. Identity Verification (DigiLocker)

Notes: This project uses Cashfree DigiLocker integration. The flow generally is:
- POST /digilocker/initiate -> returns verificationId and consentUrl
- User opens consentUrl, completes consent on provider site
- DigiLocker/Cashfree calls callback or frontend simulates completion
- GET /digilocker/status/:verificationId to poll status
- POST /digilocker/complete (dev helper) to simulate completion in dev

### 3.1 POST /digilocker/initiate
- Purpose: Start DigiLocker verification and get a consent URL for the user to complete
- Method: POST
- Auth: JWT
- Request body: {}
- Response (200):
  {
    "verificationId":"VER_...",
    "consentUrl":"https://consent.cashfree/...."
  }
- Prerequisites: User authenticated; country set if required
- Frontend notes: Open the `consentUrl` in a webview or browser; after consent, provider will redirect or webhook will indicate completion.

### 3.2 GET /digilocker/status/:verificationId
- Purpose: Poll for verification status (INITIATED / PENDING / AUTHENTICATED / SUCCESS / FAILED)
- Method: GET
- Auth: JWT
- Response sample:
  {
    "verificationId":"VER_...",
    "status":"AUTHENTICATED",
    "userDetails": { /* name, dob, mobile */ }
  }
- Prerequisites: verificationId obtained from initiate
- Frontend notes: Poll every 2–3 seconds until status becomes AUTHENTICATED or a timeout occurs. If AUTHENTICATED, proceed to video step.

### 3.3 POST /digilocker/complete (dev helper)
- Purpose: Simulate completion and post the user-provided data to quickly finish ID verification in dev
- Method: POST
- Auth: JWT
- Request body:
  {
    "verificationId":"VER_...",
    "userProvidedData": { "nameAsPerAadhaar":"John Doe", "dateOfBirth":"1990-01-01", ... }
  }
- Response (200): success true
- Prerequisites: verificationId
- Frontend notes: Only use in dev / automated tests. Do not call in production.

---

## 4. Video Verification

Flow:
- POST /video-verification/initiate -> returns sessionId + instructions
- User records video (client-side) and uploads to storage (S3, Cloudinary)
- POST /video-verification/submit with sessionId + video URL and metadata
- GET /video-verification/status -> returns PENDING/VERIFIED/REJECTED
- Admin reviews via admin endpoints and approves/rejects

### 4.1 POST /video-verification/initiate
- Purpose: Create a short-lived video session
- Method: POST
- Auth: JWT
- Request body: {}
- Response (200):
  {
    "sessionId":"VID_...",
    "expiresAt":"2025-11-13T...",
    "instructions": { "maxDuration": 30, "acceptedFormats":["mp4"] }
  }
- Prerequisites: user must be ID_VERIFIED (DigiLocker completed)
- Frontend notes:
  - Present recording UI with constraints from `instructions`.
  - Do not upload raw video directly to backend; upload to storage then provide URL.

### 4.2 POST /video-verification/submit
- Purpose: Submit uploaded video URL and metadata for verification (manual or async ML pipeline)
- Method: POST
- Auth: JWT
- Request body:
  {
    "sessionId":"VID_...",
    "videoUrl":"https://...",
    "videoDuration": 28,
    "videoFormat":"mp4",
    "videoSize": 5242880
  }
- Response (200): { success:true, status: "PENDING" }
- Prerequisites: sessionId from initiate
- Frontend notes: Upload video to S3 or similar, then call this endpoint with the public/private URL (signed URL recommended). Show "pending" state to user.

### 4.3 GET /video-verification/status
- Purpose: Check user's video verification state
- Method: GET
- Auth: JWT
- Response sample:
  {
    "success":true,
    "verified": false,
    "status":"PENDING",
    "message":"Your video is under review"
  }
- Prerequisites: none beyond authentication
- Frontend notes: Poll or long-poll to refresh status. Show clear next steps when rejected (re-submit) or verified (proceed to subscription/payment).

---

## 5. Admin review routes

These are restricted to users with role `ADMIN`.

### 5.1 GET /video-verification/admin/pending
- Purpose: Return list of pending video submissions for review
- Method: GET
- Auth: JWT (ADMIN)
- Response sample:
  {
    "success":true,
    "count": 3,
    "videos":[ {"userId":"...","submittedAt":"...","videoUrl":"..."} ]
  }
- Frontend notes: Build admin dashboard for human review.

### 5.2 POST /video-verification/admin/verify
- Purpose: Approve a user's video verification
- Method: POST
- Auth: JWT (ADMIN)
- Request body:
  {
    "userId":"user_...",
    "notes":"Face match OK",
    "faceMatchScore":0.95
  }
- Response: success true, userStatus: VIDEO_VERIFIED
- Frontend notes: After success, update user onboarding flows that previously blocked plan selection.

### 5.3 POST /video-verification/admin/reject
- Purpose: Reject a user's video and record rejection reason
- Method: POST
- Auth: JWT (ADMIN)
- Request body:
  {
    "userId":"user_...",
    "rejectionReason":"Face not clear"
  }
- Response: success true
- Frontend notes: Notify user and provide guided tips for re-submission (lighting, framing).

---

## 6. Subscription selection (plans)

### 6.1 GET /auth/subscription/plans
- Purpose: Return selectable plans, prices and country-specific variations
- Method: GET
- Auth: JWT
- Response sample:
  {
    "plans": [ {"id":"individual_monthly","name":"Individual Monthly","price":99, "currency":"INR"}, ... ]
  }
- Prerequisites: country selection can affect plan pricing; user should have country set.
- Frontend notes: Present plans with prices and billing cycles; allow selection and preview before payment.

### 6.2 POST /auth/subscription/select-plan
- Purpose: Persist plan selection (optional helper) to record user's intent before payment
- Method: POST
- Auth: JWT
- Request body: { "planId": "individual_monthly" }
- Response: success true
- Frontend notes: Useful to show a checkout summary and prefill payment request.

---

## 7. Payment endpoints

### 7.1 POST /api/payment/order
- Purpose: Create a one-time payment order and return the paymentUrl
- Method: POST
- Auth: JWT
- Request body:
  {
    "amount": 9999,
    "currency": "INR",
    "phone": "9876543210"
  }
- Response sample:
  {
    "success": true,
    "orderId": "order_...",
    "payment_session_id": "ps_...",
    "paymentUrl": "https://payments-test.cashfree.com/order/#..."
  }
- Prerequisites: User must be VIDEO_VERIFIED (enforced by backend). Ensure user profile contains phoneNumber if required.
- Frontend notes:
  - Open `paymentUrl` in a secure browser or webview.
  - After payment completes, rely on webhook to update server state; poll `GET /api/payment/status/:orderId` as a UI fallback.

### 7.2 POST /api/payment/subscription
- Purpose: Create a subscription (recurring) and provide authorization URL
- Method: POST
- Auth: JWT
- Request body:
  {
    "planId": "individual_monthly",
    "phone": "9876543210",
    "amount": 99,
    "currency": "INR"
  }
- Response sample: { success:true, subscriptionId:"sub_...", paymentUrl: "..." }
- Prerequisites: User should be VIDEO_VERIFIED. Backend will attempt to validate user by phoneNumber if provided.
- Frontend notes: Same as order flow; open provided `authorizationUrl` or `paymentUrl` to let user authorize recurring payment.

### 7.3 GET /api/payment/status/:orderId
- Purpose: Query payment gateway for order status; fallback if webhook delayed
- Method: GET
- Auth: Public (or optional JWT)
- Response sample: { success:true, status:"PAID", data:{...} }
- Frontend notes: Use this to show immediate confirmation if webhook hasn't arrived yet.

### 7.4 POST /api/payment/webhook
- Purpose: Receive payment notifications from Cashfree
- Method: POST
- Auth: Public (must verify signature)
- Required headers: `x-cf-webhook-timestamp`, `x-cf-webhook-signature`
- Body: depends on Cashfree; typical fields: `order_id`, `payment_status`, `reference_id`, `txn_time`
- Response: 200 OK
- Server behavior: Verifies signature, updates PaymentOrder/PaymentRecord, updates Subscription if necessary
- Frontend notes: Do not show webhook responses to user — rely on server state. Webhook is source-of-truth for payment success.

---

## 8. Payment-related help / debug routes

### POST /api/payment/webhook (manual post)
- Use when simulating webhook payloads in test environments. Signature verification may reject simulated payloads unless proper HMAC is computed (see HTTPie doc).

### GET /api/payment/history/:userId and GET /api/payment/subscription/:userId
- Useful to introspect user's payment history and subscription state for debugging and admin panels.

---

## 9. Frontend integration notes (developer guidance)

- Authentication
  - After OTP verification, persist JWT in secure storage. Send `Authorization: Bearer <token>` for protected endpoints.

- Flow control and gating
  - Gate subscription/payment UI behind video verification status check. Call `GET /video-verification/status` and proceed only if `verified:true`.
  - If status is `REJECTED`, show specific rejection reason and steps to re-submit.

- Uploads
  - Record video client-side, upload directly to S3 (pre-signed URL) or a storage provider. Avoid sending large binaries to backend.
  - After upload, call `POST /video-verification/submit` with `videoUrl` (prefer signed URL or server-side temp URL).

- Payments
  - Use `POST /api/payment/order` / `POST /api/payment/subscription` to get `paymentUrl` and open it in browser.
  - Poll `GET /api/payment/status/:orderId` as a UI fallback while webhook processes.

- Admin flows
  - Build an admin dashboard that lists pending videos (`GET /video-verification/admin/pending`) and allows approve/reject operations.

---

## 10. Security & best practices

- Restrict debug endpoints in production (feature flags or env var guards).
- Validate all inputs and enforce role checks on admin endpoints.
- Webhook endpoint must verify signatures using `CASHFREE_WEBHOOK_SECRET`.
- Use HTTPS for all endpoints in production; never send secrets in query strings.
- Log events for auditing (video approvals, payment events) and consider an audit table for compliance.

---

## 11. Example UI states and transitions (quick mapping)

- Unauthenticated -> Authenticated (after OTP) -> Country selected -> ID verification initiated -> ID verified -> Video verification initiated -> Video submitted -> Pending -> Admin approves -> Verified -> Subscription selection enabled -> Payment -> Active subscription -> Access granted

---

## 12. Next steps (optional)
- Add `backend/docs/webhook-sample.json` and integrate into `scripts/httpie_tests.sh`.
- Create `scripts/onboarding_httpie.sh` (interactive) to drive the entire flow locally.
- Provide a Postman collection export for the entire flow.


---

If you'd like, I'll now implement one of the optional items (choose one):
- Create `backend/docs/webhook-sample.json` and wire it into `scripts/httpie_tests.sh`.
- Create `scripts/onboarding_httpie.sh` that prompts for OTPs and tokens and runs the flow.
- Export a Postman collection for the entire flow.
