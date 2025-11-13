# DigiLocker Verification - Frontend Integration Guide

## Quick Start

Integrate DigiLocker verification in 5 steps:

1. ✅ Collect mobile number
2. ✅ Call `/initiate` endpoint
3. ✅ Redirect to DigiLocker consent URL
4. ✅ Handle callback from DigiLocker
5. ✅ Collect user data and call `/complete`

---

## Step 1: Collect Mobile Number

Create a simple form to collect the user's mobile number:

```html
<form id="mobileForm" onsubmit="initiateVerification(event)">
  <div class="form-group">
    <label for="mobileNumber">Mobile Number</label>
    <input
      type="tel"
      id="mobileNumber"
      name="mobileNumber"
      placeholder="9876543210"
      maxlength="10"
      pattern="[0-9]{10}"
      required
    />
    <small>10-digit number linked to your Aadhaar</small>
  </div>
  <button type="submit">Start Verification</button>
</form>

<div id="messageContainer"></div>
```

---

## Step 2: Call `/initiate` Endpoint

Send the mobile number to your backend:

```javascript
async function initiateVerification(event) {
  event.preventDefault();

  const mobileNumber = document.getElementById('mobileNumber').value;

  // Validate
  if (!mobileNumber || mobileNumber.length !== 10) {
    showMessage('Please enter a valid 10-digit mobile number', 'error');
    return;
  }

  try {
    showMessage('Initiating verification...', 'loading');

    const response = await fetch('/api/v1/digilocker/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mobileNumber })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.message || 'Failed to initiate verification', 'error');
      return;
    }

    // **IMPORTANT:** Save verificationId
    sessionStorage.setItem('verificationId', data.verificationId);
    sessionStorage.setItem('mobileNumber', mobileNumber);

    showMessage('Redirecting to DigiLocker...', 'info');

    // Redirect to DigiLocker
    setTimeout(() => {
      window.location.href = data.consentUrl;
    }, 1000);

  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

function showMessage(message, type) {
  const container = document.getElementById('messageContainer');
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

function getAuthToken() {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}
```

---

## Step 3: Redirect to DigiLocker

The `/initiate` endpoint returns a `consentUrl`. Redirect the user there:

```javascript
window.location.href = data.consentUrl;
```

The user will:
1. Login with their Aadhaar/mobile
2. See a consent dialog for document sharing
3. Approve to continue
4. Be redirected back to your app

---

## Step 4: Handle DigiLocker Callback

Create a callback page that handles the redirect from DigiLocker:

```html
<!-- digilocker-callback.html -->
<div id="processingContainer">
  <div class="spinner"></div>
  <p>Processing DigiLocker response...</p>
</div>

<div id="messageContainer"></div>
```

```javascript
// digilocker-callback.js

async function handleDigiLockerCallback() {
  try {
    // Get verificationId from session
    const verificationId = sessionStorage.getItem('verificationId');
    
    if (!verificationId) {
      showMessage('Verification session not found. Please start over.', 'error');
      setTimeout(() => window.location.href = '/verify', 3000);
      return;
    }

    showMessage('Processing DigiLocker response...', 'loading');

    // Call callback endpoint
    const response = await fetch('/api/v1/digilocker/callback', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ verificationId })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showMessage(data.message || 'DigiLocker authentication failed', 'error');
      setTimeout(() => window.location.href = '/verify', 3000);
      return;
    }

    if (data.status === 'AUTHENTICATED' && data.readyForComparison) {
      showMessage('DigiLocker authenticated! Proceeding to data entry...', 'success');
      
      // Redirect to data entry form
      setTimeout(() => {
        window.location.href = '/verify/enter-data';
      }, 1500);
    } else {
      showMessage('Verification incomplete. Please try again.', 'error');
      setTimeout(() => window.location.href = '/verify', 3000);
    }

  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
    setTimeout(() => window.location.href = '/verify', 3000);
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', handleDigiLockerCallback);
```

---

## Step 5: Collect User Data and Complete

Create a form for users to enter their personal information:

