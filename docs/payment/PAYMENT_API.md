# Payment Integration Documentation

**Last Updated:** November 13, 2025  
**Module:** Payment  
**Framework:** NestJS + Cashfree PG

---

## Overview

The Payment module handles all payment operations including:
- **One-time orders** for individual features
- **Subscription management** for recurring billing
- **Webhook processing** for payment status updates
- **Payment verification** to check if users have paid

All payments are processed through **Cashfree Payment Gateway** (supports both India and international payments).

---

## Architecture

### Database Models

#### `PaymentOrder`
Stores individual payment orders created by users.

```prisma
model PaymentOrder {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  orderId           String   @unique          # Unique order ID (order_TIMESTAMP)
  paymentSessionId  String?                   # Cashfree payment session ID
  
  amount            Float                     # Payment amount
  currency          String   @default("INR")  # INR, USD, etc.
  
  status            PaymentStatus @default(PENDING)  # PENDING, SUCCESS, FAILED, CANCELLED
  
  customerPhone     String?
  customerEmail     String?
  
  # Cashfree references
  cashfreeOrderId   String?
  cashfreePaymentId String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Fields:**
- `orderId`: Unique identifier generated as `order_${timestamp}`
- `status`: Tracks payment lifecycle (PENDING → SUCCESS/FAILED)
- `paymentSessionId`: Used to construct the payment URL for customer
- `cashfreeOrderId`: Returned by Cashfree API, used for webhook matching

---

#### `PaymentRecord`
Audit log for all payment events (orders and subscriptions).

```prisma
model PaymentRecord {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  paymentType       PaymentType              # ORDER or SUBSCRIPTION
  
  orderId           String?                  # FK to PaymentOrder
  subscriptionId    String?                  # FK to Subscription
  
  amount            Float
  currency          String   @default("INR")
  status            PaymentStatus @default(PENDING)
  
  cashfreeOrderId   String?
  cashfreePaymentId String?
  
  webhookPayload    Json?                    # Full Cashfree webhook data
  
  paidAt            DateTime?                # When payment was completed
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Fields:**
- `paymentType`: Distinguishes between one-time orders and subscriptions
- `webhookPayload`: Stores complete Cashfree webhook response for audit
- `paidAt`: Timestamp when Cashfree confirmed successful payment

---

### Enums

```typescript
enum PaymentStatus {
  PENDING   // Order created, awaiting payment
  SUCCESS   // Payment confirmed by Cashfree
  FAILED    // Payment failed or declined
  CANCELLED // User cancelled before payment
}

enum PaymentType {
  ORDER        // One-time purchase
  SUBSCRIPTION // Recurring subscription
}
```

---

## API Endpoints

### 1. Create Payment Order
**Endpoint:** `POST /api/payment/order`  
**Authentication:** ✅ JWT Required  
**Rate Limit:** 10 requests/minute per user

**Request Body:**
```json
{
  "amount": 9999,
  "currency": "INR",
  "phone": "9876543210"
}
```

**Response (Success):**
```json
{
  "success": true,
  "orderId": "order_1699861200000",
  "payment_session_id": "xxxx-yyyy-zzzz",
  "paymentUrl": "https://payments-test.cashfree.com/order/#xxxx-yyyy-zzzz",
  "data": {
    "order_id": "order_1699861200000",
    "order_amount": 9999,
    "order_currency": "INR",
    "payment_session_id": "xxxx-yyyy-zzzz"
  }
}
```

**Steps:**
1. Extract user ID from JWT token
2. Validate amount > 0
3. Call Cashfree `/orders` endpoint
4. Save order to `PaymentOrder` table with status=PENDING
5. Return payment URL to frontend

**Frontend Flow:**
```javascript
// 1. Create order
const response = await fetch('/api/payment/order', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ amount: 9999, currency: 'INR' })
});

// 2. Redirect to payment
window.location.href = response.paymentUrl;

// 3. After payment, Cashfree redirects to return_url
// Frontend should poll /api/payment/subscription/:userId to check status
```

---

### 2. Create Subscription
**Endpoint:** `POST /api/payment/subscription`  
**Authentication:** ✅ JWT Required  
**Rate Limit:** 5 requests/minute per user

**Request Body:**
```json
{
  "planId": "plan_monthly_individual_india",
  "amount": 99,
  "currency": "INR",
  "phone": "9876543210",
  "customerId": "cust_xxxxx"
}
```

**Response (Success):**
```json
{
  "success": true,
  "subscriptionId": "sub_1699861200000",
  "payment_session_id": "xxxx-yyyy-zzzz",
  "paymentUrl": "https://payments-test.cashfree.com/order/#xxxx-yyyy-zzzz",
  "data": { ... }
}
```

**Supported Plans:**
| Plan ID | Type | Billing | Region | Price |
|---------|------|---------|--------|-------|
| `plan_monthly_individual_india` | Individual | Monthly | India | ₹99/month |
| `plan_yearly_individual_india` | Individual | Yearly | India | ₹999/year |
| `plan_monthly_individual_foreign` | Individual | Monthly | Non-India | $15/month |
| `plan_yearly_individual_foreign` | Individual | Yearly | Non-India | $150/year |
| `plan_monthly_company_india` | Company | Monthly | India | ₹499/month |
| `plan_yearly_company_india` | Company | Yearly | India | ₹4999/year |
| `plan_monthly_company_foreign` | Company | Monthly | Non-India | $75/month |
| `plan_yearly_company_foreign` | Company | Yearly | Non-India | $750/year |

---

### 3. Get Payment Status
**Endpoint:** `GET /api/payment/status/:orderId`  
**Authentication:** ❌ Not Required  
**Rate Limit:** 30 requests/minute (public endpoint)

**Response:**
```json
{
  "success": true,
  "status": "PAID",
  "data": {
    "order_id": "order_1699861200000",
    "order_status": "PAID",
    "order_amount": 9999,
    "payment_id": "pay_xxxxx"
  }
}
```

**Possible Statuses from Cashfree:**
- `PAID` — Payment successful
- `PENDING` — Awaiting payment
- `FAILED` — Payment failed
- `CANCELLED` — Customer cancelled

---

### 4. Check User Subscription Status
**Endpoint:** `GET /api/payment/subscription/:userId`  
**Authentication:** ✅ JWT Required  
**Rate Limit:** 60 requests/minute per user

**Response (Active Subscription):**
```json
{
  "hasSubscription": true,
  "subscription": {
    "id": "sub_xxxx",
    "userId": "user_xxxx",
    "planType": "INDIVIDUAL",
    "planName": "Monthly Pro",
    "status": "ACTIVE",
    "startDate": "2025-11-13T10:00:00Z",
    "endDate": "2025-12-13T10:00:00Z",
    "autoRenew": true,
    "cashfreeOrderId": "order_1699861200000"
  }
}
```

**Response (No Active Subscription):**
```json
{
  "hasSubscription": false,
  "subscription": null
}
```

**Usage:**
```javascript
// Check if user can access premium features
const subResponse = await fetch(`/api/payment/subscription/${userId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (subResponse.hasSubscription) {
  // Show premium features
} else {
  // Show upgrade prompt
}
```

---

### 5. Get Payment History
**Endpoint:** `GET /api/payment/history/:userId`  
**Authentication:** ✅ JWT Required  
**Rate Limit:** 30 requests/minute per user

**Response:**
```json
{
  "payments": [
    {
      "id": "payrecord_xxx",
      "paymentType": "SUBSCRIPTION",
      "amount": 99,
      "currency": "INR",
      "status": "SUCCESS",
      "paidAt": "2025-11-13T10:30:00Z",
      "createdAt": "2025-11-13T10:00:00Z"
    }
  ],
  "orders": [
    {
      "id": "ord_xxx",
      "orderId": "order_1699861200000",
      "amount": 4999,
      "currency": "INR",
      "status": "SUCCESS",
      "createdAt": "2025-11-10T08:00:00Z",
      "updatedAt": "2025-11-10T08:30:00Z"
    }
  ]
}
```

---

### 6. Cashfree Webhook
**Endpoint:** `POST /api/payment/webhook`  
**Authentication:** ❌ Not Required (Signature Verified)  
**Source:** Cashfree Payment Gateway

**Expected Cashfree Payload:**
```json
{
  "event": "PAYMENT_SUCCESS_WEBHOOK",
  "payment": {
    "cf_payment_id": 123456789,
    "order_id": "order_1699861200000",
    "order_amount": 9999,
    "payment_time": "2025-11-13T10:30:00Z",
    "payment_status": "SUCCESS"
  },
  "timestamp": "2025-11-13T10:30:01Z"
}
```

**Webhook Signature Verification:**
```
x-cf-webhook-signature = HMAC-SHA256(timestamp + rawBody, webhook_secret)
```

**Process:**
1. Receive webhook from Cashfree
2. Verify signature using `CASHFREE_WEBHOOK_SECRET`
3. If signature invalid → Return 400 with `{ "success": false, "message": "invalid signature" }`
4. If signature valid → Extract `order_id` from payload
5. Update `PaymentOrder.status` from PENDING → SUCCESS
6. Create `PaymentRecord` entry with webhook payload
7. Return 200 with `{ "success": true }`

**Signature Verification Code:**
```typescript
verifyWebhookSignature(timestamp: string, rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || '';
  const signatureData = `${timestamp}${rawBody}`;
  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(signatureData)
    .digest('base64');
  return computed === signature;
}
```

---

## Environment Variables

```bash
# Cashfree API Configuration
CASHFREE_API_KEY=pk_test_xxxxx              # Public API key (test/prod)
CASHFREE_API_SECRET=sk_test_xxxxx           # Secret API key (test/prod)
CASHFREE_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...  # For signature verification
CASHFREE_WEBHOOK_SECRET=webhook_secret_xxxx # Webhook signature key
CASHFREE_BASE_URL=https://api.cashfree.com/pg   # Cashfree API endpoint
CASHFREE_API_VERSION=2022-09-01             # Stable API version
CASHFREE_ENV=sandbox                        # sandbox or production

# Return URLs
FRONTEND_URL=http://localhost:3000          # Frontend base URL
API_URL=http://localhost:3000               # Backend base URL
```

---

## Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Initiates Purchase                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Frontend calls      │
        │ POST /api/payment/  │
        │ order              │
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Backend creates    │
        │ PaymentOrder       │
        │ (status=PENDING)   │
        │ Calls Cashfree API │
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Frontend redirects │
        │ user to Cashfree   │
        │ payment page       │
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ User enters card   │
        │ details and pays   │
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Cashfree processes │
        │ payment            │
        └────────┬───────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
    ┌─────────┐       ┌─────────┐
    │ SUCCESS │       │ FAILED  │
    └────┬────┘       └────┬────┘
         │                 │
         ├─────────┬───────┘
         │         │
         ▼         ▼
    ┌─────────────────────────┐
    │ Cashfree calls webhook  │
    │ POST /api/payment/      │
    │ webhook                 │
    └─────────┬───────────────┘
              │
              ▼
    ┌─────────────────────────┐
    │ Backend verifies        │
    │ signature & updates DB  │
    │ (status→SUCCESS/FAILED) │
    │ Creates PaymentRecord   │
    └─────────┬───────────────┘
              │
              ▼
    ┌─────────────────────────┐
    │ Frontend polls status   │
    │ GET /api/payment/       │
    │ subscription/:userId    │
    │ to confirm payment      │
    └─────────────────────────┘
```

---

## Testing with cURL

### Test Create Order (with JWT token)
```bash
JWT_TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3000/api/payment/order \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 9999,
    "currency": "INR",
    "phone": "9876543210"
  }'
```

### Test Get Payment Status
```bash
curl http://localhost:3000/api/payment/status/order_1699861200000 \
  -H "Content-Type: application/json"
```

### Test Check Subscription
```bash
JWT_TOKEN="your_jwt_token_here"

curl http://localhost:3000/api/payment/subscription/user_id_here \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Test Webhook (Mock)
```bash
# Generate signature
TIMESTAMP=$(date +%s)
BODY='{"order_id":"order_123","payment_status":"SUCCESS"}'
SECRET="your_webhook_secret"

SIGNATURE=$(echo -n "${TIMESTAMP}${BODY}" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

curl -X POST http://localhost:3000/api/payment/webhook \
  -H "x-cf-webhook-signature: $SIGNATURE" \
  -H "x-cf-webhook-timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

---

## Local Development with ngrok

To test Cashfree webhooks locally, use ngrok to expose your local server:

```bash
# 1. Install ngrok (if not already installed)
brew install ngrok  # macOS
# or
choco install ngrok # Windows

# 2. Start ngrok tunnel
ngrok http 3000

# 3. Note the forwarding URL: https://xxxx-yyyy-zzzz.ngrok.io

# 4. Update Cashfree dashboard webhook URL to:
# https://xxxx-yyyy-zzzz.ngrok.io/api/payment/webhook

# 5. Start your backend
cd backend && npm run start:dev
```

After this, Cashfree test payments will automatically call your local webhook endpoint.

---

## Error Handling

### Webhook Signature Invalid
```json
{
  "success": false,
  "message": "invalid signature"
}
```
**Action:** Log and investigate. Check that `CASHFREE_WEBHOOK_SECRET` matches Cashfree dashboard settings.

### Order Not Found
```json
{
  "success": false,
  "message": "Order not found"
}
```
**Action:** Webhook arrived before order was saved to DB (race condition). Cashfree will retry.

### Payment Amount Mismatch
```json
{
  "success": false,
  "message": "Amount mismatch"
}
```
**Action:** Investigate fraudulent payment attempts.

---

## Database Queries

### Check all orders for a user
```sql
SELECT * FROM "PaymentOrder" WHERE "userId" = 'user_xxx' ORDER BY "createdAt" DESC;
```

### Check payment history (audit log)
```sql
SELECT * FROM "PaymentRecord" WHERE "userId" = 'user_xxx' ORDER BY "createdAt" DESC;
```

### Find pending orders (older than 1 hour)
```sql
SELECT * FROM "PaymentOrder" 
WHERE status = 'PENDING' 
  AND "createdAt" < NOW() - INTERVAL '1 hour';
```

### Calculate revenue (last 30 days)
```sql
SELECT 
  SUM(amount) as total_revenue,
  COUNT(*) as payment_count,
  currency
FROM "PaymentRecord"
WHERE status = 'SUCCESS' 
  AND "paidAt" > NOW() - INTERVAL '30 days'
GROUP BY currency;
```

---

## Subscription Plans Configuration

Plans can be configured as environment variables or hardcoded in service:

```typescript
const SUBSCRIPTION_PLANS = {
  'plan_monthly_individual_india': {
    type: 'INDIVIDUAL',
    billing: 'MONTHLY',
    region: 'INDIA',
    amount: 99,
    currency: 'INR',
    duration_days: 30,
    features: ['Feature A', 'Feature B']
  },
  'plan_yearly_individual_india': {
    type: 'INDIVIDUAL',
    billing: 'YEARLY',
    region: 'INDIA',
    amount: 999,
    currency: 'INR',
    duration_days: 365,
    features: ['Feature A', 'Feature B']
  },
  // ... more plans
};
```

To add a new plan, update Cashfree dashboard and add config entry above.

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook not received | Webhook URL not set in Cashfree | Configure in Cashfree dashboard |
| Signature verification fails | Secret mismatch | Verify `CASHFREE_WEBHOOK_SECRET` |
| Payment stuck as PENDING | Webhook processing failed | Check server logs, retry webhook |
| Order creation fails | API credentials invalid | Verify `CASHFREE_API_KEY` and `CASHFREE_API_SECRET` |
| Frontend doesn't see payment | Polling too fast | Frontend should wait 2-5 sec after redirect |

---

## Next Steps

1. **Configure Cashfree Webhook URL** in dashboard to `https://yourdomain.com/api/payment/webhook`
2. **Test payment flow** in sandbox environment
3. **Enable production credentials** when ready
4. **Monitor payments** via dashboard analytics
5. **Handle failed payments** with customer notification emails
6. **Implement payment retry logic** for declined cards

