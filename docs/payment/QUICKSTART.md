# Payment Module - Quick Setup Guide

**Status:** ✅ Ready for Integration  
**Last Updated:** November 13, 2025

---

## What's Included

✅ **Database Models**
- `PaymentOrder` — Individual payment orders
- `PaymentRecord` — Payment audit log

✅ **API Endpoints (6 total)**
- `POST /api/payment/order` — Create payment order
- `POST /api/payment/subscription` — Create subscription
- `GET /api/payment/status/:orderId` — Check order status
- `GET /api/payment/subscription/:userId` — Check if user is subscribed
- `GET /api/payment/history/:userId` — Get payment history
- `POST /api/payment/webhook` — Receive Cashfree webhooks

✅ **Features**
- Order creation and tracking
- Subscription management
- Webhook signature verification
- Payment history audit log
- JWT-protected endpoints

---

## Setup Steps

### 1. Environment Variables

Add to your `.env` file:

```bash
# Cashfree Credentials (from Cashfree Dashboard)
CASHFREE_API_KEY=pk_test_xxxxxxxxxxxxx
CASHFREE_API_SECRET=sk_test_xxxxxxxxxxxxx
CASHFREE_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
[paste your public key here]
-----END PUBLIC KEY-----

CASHFREE_WEBHOOK_SECRET=webhook_secret_xxxxxxxxxxxx
CASHFREE_BASE_URL=https://api.cashfree.com/pg
CASHFREE_API_VERSION=2022-09-01
CASHFREE_ENV=sandbox  # Use 'sandbox' for testing, 'production' for live

# Frontend URLs
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3000
PORT=3000
```

### 2. Get Cashfree Credentials

1. **Sign up** at https://dashboard.cashfree.com
2. **Go to Settings** → **API Keys**
3. **Copy:**
   - API Key (x-client-id)
   - API Secret (x-client-secret)
   - Public Key (for webhook verification)
4. **Go to Settings** → **Webhooks**
5. **Copy Webhook Secret**
6. **Set Webhook URL** to: `https://yourdomain.com/api/payment/webhook`

### 3. Build & Migrate Database

```bash
# Generate Prisma client (already migrated)
npx prisma generate

# Verify database is up to date
npx prisma db push

# Optional: View data in Prisma Studio
npx prisma studio
```

### 4. Start Backend

```bash
npm run start:dev
```

---

## Testing Payment Flow

### Option A: Manual cURL Testing

```bash
# 1. Get JWT Token (from login)
JWT_TOKEN="your_jwt_token_here"
USER_ID="user_id_from_token"

# 2. Create Payment Order
curl -X POST http://localhost:3000/api/payment/order \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 9999,
    "currency": "INR",
    "phone": "9876543210"
  }'

# Response contains paymentUrl - open in browser to complete payment

# 3. Check Payment Status (after payment)
curl http://localhost:3000/api/payment/status/order_1699861200000

# 4. Check Subscription
curl http://localhost:3000/api/payment/subscription/$USER_ID \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Option B: Postman Collection

Create requests in Postman:

1. **POST** `http://localhost:3000/api/payment/order`
   - Header: `Authorization: Bearer YOUR_TOKEN`
   - Body: `{ "amount": 9999, "currency": "INR", "phone": "9876543210" }`

2. **GET** `http://localhost:3000/api/payment/subscription/USER_ID`
   - Header: `Authorization: Bearer YOUR_TOKEN`

### Option C: Test Cards (Cashfree Sandbox)

| Card | Expiry | CVV | Result |
|------|--------|-----|--------|
| 4111111111111111 | 12/25 | 123 | ✓ Success |
| 4222222222222220 | 12/25 | 123 | ✗ Failure |
| 4532015112830366 | 12/25 | 123 | 3D Secure |

---

## Local Webhook Testing with ngrok

To test webhooks locally, expose your backend to the internet:

```bash
# 1. Install ngrok (if not installed)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# 2. Start ngrok
ngrok http 3000

# 3. Note the forwarding URL (e.g., https://abc123.ngrok.io)

# 4. Update Cashfree webhook URL
# Go to Cashfree Dashboard → Settings → Webhooks
# Set URL to: https://abc123.ngrok.io/api/payment/webhook

# 5. When you create a payment order, use ngrok URL:
# In payment.service.ts, temporarily change notify_url

# 6. Complete payment in test mode
# Webhook should hit your local endpoint
```

