# HTTPie Test Commands for WiseIn Backend

Quick HTTPie commands you can run to test the main backend endpoints (Auth, DigiLocker, Payment). Replace placeholders (TOKEN, USER_ID, ORDER_ID, VERIFICATION_ID) before running.

Prerequisites

- Install HTTPie: https://httpie.io/docs#installation
  - On Debian/Ubuntu: `sudo apt install httpie` or `pip install httpie`
- Backend running at `http://localhost:3000` (adjust API_URL below if different)

Notes

- All commands assume the API base is `http://localhost:3000`. If your backend runs on a different port (e.g., 3001), update `API_URL` accordingly.
- Use a valid JWT token (replace TOKEN in examples) for endpoints guarded by `JwtAuthGuard`.

Environment

```bash
API_URL=http://localhost:3000
TOKEN=YOUR_JWT_TOKEN_HERE
USER_ID=your_user_id_here
ORDER_ID=order-id-here
VERIFICATION_ID=VER_1234567890
```

1) Health / Root

```bash
http GET $API_URL/
```

2) Authentication (debug) — Send OTP (if enabled)

```bash
http POST $API_URL/auth/send-otp phone="9876543210"
```

3) Authentication — Verify OTP (get token)

```bash
http POST $API_URL/auth/verify-otp phone="9876543210" otp=="123456"
```

This will return a token in `accessToken` or `token`. Save to $TOKEN.

4) DigiLocker: Initiate verification

```bash
http POST $API_URL/digilocker/initiate Authorization:"Bearer $TOKEN" content-type:application/json userId=$USER_ID
```

Expected: JSON with `verificationId` and `consentUrl` (open consentUrl in browser to complete flow)

5) DigiLocker: Simulate callback (if needed)

```bash
http POST $API_URL/digilocker/callback verificationID=$VERIFICATION_ID Authorization:"Bearer $TOKEN"
```

6) DigiLocker: Check status

```bash
http GET $API_URL/digilocker/status/$VERIFICATION_ID Authorization:"Bearer $TOKEN"
```

7) Create Payment Order (one-time)

```bash
http POST $API_URL/api/payment/order Authorization:"Bearer $TOKEN" amount:=9999 currency=="INR" phone=="9876543210" content-type:application/json
```

Response: { orderId, paymentUrl, ... }

NOTE: The backend enforces that the user must be video-verified before creating orders. If the user has not completed video upload and admin approval, this endpoint will return an error. Check video status with the command in step 6 before creating a payment.

8) Check Payment Status (public)

```bash
http GET $API_URL/api/payment/status/ORDER_ID
```

9) Create Subscription (example payload)

```bash
http POST $API_URL/api/payment/subscription Authorization:"Bearer $TOKEN" \
  planId=="individual_monthly" phone=="9876543210" currency=="INR" content-type:application/json
```

Response: { subscriptionId, authorizationUrl }

NOTE: Subscriptions also require the user to be video-verified. The subscription creation will check the user's `phoneNumber` (if provided) and reject if the user is not verified. For strict enforcement by userId, consider passing userId to the endpoint or updating the controller to validate the authenticated user's status.

10) Check User Subscription (protected)

```bash
http GET $API_URL/api/payment/subscription/$USER_ID Authorization:"Bearer $TOKEN"
```

11) Get Payment History (protected)

```bash
http GET $API_URL/api/payment/history/$USER_ID Authorization:"Bearer $TOKEN"
```

12) Webhook Test (simulate Cashfree sending a webhook)

- Prepare a sample webhook JSON body similar to what Cashfree sends. For example:

```json
{
  "order_id": "ORDER_ID",
  "order_status": "PAID",
  "reference_id": "PAYMENT_ID",
  "txn_time": "2025-11-13T18:00:00Z",
  "signature": "PLACEHOLDER_SIGNATURE"
}
```

- Send to backend webhook endpoint (signature verification may fail in sandbox if signature not correct):

```bash
http POST $API_URL/api/payment/webhook < webhook-sample.json
```

13) Useful: List mapped routes (already printed during app startup):

- Check server logs where the application prints `Mapped {route}` lines.

Troubleshooting

- If you see `EADDRINUSE` on startup, another process is using the port. Find and stop it:

```bash
sudo lsof -i :3001
sudo kill <pid>
```

- If DI error about `PrismaService` occurs (should be fixed), ensure `PrismaService` is provided in the module providers (e.g., `providers: [PaymentService, PrismaService]`).

EOF

## End-to-end Onboarding (HTTPie) — step-by-step

Replace placeholders before running: `API_URL`, `TOKEN` (user JWT), `ADMIN_TOKEN` (admin JWT), `USER_ID`, `VERIFICATION_ID`, `SESSION_ID`, `ORDER_ID`.

Environment (example):

```bash
export API_URL=http://localhost:3000
export TOKEN="YOUR_USER_JWT"
export ADMIN_TOKEN="YOUR_ADMIN_JWT"
export USER_ID="user_id_here"
export VERIFICATION_ID="VER_..."
export SESSION_ID="VID_..."
export ORDER_ID="order_..."
```

1) Register / Sign-up (send OTP)

```bash
http POST $API_URL/auth/send-otp phone="9876543210"
```