```html
<!-- enter-data.html -->
<form id="userDataForm" onsubmit="completeVerification(event)">
  <h2>Complete Your Identity Verification</h2>

  <div class="form-group">
    <label for="nameAsPerAadhaar">Name as per Aadhaar *</label>
    <input
      type="text"
      id="nameAsPerAadhaar"
      name="nameAsPerAadhaar"
      placeholder="JOHN DOE"
      required
    />
    <small>Must match exactly as on your Aadhaar</small>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="dateOfBirth">Date of Birth *</label>
      <input
        type="date"
        id="dateOfBirth"
        name="dateOfBirth"
        required
      />
    </div>
    
    <div class="form-group">
      <label for="gender">Gender *</label>
      <select id="gender" name="gender" required>
        <option value="">Select</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>
    </div>
  </div>

  <div class="form-group">
    <label for="country">Country *</label>
    <input
      type="text"
      id="country"
      name="country"
      value="India"
      disabled
    />
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="state">State *</label>
      <select id="state" name="state" required>
        <option value="">Select State</option>
        <option value="Andhra Pradesh">Andhra Pradesh</option>
        <option value="Arunachal Pradesh">Arunachal Pradesh</option>
        <!-- ... all states ... -->
        <option value="Maharashtra">Maharashtra</option>
        <!-- ... -->
      </select>
    </div>

    <div class="form-group">
      <label for="district">District *</label>
      <input
        type="text"
        id="district"
        name="district"
        placeholder="e.g., Mumbai"
        required
      />
    </div>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="pincode">Pincode *</label>
      <input
        type="text"
        id="pincode"
        name="pincode"
        placeholder="400001"
        pattern="[0-9]{6}"
        maxlength="6"
        required
      />
    </div>

    <div class="form-group">
      <label for="phoneNumber">Mobile Number *</label>
      <input
        type="tel"
        id="phoneNumber"
        name="phoneNumber"
        placeholder="9876543210"
        pattern="[0-9]{10}"
        maxlength="10"
        required
      />
      <small>Must match the number used for DigiLocker</small>
    </div>
  </div>

  <div class="form-group">
    <label for="addressLine1">Address Line 1 *</label>
    <input
      type="text"
      id="addressLine1"
      name="addressLine1"
      placeholder="123 Main Street"
      required
    />
  </div>

  <div class="form-group">
    <label for="addressLine2">Address Line 2 (Optional)</label>
    <input
      type="text"
      id="addressLine2"
      name="addressLine2"
      placeholder="Apartment 4B"
    />
  </div>

  <button type="submit" class="btn-primary">Complete Verification</button>
  <button type="button" class="btn-secondary" onclick="window.history.back()">Go Back</button>
</form>

<div id="messageContainer"></div>
```

```javascript
// Complete verification
async function completeVerification(event) {
  event.preventDefault();

  try {
    showMessage('Verifying your information...', 'loading');

    const verificationId = sessionStorage.getItem('verificationId');
    if (!verificationId) {
      showMessage('Verification session expired. Please start over.', 'error');
      return;
    }

    // Get form data
    const formData = new FormData(document.getElementById('userDataForm'));
    const userProvidedData = {
      nameAsPerAadhaar: formData.get('nameAsPerAadhaar'),
      dateOfBirth: formData.get('dateOfBirth'),
      gender: formData.get('gender'),
      country: formData.get('country') || 'India',
      state: formData.get('state'),
      district: formData.get('district'),
      pincode: formData.get('pincode'),
      phoneNumber: formData.get('phoneNumber'),
      addressLine1: formData.get('addressLine1'),
      addressLine2: formData.get('addressLine2') || undefined
    };

    // Submit to backend
    const response = await fetch('/api/v1/digilocker/complete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        verificationId,
        userProvidedData
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = getErrorMessage(data);
      showMessage(errorMessage, 'error');
      return;
    }

    if (!data.success) {
      showMessage(data.message || 'Verification failed', 'error');
      return;
    }

    // Success!
    showMessage('✓ Verification successful!', 'success');
    
    // Clear session
    sessionStorage.removeItem('verificationId');
    
    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = '/onboarding/success';
    }, 2000);

  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

function getErrorMessage(data) {
  if (data.message?.includes('mismatch')) {
    return `Data verification failed. Please check: ${data.message}`;
  }
  return data.message || 'Verification failed. Please try again.';
}

function getAuthToken() {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function showMessage(message, type) {
  const container = document.getElementById('messageContainer');
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}
```

