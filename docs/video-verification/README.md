# Video Verification - Complete Documentation

**Status:** Production Ready ✅  
**Last Updated:** November 15, 2025  
**Version:** 2.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [API Reference](#api-reference)
4. [Implementation Details](#implementation-details)
5. [Testing Guide](#testing-guide)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Quick Start

### Prerequisites
- User must be authenticated (valid JWT token)
- Photo and video URLs ready (uploaded to storage service)

### Complete Flow (2 Steps)

```bash
# 1. Create video verification (submits photo and video URLs)
curl -X POST http://localhost:3000/api/video-verification/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photoUrl": "https://storage.example.com/photos/user123.jpg",
    "videoUrl": "https://storage.example.com/videos/user123.mp4"
  }'

# Response:
# {
#   "success": true,
#   "message": "Verification successful! Welcome aboard.",
#   "verificationStatus": "VIDEO_VERIFIED",
#   "verifiedAt": "2025-11-15T23:00:00.000Z"
# }

# 2. Check status
curl -X GET http://localhost:3000/api/video-verification/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
# {
#   "success": true,
#   "verified": true,
#   "status": "VIDEO_VERIFIED",
#   "message": "You are fully verified!",
#   "photoUrl": "https://storage.example.com/photos/user123.jpg",
#   "videoUrl": "https://storage.example.com/videos/user123.mp4"
# }
```

---

## Overview

### What is Video Verification?

Video verification is the final step in the user onboarding process. Users submit a photo and video, and the system automatically approves the verification, upgrading the user status to `VIDEO_VERIFIED`.

### Why Video Verification?

- Final verification step after ID verification (DigiLocker)
- Stores user photo and video for profile/verification purposes
- Automatically approves upon submission (no admin review required)
- Upgrades user status to `VIDEO_VERIFIED` for full platform access

### Status Progression

```
ID_VERIFIED (DigiLocker done)
    ↓
POST /create (with photoUrl and videoUrl)
    ↓
VIDEO_VERIFIED (automatic approval)
    ↓
Ready for Final Onboarding
```

### Architecture

```
┌────────────────────────┐
│  Authenticated User    │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ POST /create           │
│ • photoUrl (required)  │
│ • videoUrl (required)  │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Auto-Approval          │
│ • Create/Update record │
│ • Set verified=true    │
│ • Set status=VIDEO_VERIFIED │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ User Status Updated    │
│ status = VIDEO_VERIFIED│
└────────────────────────┘
```

---

## API Reference

### 1. **POST** `/api/video-verification/create`

Create video verification with photo and video URLs. This endpoint automatically approves the verification and upgrades the user status to `VIDEO_VERIFIED`.

**Prerequisites:**
- Valid JWT token
- User must be authenticated

**Request Body:**
```json
{
  "photoUrl": "https://storage.example.com/photos/user123.jpg",
  "videoUrl": "https://storage.example.com/videos/user123.mp4"
}
```

**Field Specifications:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| photoUrl | string | Yes | HTTPS URL to uploaded photo |
| videoUrl | string | Yes | HTTPS URL to uploaded video |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification successful! Welcome aboard.",
  "verificationStatus": "VIDEO_VERIFIED",
  "verifiedAt": "2025-11-15T23:00:00.000Z"
}
```

**If user is already verified:**
```json
{
  "success": true,
  "message": "Already verified",
  "status": "VIDEO_VERIFIED"
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Both photo and video URLs are required | Missing photoUrl or videoUrl |
| 401 | Unauthorized | Missing or invalid token |
| 404 | User not found | User ID from token doesn't exist |
| 500 | Failed to complete registration | Internal server error |

---

### 2. **GET** `/api/video-verification/status`

Get video verification status for the authenticated user.

**Prerequisites:**
- Valid JWT token

**Response (200 OK) - Verified:**
```json
{
  "success": true,
  "verified": true,
  "status": "VIDEO_VERIFIED",
  "message": "You are fully verified!",
  "photoUrl": "https://storage.example.com/photos/user123.jpg",
  "videoUrl": "https://storage.example.com/videos/user123.mp4"
}
```

**Response (200 OK) - Not Started:**
```json
{
  "success": true,
  "verified": false,
  "status": "NOT_STARTED",
  "message": "Please complete video verification"
}
```

**Response (200 OK) - In Progress:**
```json
{
  "success": true,
  "verified": false,
  "status": "ID_VERIFIED",
  "message": "Verification in progress...",
  "photoUrl": "https://storage.example.com/photos/user123.jpg",
  "videoUrl": "https://storage.example.com/videos/user123.mp4"
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 401 | Unauthorized | Missing or invalid token |
| 500 | Failed to fetch status | Internal server error |

---

## Implementation Details

### Data Storage

The system stores video verification data in the `UserVideoVerification` table:

```typescript
UserVideoVerification {
  id              // Unique identifier
  userId          // Foreign key to User (unique)
  photoUrl        // URL to user's photo
  videoUrl        // URL to user's video
  status          // "PENDING" or "VIDEO_VERIFIED"
  verified        // Boolean (true after /create)
  verifiedAt      // Timestamp when verified
  verifiedBy      // Optional admin ID (null for auto-approval)
  rejectionReason // Optional (null for auto-approval)
  adminNotes      // Optional admin notes
  createdAt       // Record creation timestamp
  updatedAt       // Last update timestamp
}
```

### Auto-Approval Flow

1. User submits `photoUrl` and `videoUrl` via `/create`
2. System validates both URLs are provided
3. System checks if user already has `VIDEO_VERIFIED` status
4. If not verified:
   - Creates or updates `UserVideoVerification` record
   - Sets `verified = true`
   - Sets `status = "VIDEO_VERIFIED"`
   - Sets `verifiedAt = current timestamp`
   - Updates `User.status = "VIDEO_VERIFIED"`
5. Returns success response

### Storage Considerations

**Where to host photos/videos:**
- AWS S3 (recommended)
- Google Cloud Storage
- Azure Blob Storage
- Any HTTPS-accessible URL

**Security:**
- URLs must be HTTPS
- Implement presigned URLs for temporary access if needed
- Consider implementing retention policies for old media

---

## Testing Guide

### Prerequisites

- Backend running: `npm run start:dev`
- Valid JWT token from authentication
- Photo and video uploaded to storage service

### Quick Test (5 minutes)

```bash
# Set your token
TOKEN="your_jwt_token_here"

# 1. Create video verification
curl -X POST http://localhost:3000/api/video-verification/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photoUrl": "https://storage.example.com/photos/test.jpg",
    "videoUrl": "https://storage.example.com/videos/test.mp4"
  }'

# 2. Check status
curl -X GET http://localhost:3000/api/video-verification/status \
  -H "Authorization: Bearer $TOKEN"
```

### Using REST Client (VS Code)

Create `test-video-verification.http`:

```http
@baseUrl = http://localhost:3000
@token = your_jwt_token_here

### 1. Create video verification
POST {{baseUrl}}/api/video-verification/create
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "photoUrl": "https://storage.example.com/photos/user123.jpg",
  "videoUrl": "https://storage.example.com/videos/user123.mp4"
}

### 2. Check status
GET {{baseUrl}}/api/video-verification/status
Authorization: Bearer {{token}}
```

---

## Troubleshooting

### "Both photo and video URLs are required"

**Cause:** Missing `photoUrl` or `videoUrl in request body  
**Fix:** Ensure both fields are provided in the request body

### "User not found"

**Cause:** User ID from JWT token doesn't exist in database  
**Fix:** Verify user exists and token is valid

### "Unauthorized"

**Cause:** Missing or invalid JWT token  
**Fix:** 
- Check token is included in `Authorization: Bearer <token>` header
- Verify token hasn't expired
- Re-authenticate if needed

### "Failed to complete registration"

**Cause:** Database error or internal server issue  
**Fix:**
- Check database connection
- Review server logs for detailed error
- Verify Prisma schema is up to date

### Photo/Video URLs not accessible

**Cause:** URLs may be invalid, expired, or require authentication  
**Fix:**
- Verify URLs are publicly accessible (or use presigned URLs)
- Check URLs are HTTPS
- Ensure storage service is configured correctly

---

## FAQ

**Q: How long does verification take?**  
A: Verification is instant. Upon successful submission via `/create`, the user is immediately marked as `VIDEO_VERIFIED`.

**Q: Can I update my photo/video?**  
A: Yes. Call `/create` again with new URLs. The existing record will be updated.

**Q: What happens if I'm already verified?**  
A: The endpoint returns a success response indicating you're already verified. No changes are made.

**Q: What file formats are supported?**  
A: Any format accessible via HTTPS URL. Common formats:
- Photos: JPG, PNG, WEBP
- Videos: MP4, WEBM, MOV

**Q: Is there a file size limit?**  
A: No limit enforced by the API, but consider:
- Storage service limits
- Network transfer time
- User experience

**Q: Can I delete my verification?**  
A: Not via API. Contact support if you need to reset your verification.

**Q: What if my photo/video URL expires?**  
A: The URLs are stored as provided. If they expire, you'll need to re-submit with new URLs. Consider using permanent URLs or implementing a URL refresh mechanism.

**Q: Is admin review required?**  
A: No. Verification is automatically approved upon submission.

---

## Related Documentation

- [DigiLocker Verification](../digilocker/README.md) - Previous verification step
- [User Onboarding](../USER_ONBOARDING.md) - Complete user journey
- [API Documentation Index](../INDEX.md) - All API endpoints

---

**Support:** Contact backend team for video verification issues
