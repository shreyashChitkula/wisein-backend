# DigiLocker Verification Service - Complete Documentation

## Overview

The DigiLocker Verification Service is a complete identity verification solution integrated into the WiseIn backend onboarding flow. It securely verifies user identity by fetching Aadhaar data from DigiLocker and comparing it with user-provided information.

### Key Features

- **Real-time Verification**: Fetches data directly from DigiLocker when needed
- **No PII Storage**: DigiLocker data is never persisted in database
- **Transaction Safety**: Prevents duplicate account verification
- **Comprehensive Logging**: All operations are logged for audit purposes
- **Error Handling**: Detailed, user-friendly error messages
- **Production Ready**: Fully tested and documented

---

## API Endpoints

### 1. **POST** `/api/v1/digilocker/initiate`

Initiates the DigiLocker verification flow.

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/digilocker/initiate \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mobileNumber": "9876543210"
  }'
```

**Request Body:**
```json
{
  "mobileNumber": "9876543210"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mobileNumber` | string | Yes | 10-digit mobile number linked to Aadhaar |

#### Success Response (200 OK)

```json
{
  "success": true,
  "accountExists": true,
  "consentUrl": "https://verification-test.cashfree.com/dgl/...",
  "verificationId": "VER_1702650000000_ABC123",
  "flowType": "signin",
  "message": "DigiLocker account found. Please complete verification."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether request succeeded |
| `accountExists` | boolean | Whether DigiLocker account exists |
| `consentUrl` | string | URL to redirect user for DigiLocker consent |
| `verificationId` | string | **IMPORTANT:** Save this for next steps |
| `flowType` | string | Either 'signin' (existing) or 'signup' (new) |
| `message` | string | Human-readable status |

#### Error Responses

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Invalid mobile number | Mobile number not 10 digits |
| 409 | Account already verified | DigiLocker account in use by another user |
| 500 | Server error | Cashfree API unreachable |

---

### 2. **POST** `/api/v1/digilocker/callback`

Process the callback after user completes DigiLocker consent.

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/digilocker/callback \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationId": "VER_1702650000000_ABC123"
  }'
```

**Request Body:**
```json
{
  "verificationId": "VER_1702650000000_ABC123"
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "status": "AUTHENTICATED",
  "readyForComparison": true,
  "message": "DigiLocker verification successful. Ready for comparison."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether processing succeeded |
| `status` | string | Current status (AUTHENTICATED, PENDING, EXPIRED, CONSENT_DENIED) |
| `readyForComparison` | boolean | Whether you can call `/complete` endpoint |
| `message` | string | Status description |

#### Possible Status Values

| Status | Action Required |
|--------|-----------------|
| `AUTHENTICATED` | Proceed to `/complete` endpoint |
| `PENDING` | Ask user to complete DigiLocker flow |
| `EXPIRED` | Ask user to start over (call `/initiate` again) |
| `CONSENT_DENIED` | Ask user to approve document sharing |

---

### 3. **POST** `/api/v1/digilocker/complete`

Complete verification with data comparison.

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/digilocker/complete \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationId": "VER_1702650000000_ABC123",
    "userProvidedData": {
      "nameAsPerAadhaar": "JOHN DOE",
      "dateOfBirth": "1990-05-15",
      "gender": "Male",
      "country": "India",
      "state": "Maharashtra",
      "district": "Mumbai",
      "pincode": "400001",
      "phoneNumber": "9876543210",
      "addressLine1": "123 Main Street",
      "addressLine2": "Apartment 4B"
    }
  }'
```

**Request Body:**
```json
{
  "verificationId": "VER_1702650000000_ABC123",
  "userProvidedData": {
    "nameAsPerAadhaar": "JOHN DOE",
    "dateOfBirth": "1990-05-15",
    "gender": "Male",
    "country": "India",
    "state": "Maharashtra",
    "district": "Mumbai",
    "pincode": "400001",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apartment 4B"
  }
}
```

**userProvidedData Fields:**

| Field | Type | Required | Format | Description |
|-------|------|----------|--------|-------------|
| `nameAsPerAadhaar` | string | Yes | Text | Full name as on Aadhaar (case-insensitive) |
| `dateOfBirth` | string | Yes | YYYY-MM-DD | Date of birth |
| `gender` | string | Yes | Male/Female/Other | Gender |
| `country` | string | Yes | India | Country (only India supported) |
| `state` | string | Yes | Text | State/UT name |
| `district` | string | No | Text | District name |
| `pincode` | string | Yes | 6 digits | Postal code |
| `phoneNumber` | string | Yes | 10 digits | Mobile number |
| `addressLine1` | string | Yes | Text | Primary address |
| `addressLine2` | string | No | Text | Secondary address |

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Identity verification completed successfully",
  "comparisonResult": {
    "isMatch": true,
    "matchedFields": ["name", "dob", "gender", "state", "pincode"],
    "mismatchedFields": []
  },
  "storedData": {
    "name": "JOHN DOE",
    "dateOfBirth": "1990-05-15",
    "gender": "Male",
    "phoneNumber": "9876543210"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether verification succeeded |
| `message` | string | Status message |
| `comparisonResult` | object | Which fields matched |
| `storedData` | object | Data that was stored in database |

#### Error Responses

| Status | Error | Cause | Action |
|--------|-------|-------|--------|
| 400 | Data mismatch | User info doesn't match DigiLocker | User must correct data |
| 400 | Incomplete data | Some fields missing | Ensure all fields filled |
| 409 | Account already verified | DigiLocker used elsewhere | Contact support |
| 500 | Server error | Internal error | Retry later |

**Example Error Response:**
```json
{
  "statusCode": 400,
  "message": "Data verification failed. Mismatched fields: name, state"
}
```

---

### 4. **GET** `/api/v1/digilocker/status/:verificationId`

Get current verification status (useful for polling).

#### Request

```bash
curl http://localhost:3000/api/v1/digilocker/status/VER_1702650000000_ABC123
```

#### Success Response (200 OK)

```json
{
  "status": "AUTHENTICATED",
  "readyForComparison": true,
  "message": "Ready for data comparison"
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Verification session not found or expired"
}
```

---

### 5. **GET** `/api/v1/digilocker/user-status`

Get user's overall verification status.

#### Request

```bash
curl http://localhost:3000/api/v1/digilocker/user-status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "verified": true,
  "verificationType": "DIGILOCKER",
  "needsMigration": false,
  "message": "User is verified"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request succeeded |
| `verified` | boolean | Whether user is verified |
| `verificationType` | string | Type of verification (DIGILOCKER) |
| `needsMigration` | boolean | Whether migration needed |
| `message` | string | Status message |

---

### 6. **POST** `/api/v1/digilocker/admin/cleanup-expired`

Admin endpoint to cleanup expired sessions.

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/digilocker/admin/cleanup-expired \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "deletedCount": 42,
  "message": "Cleaned up 42 expired verification sessions"
}
```

---

### 7. **GET** `/api/v1/digilocker/health`

Health check endpoint.

#### Request

```bash
curl http://localhost:3000/api/v1/digilocker/health
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "timestamp": "2023-12-15T10:30:00.000Z",
  "service": "DigiLocker Verification",
  "status": "operational"
}
```

---

## Integration Flow

### Step-by-Step User Journey

```
1. User enters mobile number
   ↓