---

## State List (For Dropdown)

```javascript
const states = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
  "Delhi",
  "Puducherry"
];

// Populate state dropdown
function populateStates() {
  const stateSelect = document.getElementById('state');
  states.forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', populateStates);
```

---

## React Component Example

```jsx
import React, { useState } from 'react';

const DigiLockerVerification = () => {
  const [step, setStep] = useState('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nameAsPerAadhaar: '',
    dateOfBirth: '',
    gender: '',
    country: 'India',
    state: '',
    district: '',
    pincode: '',
    phoneNumber: '',
    addressLine1: '',
    addressLine2: ''
  });

  const getAuthToken = () => {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  };

  const initiateVerification = async (e) => {
    e.preventDefault();
    
    if (!mobileNumber || mobileNumber.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/digilocker/initiate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mobileNumber })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to initiate verification');
        return;
      }

      sessionStorage.setItem('verificationId', data.verificationId);
      window.location.href = data.consentUrl;

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeVerification = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/digilocker/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verificationId,
          userProvidedData: formData
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Verification failed');
        return;
      }

      // Success
      window.location.href = '/onboarding/success';

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="digilocker-verification">
      {error && <div className="alert alert-error">{error}</div>}

      {step === 'mobile' && (
        <form onSubmit={initiateVerification}>
          <h2>DigiLocker Verification</h2>
          <input
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="9876543210"
            maxLength="10"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Initiating...' : 'Start Verification'}
          </button>
        </form>
      )}

      {step === 'data' && (
        <form onSubmit={completeVerification}>
          <h2>Enter Your Details</h2>
          <input
            type="text"
            placeholder="Name"
            value={formData.nameAsPerAadhaar}
            onChange={(e) => setFormData({...formData, nameAsPerAadhaar: e.target.value})}
            required
          />
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
            required
          />
          {/* ... other fields ... */}
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Complete Verification'}
          </button>
        </form>
      )}
    </div>
  );
};

export default DigiLockerVerification;
```

---

## CSS Styling

```css
.digilocker-verification {
  max-width: 500px;
  margin: 40px auto;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0,123,255,0.25);
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #666;
  font-size: 12px;
}

button {
  width: 100%;
  padding: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.3s;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert {
  padding: 12px;
  margin-bottom: 20px;
  border-radius: 4px;
  font-size: 14px;
}

.alert-error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.alert-info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.alert-loading {
  background-color: #e7f3ff;
  color: #004085;
  border: 1px solid #b8daff;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

---

## Error Handling Best Practices

```javascript
function getErrorMessage(error) {
  // Handle different error types
  if (error.message?.includes('mismatch')) {
    return 'Your information doesn\'t match your Aadhaar. Please check and try again.';
  }
  if (error.message?.includes('already verified')) {
    return 'This Aadhaar is already registered. Please contact support.';
  }
  if (error.message?.includes('expired')) {
    return 'Your session has expired. Please start over.';
  }
  return error.message || 'An error occurred. Please try again.';
}

// Implement retry logic
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // Don't retry on 4xx errors (except 408, 429)
      if (response.status >= 400 && response.status < 500 && 
          response.status !== 408 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

---

## Testing Checklist

- [ ] Mobile number validation works
- [ ] Redirect to DigiLocker URL works
- [ ] Callback handling on return
- [ ] Form validation for all fields
- [ ] Successful verification completes
- [ ] Data mismatch shows proper error
- [ ] Network error handling
- [ ] Session expiry handling
- [ ] Duplicate account detection
- [ ] Loading states display correctly

---

## Support Resources

- **API Docs**: See `DIGILOCKER_API_DOCUMENTATION.md`
- **Cashfree Docs**: https://docs.cashfree.com
- **Error Troubleshooting**: See API documentation error section

---

**Last Updated**: November 2025  
**Version**: 1.0
