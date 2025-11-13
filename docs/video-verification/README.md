# Video Verification - Complete Documentation

**Status:** Production Ready ✅  
**Last Updated:** November 13, 2025  
**Version:** 1.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [API Reference](#api-reference)
4. [Implementation Details](#implementation-details)
5. [Testing Guide](#testing-guide)
6. [Admin Operations](#admin-operations)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Quick Start

### Prerequisites
- User must be **ID_VERIFIED** (completed DigiLocker)
- Backend running: `npm run start:dev`
- Valid JWT token from authentication

### Complete Flow (4 Steps)

```bash
# 1. Initiate video session
http POST http://localhost:3000/api/video-verification/initiate \
  Authorization:"Bearer YOUR_TOKEN"

# Response includes:
# - sessionId: "VID_1702650000000_ABC123"
# - expiresAt: <30 minutes from now>
# - instructions: {maxDuration, formats, guidelines}

# 2. Record video (user action - client side)
# - Record 15-30 second video
# - Face clearly visible
# - Good lighting, no glasses
# - Upload to storage (S3, CloudStorage, etc.)

# 3. Submit video
http POST http://localhost:3000/api/video-verification/submit \
  Authorization:"Bearer YOUR_TOKEN" \
  sessionId=VID_1702650000000_ABC123 \
  videoUrl=https://storage.example.com/video.mp4 \
  videoDuration=     \
  videoFormat=mp4 \
  videoSize=5242880

# 4. Check status (user polls or gets notification from admin)
http GET http://localhost:3000/api/video-verification/status \
  Authorization:"Bearer YOUR_TOKEN"

# Response:
# {
#   "verified": true,
#   "status": "VERIFIED",
#   "verifiedAt": "2025-11-13T23:00:00.000Z"
# }
```

---

## Overview

### What is Video Verification?

Video verification is the final step in the KYC (Know Your Customer) process:
1. **Liveness Detection** - Ensure real person is recording
2. **Face Matching** - Compare face with DigiLocker/ID photo
3. **Admin Review** - Manual verification for accuracy

### Why Video Verification?

- Prevent identity fraud
- Ensure user is real person (not photo)
- Comply with financial regulations (RBI, PTA)
- Additional confidence after document verification

### Status Progression

```
ID_VERIFIED (DigiLocker done)
    ↓
PENDING (Video submitted, awaiting admin review)
    ↓
VERIFIED (Admin approved) → VIDEO_VERIFIED status
    ↓
Ready for Final Onboarding
```

### Architecture

```
┌────────────────────────┐
│  ID_VERIFIED User      │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Initiate Video Session │
│ • Generate sessionId   │
│ • Set 30-min expiry    │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ User Records Video     │
│ • Face visible        │
│ • 15-30 seconds       │
│ • Upload to storage   │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Submit Video           │
│ • Store URL           │
│ • Set status=PENDING  │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Admin Review           │
│ • Watch video         │
│ • Check face match    │
│ • Approve/Reject      │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ VIDEO_VERIFIED Status  │
│ Ready for completion   │
└────────────────────────┘
```

---

## API Reference

### 1. **POST** `/api/video-verification/initiate`

Initiate video verification session.

**Prerequisites:**
- User must be `ID_VERIFIED` status
- Valid JWT token

**Request:**
```json
{}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Video verification session initiated",
  "sessionId": "VID_1702650000000_ABC123",
  "expiresAt": "2025-11-13T23:45:00.000Z",
  "instructions": {
    "maxDuration": 30,
    "acceptedFormats": ["mp4", "webm", "mov"],
    "minFileSize": 102400,
    "maxFileSize": 52428800,
    "guidelines": [
      "Face should be clearly visible",
      "Good lighting is essential",
      "No glasses or face coverings allowed",
      "Look directly at camera",
      "Blink naturally and smile"
    ]
  }
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | User not ID_VERIFIED | User hasn't completed DigiLocker verification |
| 400 | Session already exists | User already has pending/verified video |
| 401 | Unauthorized | Missing or invalid token |
| 500 | Internal error | Database error |

---

### 2. **POST** `/api/video-verification/submit`

Submit recorded video for verification.

**Prerequisites:**
- Valid sessionId from `/initiate`
- Video uploaded to storage (S3, CloudStorage, etc.)
- Session not expired (within 30 minutes)

**Request:**
```json
{
  "sessionId": "VID_1702650000000_ABC123",
  "videoUrl": "https://storage.example.com/videos/user123_video.mp4",
  "videoDuration": 28,
  "videoFormat": "mp4",
  "videoSize": 5242880
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Video submitted successfully. Verification in progress.",
  "status": "PENDING",
  "nextStatus": "Admin will review within 24 hours"
}
```

**Field Specifications:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| sessionId | string | Yes | From `/initiate` response |
| videoUrl | string | Yes | HTTPS URL to uploaded video |
| videoDuration | number | Yes | Duration in seconds (15-30 recommended) |
| videoFormat | string | Optional | mp4, webm, mov |
| videoSize | number | Optional | File size in bytes |

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Invalid session | Session not found or expired |
| 400 | Invalid duration | Video too short or too long |
| 413 | File too large | Video exceeds 50MB limit |
| 500 | Submission failed | Storage or database error |

---

### 3. **GET** `/api/video-verification/status`

Get user's video verification status.

**Prerequisites:**
- Valid JWT token

**Response (200 OK):**
```json
{
  "success": true,
  "verified": false,
  "status": "PENDING",
  "message": "Your video is under review. Please wait for admin approval.",
  "nextSteps": [
    "1. Click 'Start Video Verification'",
    "2. Record a video with clear face visibility",
    "3. Submit video for verification",
    "4. Wait for admin approval"
  ]
}
```

**Possible Statuses:**

| Status | Meaning | User Action |
|--------|---------|------------|
| PENDING | Awaiting admin review | Wait for notification |
| VERIFIED | Approved by admin | Proceed to next step |
| REJECTED | Rejected by admin | Re-submit new video |
| FAILED | Processing error | Try again |

---

### 4. **GET** `/api/video-verification/health`

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-11-13T23:00:00.000Z",
  "service": "Video Verification",
  "status": "operational"
}
```

---

## Implementation Details

### Video Session Lifecycle

```
INITIATED (upon initiate call)
    ↓
RECORDING (user recording in client)
    ↓
SUBMITTED (user submits via /submit endpoint)
    ↓
PROCESSING (optional: async ML processing)
    ↓
COMPLETED (admin review done or auto-approval)
    ↓
EXPIRED (if not submitted within 30 minutes)
```

### Session Expiration

- **Default Duration:** 30 minutes
- **Configuration:** `SESSION_EXPIRY_MINUTES` in service
- **Auto-cleanup:** Via scheduled job (TODO)

### Storage Considerations

**Where to host video:**
- AWS S3 (recommended)
- Google Cloud Storage
- Azure Blob Storage
- Any HTTPS-accessible URL

**Security:**
- Videos must be HTTPS
- Implement presigned URLs for temporary access
- Auto-delete videos after retention period

### Face Matching

**Current Implementation:**
- Manual admin review
- TODO: Integrate ML service for auto-detection
  - Options: AWS Rekognition, Google Vision, Azure Face
  - Requirements: Face detection confidence > 80%
  - Liveness detection: Challenge-response or motion-based

### Data Storage

```javascript
UserVideoVerification {
  userId              // Unique per user
  videoUrl            // Storage URL
  videoDuration       // Recorded length
  videoFormat         // mp4, webm, mov
  faceDetected        // Boolean (TODO: from ML)
  livenessScore       // 0.0-1.0 (TODO: from ML)
  faceMatchScore      // 0.0-1.0 (TODO: from ML)
  status              // PENDING, VERIFIED, REJECTED
  verified            // Boolean
  verifiedBy          // Admin userId
  rejectionReason     // If rejected
  comparisonResult    // JSON comparison details
}
```

---

## Testing Guide

### Prerequisites

- Backend running: `npm run start:dev`
- User ID_VERIFIED (completed DigiLocker)
- JWT token from auth endpoint

### Quick Test (10 minutes)

```bash
# 1. Get ID_VERIFIED user token
# (Complete DigiLocker flow first if needed)
TOKEN="your_jwt_token_here"

# 2. Initiate session
curl -X POST http://localhost:3000/api/video-verification/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 3. Record test video (or use existing file)
# Create dummy video for testing
ffmpeg -f lavfi -i testsrc=size=320x240:duration=15 -f lavfi -i sine=frequency=1000:duration=15 test_video.mp4

# 4. Upload video (assumes S3 or similar)
# Or use presigned URL from your storage service
VIDEO_URL="https://your-storage.com/videos/test.mp4"

# 5. Submit video
curl -X POST http://localhost:3000/api/video-verification/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"VID_...\",
    \"videoUrl\": \"$VIDEO_URL\",
    \"videoDuration\": 15,
    \"videoFormat\": \"mp4\",
    \"videoSize\": 1024000
  }"

# 6. Check status
curl -X GET http://localhost:3000/api/video-verification/status \
  -H "Authorization: Bearer $TOKEN"
```

### Using REST Client (VS Code)

Create `test-video-verification.http`:

```http
@baseUrl = http://localhost:3000
@token = your_jwt_token_here

### 1. Initiate video session
POST {{baseUrl}}/api/video-verification/initiate
Authorization: Bearer {{token}}

### Response saved to
# Variables: sessionId, expiresAt

### 2. Submit video (after recording)
POST {{baseUrl}}/api/video-verification/submit
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "sessionId": "VID_from_response_above",
  "videoUrl": "https://storage.example.com/video.mp4",
  "videoDuration": 28,
  "videoFormat": "mp4",
  "videoSize": 5242880
}

### 3. Check status
GET {{baseUrl}}/api/video-verification/status
Authorization: Bearer {{token}}

### 4. Health check
GET {{baseUrl}}/api/video-verification/health
```

---

## Admin Operations

### Admin: Verify Video (Approve)

**Endpoint:** `POST /api/video-verification/admin/verify`

**Requirements:**
- User must have `role === 'ADMIN'`

**Request:**
```json
{
  "userId": "user_id_123",
  "notes": "Face match successful, liveness confirmed",
  "faceMatchScore": 0.95
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video verification approved",
  "userId": "user_id_123",
  "status": "VERIFIED",
  "userStatus": "VIDEO_VERIFIED",
  "verifiedAt": "2025-11-13T23:00:00.000Z"
}
```

**Effects:**
- `UserVideoVerification.verified = true`
- `UserVideoVerification.status = VERIFIED`
- `User.status = VIDEO_VERIFIED`
- User can now complete onboarding

---

### Admin: Reject Video

**Endpoint:** `POST /api/video-verification/admin/reject`

**Requirements:**
- User must have `role === 'ADMIN'`

**Request:**
```json
{
  "userId": "user_id_123",
  "rejectionReason": "Face not clearly visible",
  "notes": "Please ensure good lighting and direct eye contact"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video verification rejected",
  "userId": "user_id_123",
  "status": "REJECTED",
  "rejectionReason": "Face not clearly visible"
}
```

**Effects:**
- `UserVideoVerification.verified = false`
- `UserVideoVerification.status = REJECTED`
- User receives notification to re-submit

---

### Admin: Get Pending Videos

**Endpoint:** `GET /api/video-verification/admin/pending`

**Requirements:**
- User must have `role === 'ADMIN'`

**Response:**
```json
{
  "success": true,
  "count": 5,
  "videos": [
    {
      "userId": "user_123",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "submittedAt": "2025-11-13T22:00:00.000Z",
      "videoDuration": 28,
      "status": "PENDING"
    }
  ]
}
```

---

## Troubleshooting

### "User must complete ID verification before video verification"

**Cause:** User status is not `ID_VERIFIED`  
**Fix:** User must complete DigiLocker verification first

### "Invalid or expired session"

**Cause:** Session doesn't exist or is older than 30 minutes  
**Fix:** Call `/initiate` again to create new session

### "Video file too large"

**Cause:** Video exceeds 50MB limit  
**Fix:** Compress video or record shorter clip

### "Only admins can verify videos"

**Cause:** User calling admin endpoint doesn't have admin role  
**Fix:** Verify user role in database or ensure JWT has correct role

### Video won't upload to storage

**Cause:** Network issue or storage credentials invalid  
**Fix:**
- Check network connectivity
- Verify storage access (S3 policy, etc.)
- Check presigned URL validity if using temporary URLs

### Admin can't see pending videos

**Cause:** Filtering issue or no pending videos  
**Fix:**
- Check database has videos with `status = PENDING`
- Verify admin has correct permissions

---

## FAQ

**Q: How long do I have to submit the video?**  
A: 30 minutes from the time you initiate the session. Session expires after that.

**Q: Can I re-submit the video?**  
A: Yes. After rejection, initiate a new session and submit a new video.

**Q: What if admin rejects my video multiple times?**  
A: Contact support. We can help with lighting/recording tips or escalate for manual review.

**Q: How long for admin to review?**  
A: Target: Within 24 hours. High volume may take longer. SLA: 48 hours.

**Q: Is my video stored permanently?**  
A: No. Videos are deleted after:
  - 90 days if approved
  - 30 days if rejected
  - 24 hours if not submitted (expired session)

**Q: Can I use a video call recording instead of recording myself?**  
A: No. Must be direct video of user's face, not a recording of call.

**Q: What if I have an accent or speech impediment?**  
A: No problem. Verification is face-based, not speech-based.

**Q: Can someone else submit a video for me?**  
A: No. The system is designed to prevent identity fraud. You must record yourself.

---

## Related Documentation

- [DigiLocker Verification](../digilocker/README.md) - Previous verification step
- [Complete Verification Flow](../guides/COMPLETE_VERIFICATION_FLOW.md) - Full user journey
- [API Documentation Index](../INDEX.md) - All API endpoints

---

**Support:** Contact backend team for video verification issues