---

## Database Queries

### View All Orders for a User
```sql
SELECT * FROM "PaymentOrder" 
WHERE "userId" = 'user_id_here'
ORDER BY "createdAt" DESC;
```

### View Payment History
```sql
SELECT * FROM "PaymentRecord"
WHERE "userId" = 'user_id_here'
ORDER BY "createdAt" DESC;
```

### Check Successful Payments (Last 30 Days)
```sql
SELECT 
  SUM(amount) as total,
  COUNT(*) as count,
  currency
FROM "PaymentRecord"
WHERE status = 'SUCCESS'
  AND "paidAt" > NOW() - INTERVAL '30 days'
GROUP BY currency;
```

### Find Pending Orders (> 1 hour old)
```sql
SELECT * FROM "PaymentOrder"
WHERE status = 'PENDING'
  AND "createdAt" < NOW() - INTERVAL '1 hour';
```

---

## Frontend Integration Checklist

- [ ] Get JWT token from login endpoint
- [ ] Call `POST /api/payment/order` with amount & phone
- [ ] Redirect user to `paymentUrl` returned
- [ ] User completes payment on Cashfree page
- [ ] Cashfree redirects to return_url (your frontend)
- [ ] Frontend polls `GET /api/payment/subscription/:userId` to confirm
- [ ] Show premium features if `hasSubscription === true`

**Refer to:** [PAYMENT_FRONTEND_INTEGRATION.md](PAYMENT_FRONTEND_INTEGRATION.md) for complete React/Vue/Angular examples

---

## Troubleshooting

### Issue: 401 Unauthorized on `/api/payment/order`
**Solution:** Ensure JWT token is valid and passed in `Authorization: Bearer TOKEN` header

### Issue: Order created but webhook not received
**Solution:** 
- Check that `CASHFREE_WEBHOOK_SECRET` is correct
- Verify webhook URL is set in Cashfree dashboard
- Use ngrok for local testing
- Check backend logs for errors

### Issue: Payment status stuck as PENDING
**Solution:**
- Webhook might have failed silently
- Manually check Cashfree dashboard for order status
- Retry webhook from Cashfree dashboard
- Check server logs

### Issue: Signature verification failed
**Solution:**
- Verify `CASHFREE_WEBHOOK_SECRET` matches Cashfree settings
- Check that webhook raw body is being passed correctly
- Log the incoming webhook data to debug

### Issue: No response from payment endpoints
**Solution:**
- Check that `CASHFREE_API_KEY` and `CASHFREE_API_SECRET` are set
- Verify database is connected (check Postgres)
- Check server logs for errors
- Try `npm run build` to catch TypeScript errors

---

## API Endpoint Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/payment/order` | POST | ✅ | Create order |
| `/api/payment/subscription` | POST | ✅ | Create subscription |
| `/api/payment/status/:orderId` | GET | ❌ | Check status |
| `/api/payment/subscription/:userId` | GET | ✅ | Check if subscribed |
| `/api/payment/history/:userId` | GET | ✅ | Payment history |
| `/api/payment/webhook` | POST | ❌ | Cashfree webhook |

---

## Next Steps

1. ✅ Add environment variables
2. ✅ Get Cashfree credentials
3. ✅ Run database migration
4. ✅ Start backend
5. ✅ Test with cURL
6. ✅ Test with Cashfree test cards
7. ✅ Set up ngrok for webhook testing
8. ✅ Integrate frontend
9. ✅ Deploy to production with real credentials

---

## Documentation Files

- **[PAYMENT_API.md](PAYMENT_API.md)** — Complete API documentation
- **[PAYMENT_FRONTEND_INTEGRATION.md](PAYMENT_FRONTEND_INTEGRATION.md)** — Frontend integration guide
- **[../INDEX.md](../INDEX.md)** — Main API reference

---

**For Questions:** Check the detailed docs linked above or review the service/controller implementation in `src/payment/`
