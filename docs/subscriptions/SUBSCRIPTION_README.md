# 📦 Subscription API Documentation (Updated)

This guide explains how to use the subscription endpoints as part of onboarding in the WiseIn backend. It covers all available endpoints, required inputs, expected outputs, and the overall flow, now supporting region, plan type, and billing cycle.

---

## 1. Overview
- The subscription module is decoupled from payment logic.
- Payments are handled by the payments module; subscriptions are activated only after successful payment.
- All endpoints are under `/auth/subscription/*`.
- Plans are segmented by region (Indian/International), type (Individual/Company), and billing cycle (Monthly/Yearly).

---

## 2. Endpoints & Usage

### 2.1 Get Available Plans
- **Endpoint:** `GET /auth/subscription/plans`
- **Description:** Returns available individual and company subscription plans segmented by region and billing cycle.
- **Input:** None
- **Output:**
```json
{
  "individualPlans": [
    { "id": "ind_in_monthly", "name": "Individual India Monthly", "price": 149, "currency": "INR", "region": "IN", "billingCycle": "monthly" },
    { "id": "ind_in_yearly", "name": "Individual India Yearly", "price": 1499, "currency": "INR", "region": "IN", "billingCycle": "yearly" },
    { "id": "ind_int_monthly", "name": "Individual International Monthly", "price": 9.99, "currency": "USD", "region": "INTL", "billingCycle": "monthly" },
    { "id": "ind_int_yearly", "name": "Individual International Yearly", "price": 99.99, "currency": "USD", "region": "INTL", "billingCycle": "yearly" }
  ],
  "companyPlans": [
    { "id": "comp_in_monthly", "name": "Company India Monthly", "price": 499, "currency": "INR", "region": "IN", "billingCycle": "monthly" },
    { "id": "comp_in_yearly", "name": "Company India Yearly", "price": 4999, "currency": "INR", "region": "IN", "billingCycle": "yearly" },
    { "id": "comp_int_monthly", "name": "Company International Monthly", "price": 49.99, "currency": "USD", "region": "INTL", "billingCycle": "monthly" },
    { "id": "comp_int_yearly", "name": "Company International Yearly", "price": 499.99, "currency": "USD", "region": "INTL", "billingCycle": "yearly" }
  ]
}
```

---

### 2.2 Create Checkout Session
- **Endpoint:** `POST /auth/subscription/select-plan`
- **Description:** Initiates payment for a selected plan using the payments module.
- **Input:**
```json
{
  "planId": "ind_in_monthly"
}
```
- **Output:**
```json
{
  "orderId": "order_1234567890",
  "paymentSessionId": "session_abc123...",
  "url": "https://sandbox.cashfree.com/pg/orders/order_1234567890/payments",
  "message": "Checkout session created successfully"
}
```

---

### 2.3 Get Current Subscription
- **Endpoint:** `GET /auth/subscription/current`
- **Description:** Returns the user's current subscription details.
- **Input:** None (JWT required)
- **Output:**
```json
{
  "subscriptionId": "sub_abc123...",
  "planType": "Individual",
  "planName": "Individual India Monthly",
  "status": "ACTIVE",
  "startDate": "2025-11-16T00:00:00.000Z",
  "endDate": "2025-12-16T00:00:00.000Z",
  "autoRenew": true
}
```

---

### 2.4 Cancel Subscription
- **Endpoint:** `POST /auth/subscription/cancel`
- **Description:** Cancels the user's active subscription.
- **Input:** None (JWT required)
- **Output:**
```json
{
  "message": "Subscription cancelled successfully"
}
```

---

## 3. Flow Example
1. User completes onboarding and verification.
2. User fetches available plans.
3. User selects a plan and initiates payment using its `planId`.
4. Backend creates payment order and returns payment link/session.
5. User completes payment.
6. Backend verifies payment and activates subscription.
7. User can view/cancel subscription via endpoints.

---

## 4. Error Handling
- If payment fails, subscription is not activated.
- All errors are returned as JSON with a clear message.
- Invalid `planId` returns a 400 error.

---

## 5. Notes
- All endpoints require JWT authentication except for fetching plans.
- Payments are handled by the payments module; subscription logic is clean and reusable.
- Extend plans or payment gateways by updating the payments module and plan definitions.
- Plan selection is now based on `planId` for clarity and flexibility.

---

For further details, see the main backend README or contact the backend team.