2) Verify OTP (receive access token)

```bash
http POST $API_URL/auth/verify-otp phone="9876543210" otp=="123456"
# Save returned token to $TOKEN
```

3) (Optional) Get subscription plans

```bash
http GET $API_URL/auth/subscription/plans Authorization:"Bearer $TOKEN"
```

4) DigiLocker: Initiate verification (user clicks consent URL)

```bash
http POST $API_URL/digilocker/initiate Authorization:"Bearer $TOKEN" content-type:application/json userId==$USER_ID
# Response contains verificationId and consentUrl — open consentUrl in a browser and complete consent
```

5) DigiLocker: If you need to simulate callback/complete (dev/testing)

Use `verificationId` from step 4. This simulates the user completing consent and posting user-provided data.

```bash
http POST $API_URL/digilocker/complete Authorization:"Bearer $TOKEN" \
  verificationId==$VERIFICATION_ID \
  userProvidedData:='{"nameAsPerAadhaar":"John Doe","dateOfBirth":"1990-01-01","gender":"Male","phoneNumber":"9876543210","addressLine1":"addr"}'
```

6) DigiLocker: Check verification status

```bash
http GET $API_URL/digilocker/status/$VERIFICATION_ID Authorization:"Bearer $TOKEN"
```

7) Video: Initiate video verification (must be ID_VERIFIED)

```bash
http POST $API_URL/video-verification/initiate Authorization:"Bearer $TOKEN" content-type:application/json
```

Response contains `sessionId` — save to $SESSION_ID.

8) Video: Upload/Submit video (user uploads video somewhere and provides URL)

```bash
http POST $API_URL/video-verification/submit Authorization:"Bearer $TOKEN" \
  sessionId==$SESSION_ID videoUrl=="https://storage.example.com/videos/abc.mp4" videoDuration:=28 videoFormat=="mp4" videoSize:=5242880
```

9) Admin: List pending videos (admin)

```bash
http GET $API_URL/video-verification/admin/pending Authorization:"Bearer $ADMIN_TOKEN"
```

10) Admin: Approve a video

```bash
http POST $API_URL/video-verification/admin/verify Authorization:"Bearer $ADMIN_TOKEN" \
  userId=="$USER_ID" notes=="Face matched" faceMatchScore:=0.95
```

Or reject:

```bash
http POST $API_URL/video-verification/admin/reject Authorization:"Bearer $ADMIN_TOKEN" \
  userId=="$USER_ID" rejectionReason=="Face not clear" notes=="Please re-submit with better lighting"
```

11) Confirm user status is VIDEO_VERIFIED

```bash
http GET $API_URL/video-verification/status Authorization:"Bearer $TOKEN"
```

12) Choose a subscription plan (optional helper endpoint)

If your frontend uses `auth/subscription/select-plan` to record plan intent before payment:

```bash
http POST $API_URL/auth/subscription/select-plan Authorization:"Bearer $TOKEN" planId=="individual_monthly"
```

13) Create Subscription / Create Order (payment) — after video verified

Create subscription (server will check video verification when possible):

```bash
http POST $API_URL/api/payment/subscription Authorization:"Bearer $TOKEN" \
  planId=="individual_monthly" phone=="9876543210" amount:=99 currency=="INR" content-type:application/json
```

Create one-time order:

```bash
http POST $API_URL/api/payment/order Authorization:"Bearer $TOKEN" amount:=9999 currency=="INR" phone=="9876543210" content-type:application/json
```

Response contains `orderId` or `payment_session_id` and `paymentUrl`. Open `paymentUrl` in browser to complete payment.

14) Check payment status (public)

```bash
http GET $API_URL/api/payment/status/$ORDER_ID
```

15) Get user subscription / history (protected)

```bash
http GET $API_URL/api/payment/subscription/$USER_ID Authorization:"Bearer $TOKEN"

http GET $API_URL/api/payment/history/$USER_ID Authorization:"Bearer $TOKEN"
```

16) Webhook simulation (simulate Cashfree webhook)

- Create `webhook-sample.json` locally with fields similar to Cashfree payload. Example body:

```json
{
  "order_id": "ORDER_ID",
  "payment_status": "SUCCESS",
  "reference_id": "PAYMENT_ID",
  "txn_time": "2025-11-13T18:00:00Z"
}
```

- Post the file to webhook endpoint (signature verification will likely fail unless you compute a proper header):

```bash
http POST $API_URL/api/payment/webhook < webhook-sample.json
```

-- If you want to fully test signature verification, compute HMAC-SHA256 with `CASHFREE_WEBHOOK_SECRET` and send headers `x-cf-webhook-timestamp` and `x-cf-webhook-signature`.

17) Troubleshooting notes

- If you get `400` when creating an order: confirm `video-verification/status` shows `VERIFIED` and the user `status` in DB is `VIDEO_VERIFIED`.
- If webhook processing doesn't update DB: check logs and confirm signature header values.

---

These commands cover a complete onboarding flow: sign up → DigiLocker (consent) → DigiLocker complete → Video upload → Admin approve → Choose plan → Create order/subscription → Payment → Webhook.

Feel free to ask if you want a Postman collection, shell script wrapper that auto-substitutes tokens, or an example `webhook-sample.json` file created in the repo.
