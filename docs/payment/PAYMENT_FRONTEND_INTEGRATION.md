# Payment Integration Guide for Frontend

**Last Updated:** November 13, 2025  
**Purpose:** Step-by-step guide to integrate payment functionality into your frontend

---

## Overview

This guide walks you through integrating the payment system into your React/Vue/Angular frontend.

---

## 1. Create Payment Order (One-Time Purchase)

### Step 1.1: Call Create Order Endpoint
```javascript
async function createPaymentOrder(amount, currency = 'INR', phone = '') {
  try {
    const token = localStorage.getItem('authToken'); // JWT from login
    
    const response = await fetch('http://localhost:3000/api/payment/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount,
        currency,
        phone
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return {
        orderId: data.orderId,
        paymentUrl: data.paymentUrl,
        sessionId: data.payment_session_id
      };
    } else {
      throw new Error(data.message || 'Failed to create order');
    }
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
}
```

### Step 1.2: Redirect User to Payment Gateway
```javascript
async function handleOrderPayment(amount) {
  try {
    const order = await createPaymentOrder(amount);
    
    // Redirect user to Cashfree payment page
    // After payment, they'll be redirected back to your return_url
    window.location.href = order.paymentUrl;
    
    // Store orderId in sessionStorage for verification later
    sessionStorage.setItem('currentOrderId', order.orderId);
  } catch (error) {
    // Show error toast/snackbar
    showError(`Payment failed: ${error.message}`);
  }
}
```

### Step 1.3: Verify Payment After Return (Handle Redirect)
```javascript
// In your payment return page component
useEffect(() => {
  const orderId = new URLSearchParams(window.location.search).get('order_id') 
                  || sessionStorage.getItem('currentOrderId');
  
  if (orderId) {
    verifyPaymentStatus(orderId);
  }
}, []);

async function verifyPaymentStatus(orderId) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/payment/status/${orderId}`
    );
    
    const data = await response.json();
    
    if (data.status === 'PAID') {
      // Payment successful
      showSuccess('Payment successful!');
      // Redirect to success page or update UI
    } else if (data.status === 'FAILED') {
      showError('Payment failed. Please try again.');
    } else if (data.status === 'PENDING') {
      // Still pending, could retry or show message
      showInfo('Payment is being processed...');
    }
  } catch (error) {
    console.error('Verify payment error:', error);
  }
}
```

---

## 2. Create Subscription

### Step 2.1: Fetch Available Plans
```javascript
async function getAvailablePlans() {
  const plans = [
    {
      id: 'plan_monthly_individual_india',
      name: 'Monthly (Individual)',
      type: 'INDIVIDUAL',
      billing: 'MONTHLY',
      amount: 99,
      currency: 'INR',
      region: 'INDIA'
    },
    {
      id: 'plan_yearly_individual_india',
      name: 'Yearly (Individual)',
      type: 'INDIVIDUAL',
      billing: 'YEARLY',
      amount: 999,
      currency: 'INR',
      region: 'INDIA'
    },
    {
      id: 'plan_monthly_company_india',
      name: 'Monthly (Company)',
      type: 'COMPANY',
      billing: 'MONTHLY',
      amount: 499,
      currency: 'INR',
      region: 'INDIA'
    },
    {
      id: 'plan_yearly_company_india',
      name: 'Yearly (Company)',
      type: 'COMPANY',
      billing: 'YEARLY',
      amount: 4999,
      currency: 'INR',
      region: 'INDIA'
    },
    // ... add more plans for different regions/types
  ];
  
  // Filter by user's region
  return plans.filter(p => p.region === userCountry);
}
```

### Step 2.2: Create Subscription
```javascript
async function createSubscription(planId, phone = '') {
  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('http://localhost:3000/api/payment/subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        planId,
        phone,
        amount: getPlanAmount(planId),
        currency: 'INR'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      return {
        subscriptionId: data.subscriptionId,
        paymentUrl: data.paymentUrl,
        sessionId: data.payment_session_id
      };
    } else {
      throw new Error(data.message || 'Failed to create subscription');
    }
  } catch (error) {
    console.error('Create subscription error:', error);
    throw error;
  }
}