2. Call POST /initiate
   ↓
3. Receive: verificationId, consentUrl
   ↓
4. Redirect user to consentUrl
   ↓
5. User authenticates with DigiLocker
   ↓
6. User approves document sharing
   ↓
7. User is redirected back to your app
   ↓
8. Call POST /callback with verificationId
   ↓
9. If status is AUTHENTICATED:
   ↓
10. Display form for user to enter personal data
   ↓
11. Call POST /complete with userProvidedData
   ↓
12. If success: User is verified!
```

---

## Data Comparison Logic

The service compares the following fields between DigiLocker and user input:

**Critical Fields (All must match):**
- Name (case-insensitive, special characters ignored)
- Date of Birth (converted to ISO format)
- Gender (normalized: M/F/T → Male/Female/Other)
- State (spaces and special characters removed)
- Pincode (exact match)

**Field Matching Details:**

| Field | Comparison Method |
|-------|-------------------|
| Name | Normalize case, remove special chars, compare text |
| DOB | Convert DigiLocker format (DD-MM-YYYY) to ISO (YYYY-MM-DD) |
| Gender | Normalize to standard values |
| State | Normalize case and whitespace |
| Pincode | Exact match |

---

## Environment Variables

Required configuration (add to `.env`):

```env
# Cashfree DigiLocker Configuration
CASHFREE_API_KEY=your_api_key_here
CASHFREE_API_SECRET=your_api_secret_here
CASHFREE_BASE_URL=https://sandbox.cashfree.com  # or production URL
```

---

## Database Schema

### UserVerification Table

Extended to include DigiLocker fields:

```sql
UserVerification {
  id                    String  (primary key)
  userId                String  (unique)
  
  -- DigiLocker specific
  digilockerAccountId   String  (unique, nullable)
  verified              Boolean (default: false)
  
  -- Identity data
  nameAsPerAadhaar      String  (nullable)
  dateOfBirth           Date    (nullable)
  gender                String  (nullable)
  country               String  (nullable)
  state                 String  (nullable)
  district              String  (nullable)
  pincode               String  (nullable)
  phoneNumber           String  (nullable)
  addressLine1          String  (nullable)
  addressLine2          String  (nullable)
  
  -- Verification metadata
  comparisonResult      Json    (which fields matched)
  method                Enum    (DIGILOCKER)
  verificationStatus    Enum    (PENDING, VERIFIED, REJECTED)
  verifiedAt            DateTime (nullable)
  
  -- Timestamps
  createdAt             DateTime
  updatedAt             DateTime
}
```

### DigiLockerVerificationSession Table

```sql
DigiLockerVerificationSession {
  id                    String  (primary key)
  verificationId        String  (unique)
  userId                String
  
  -- Session data
  mobileNumber          String
  digilockerAccountId   String  (nullable)
  status                String  (INITIATED, AUTHENTICATED, PENDING, EXPIRED, CONSENT_DENIED)
  flowType              String  (signin, signup)
  
  -- Consent flow
  consentUrl            String  (nullable)
  webhookProvidedMobileNo String (nullable)
  
  -- Timestamps
  createdAt             DateTime
  updatedAt             DateTime
}
```

---

## Error Codes & Messages

### Validation Errors (400)

| Code | Message | Resolution |
|------|---------|-----------|
| INVALID_MOBILE | Mobile number must be 10 digits | Enter valid 10-digit number |
| INVALID_VERIFICATION_ID | Invalid or expired verification ID | Start new verification |
| INCOMPLETE_DATA | Some required fields are missing | Fill all required fields |
| INVALID_DATE_FORMAT | Date must be in YYYY-MM-DD format | Use correct date format |
| INVALID_PINCODE | Pincode must be 6 digits | Enter 6-digit pincode |

### Conflict Errors (409)

| Code | Message | Resolution |
|------|---------|-----------|
| ALREADY_VERIFIED | DigiLocker account already verified | Contact support |
| DUPLICATE_ACCOUNT | Account in use by another user | Use different mobile |

### Not Found Errors (404)

| Code | Message | Resolution |
|------|---------|-----------|
| SESSION_NOT_FOUND | Verification session not found | Start new verification |
| USER_NOT_FOUND | User not found | Create account first |

### Server Errors (500)

| Code | Message | Resolution |
|------|---------|-----------|
| API_ERROR | DigiLocker API unreachable | Try again later |
| DATABASE_ERROR | Database operation failed | Try again later |
| INTERNAL_ERROR | Unexpected error | Contact support |

---

## Security Considerations

1. **HTTPS Only**: All endpoints require HTTPS in production
2. **Authentication**: All endpoints (except health) require valid JWT token
3. **Data Privacy**: DigiLocker data is never stored, only compared in-memory
4. **Race Condition Protection**: Database transactions ensure atomicity
5. **Session Expiry**: Verification sessions auto-delete after 24 hours
6. **Rate Limiting**: Status endpoint limited to 20 requests/minute
7. **Audit Trail**: All operations logged for compliance

---

## Testing

### Test Mobile Numbers

For Cashfree sandbox:
- `9876543210` - Test number (account exists)
- `9898989898` - Test number (new account)

### Test Credentials

Name: `TEST USER` or `JOHN DOE`  
DOB: `1990-05-15`  
Gender: `Male`  
State: `Maharashtra`  
Pincode: `400001`

---

## Troubleshooting

### "Consent not provided" Error

**Cause**: User didn't approve document sharing  
**Solution**: Restart verification flow with explicit consent request

### "Data mismatch" Error

**Cause**: User entered data that doesn't match Aadhaar  
**Solution**: Double-check spelling, dates, gender selection

### "Account already verified" Error

**Cause**: DigiLocker account used by another user  
**Solution**: Use different mobile number or contact support

### "Session expired" Error

**Cause**: Took longer than 24 hours  
**Solution**: Initiate new verification

---

## Support

For issues:
1. Check error message and troubleshooting section
2. Review logs in application logs directory
3. Verify Cashfree API credentials
4. Contact WiseIn support with error details

---

**Last Updated**: November 2025  
**Version**: 1.0  
**Status**: Production Ready