async function handleSubscriptionPayment(planId) {
  try {
    const subscription = await createSubscription(planId);
    
    // Redirect to Cashfree
    window.location.href = subscription.paymentUrl;
    
    // Store subscription ID
    sessionStorage.setItem('currentSubscriptionId', subscription.subscriptionId);
  } catch (error) {
    showError(`Subscription failed: ${error.message}`);
  }
}
```

---

## 3. Check User's Subscription Status

### Step 3.1: Check Active Subscription
```javascript
async function checkUserSubscription(userId) {
  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(
      `http://localhost:3000/api/payment/subscription/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    
    return {
      hasSubscription: data.hasSubscription,
      subscription: data.subscription, // null if no active subscription
      isActive: data.hasSubscription,
      endDate: data.subscription?.endDate
    };
  } catch (error) {
    console.error('Check subscription error:', error);
    return { hasSubscription: false, subscription: null };
  }
}
```

### Step 3.2: Use in Components (React Example)
```jsx
import { useEffect, useState } from 'react';

function PremiumFeature({ userId }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      const result = await checkUserSubscription(userId);
      setIsSubscribed(result.hasSubscription);
      setLoading(false);
    };

    checkSubscription();
  }, [userId]);

  if (loading) return <div>Checking subscription...</div>;

  if (isSubscribed) {
    return (
      <div className="premium-content">
        <h2>Premium Features</h2>
        {/* Premium content here */}
      </div>
    );
  }

  return (
    <div className="upgrade-prompt">
      <h3>Upgrade to Premium</h3>
      <p>Get access to premium features</p>
      <button onClick={handleSubscriptionPayment}>Upgrade Now</button>
    </div>
  );
}

export default PremiumFeature;
```

---

## 4. Display Payment History

### Step 4.1: Fetch Payment History
```javascript
async function getPaymentHistory(userId) {
  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(
      `http://localhost:3000/api/payment/history/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    
    return {
      payments: data.payments,        // PaymentRecord entries
      orders: data.orders             // PaymentOrder entries
    };
  } catch (error) {
    console.error('Get payment history error:', error);
    return { payments: [], orders: [] };
  }
}
```

### Step 4.2: Display History Table
```jsx
function PaymentHistory({ userId }) {
  const [history, setHistory] = useState({ payments: [], orders: [] });

  useEffect(() => {
    const fetchHistory = async () => {
      const data = await getPaymentHistory(userId);
      setHistory(data);
    };

    fetchHistory();
  }, [userId]);

  return (
    <div className="payment-history">
      <h3>Payment History</h3>
      
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.payments.map(payment => (
            <tr key={payment.id}>
              <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
              <td>{payment.amount} {payment.currency}</td>
              <td>{payment.paymentType}</td>
              <td>
                <span className={`status-${payment.status.toLowerCase()}`}>
                  {payment.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PaymentHistory;
```

---

## 5. React Component Example (Complete Integration)

```jsx
import React, { useState, useEffect } from 'react';

function PaymentDashboard({ userId }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    checkSubscription();
    loadPlans();
  }, [userId]);

  async function checkSubscription() {
    try {
      const response = await fetch(
        `http://localhost:3000/api/payment/subscription/${userId}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } }
      );
      const data = await response.json();
      setSubscription(data.subscription);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlans() {
    // Load from your backend or hardcode
    setPlans([
      { id: 'plan_monthly_individual_india', name: 'Monthly', amount: 99, currency: 'INR' },
      { id: 'plan_yearly_individual_india', name: 'Yearly', amount: 999, currency: 'INR' }
    ]);
  }

  async function handleUpgrade(planId) {
    try {
      const response = await fetch('http://localhost:3000/api/payment/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ planId, amount: 99, currency: 'INR' })
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      alert('Failed to create subscription: ' + error.message);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Payment Dashboard</h1>

      {subscription && subscription.status === 'ACTIVE' ? (
        <div style={{ 
          padding: '15px', 
          border: '2px solid green', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <h2>✓ Active Subscription</h2>
          <p>Plan: {subscription.planName}</p>
          <p>Expires: {new Date(subscription.endDate).toLocaleDateString()}</p>
        </div>
      ) : (
        <div>
          <h2>Upgrade Your Account</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {plans.map(plan => (
              <div key={plan.id} style={{ 
                padding: '15px', 
                border: '1px solid #ccc', 
                borderRadius: '8px' 
              }}>
                <h3>{plan.name}</h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  ₹{plan.amount}/{plan.billing || 'month'}
                </p>
                <button 
                  onClick={() => handleUpgrade(plan.id)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Subscribe Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentDashboard;
```

---

## 6. Environment Variables (Frontend)

```env
# In your .env or .env.local
REACT_APP_API_URL=http://localhost:3000
REACT_APP_PAYMENT_API=http://localhost:3000/api/payment
```

---

## 7. Error Handling Best Practices

```javascript
async function withErrorHandling(apiCall) {
  try {
    return await apiCall();
  } catch (error) {
    if (error.status === 401) {
      // Not authenticated, redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    } else if (error.status === 400) {
      // Bad request
      showError('Invalid payment details. Please check and try again.');
    } else if (error.status === 500) {
      // Server error
      showError('Payment service is temporarily unavailable. Please try later.');
    } else {
      showError(error.message || 'An unexpected error occurred.');
    }
    throw error;
  }
}
```

---

## 8. Testing Payment Locally

### Use Cashfree Test Cards
| Card Number | Expiry | CVV | Status |
|-------------|--------|-----|--------|
| 4111111111111111 | 12/25 | 123 | Success |
| 4222222222222220 | 12/25 | 123 | Failure |
| 4532015112830366 | 12/25 | 123 | 3D Secure |

### Test Phone Numbers
- Use any 10-digit number, e.g., 9876543210

### Test OTP
- Enter any 6-digit number as OTP in Cashfree checkout

---

## 9. Polling vs Webhooks

### Polling (For Immediate Feedback)
```javascript
// Poll every 2 seconds for 1 minute
let attempts = 0;
const maxAttempts = 30; // 1 minute with 2-second intervals

const pollPaymentStatus = setInterval(async () => {
  try {
    const response = await fetch(
      `http://localhost:3000/api/payment/status/${orderId}`
    );
    const data = await response.json();

    if (data.status === 'PAID') {
      clearInterval(pollPaymentStatus);
      showSuccess('Payment confirmed!');
      redirect('/dashboard');
    } else if (data.status === 'FAILED') {
      clearInterval(pollPaymentStatus);
      showError('Payment failed.');
    }

    attempts++;
    if (attempts >= maxAttempts) {
      clearInterval(pollPaymentStatus);
      showInfo('Payment verification timed out. Please check manually.');
    }
  } catch (error) {
    console.error('Polling error:', error);
  }
}, 2000);
```

### Server-Sent Events (For Real-Time Updates)
```javascript
// Connect to SSE endpoint (if your backend supports it)
const eventSource = new EventSource(
  `http://localhost:3000/api/payment/stream/${orderId}?token=${token}`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.status === 'PAID') {
    eventSource.close();
    showSuccess('Payment confirmed!');
  } else if (data.status === 'FAILED') {
    eventSource.close();
    showError('Payment failed.');
  }
};

eventSource.onerror = () => {
  eventSource.close();
};
```

---

## 10. Troubleshooting Frontend Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| CORS error | Frontend domain not whitelisted | Add frontend URL to CORS config in backend |
| 401 Unauthorized | JWT token expired | Refresh token or re-login |
| Payment URL blank | Order creation failed | Check console for API errors |
| Webhook never arrives | Cashfree not configured | Set webhook URL in Cashfree dashboard |
| Redirect doesn't work | Return URL not set | Check `return_url` in order creation |

---

## Next Steps

1. ✅ Copy component code to your project
2. ✅ Update API URL to match your backend
3. ✅ Test with Cashfree test cards
4. ✅ Implement payment history display
5. ✅ Add error handling and user feedback
6. ✅ Deploy to production with real credentials

