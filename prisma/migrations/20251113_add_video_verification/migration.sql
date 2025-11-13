-- AddColumn for UserVideoVerification
ALTER TABLE "UserVerification" ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "frameUrl" TEXT;

-- Create UserVideoVerification table
CREATE TABLE "UserVideoVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "videoVerificationSessionId" TEXT,
    "videoUrl" TEXT,
    "videoSize" INTEGER,
    "videoDuration" INTEGER,
    "videoFormat" TEXT,
    "faceDetected" BOOLEAN NOT NULL DEFAULT false,
    "livenessScore" REAL,
    "faceMatchScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "comparisonResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserVideoVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create VideoVerificationSession table
CREATE TABLE "VideoVerificationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "recordingUrl" TEXT,
    "recordingDuration" INTEGER,
    "serverSideUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoVerificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX "UserVideoVerification_userId_idx" ON "UserVideoVerification"("userId");
CREATE INDEX "UserVideoVerification_status_idx" ON "UserVideoVerification"("status");
CREATE INDEX "UserVideoVerification_verified_idx" ON "UserVideoVerification"("verified");
CREATE INDEX "UserVideoVerification_createdAt_idx" ON "UserVideoVerification"("createdAt");

CREATE INDEX "VideoVerificationSession_userId_idx" ON "VideoVerificationSession"("userId");
CREATE INDEX "VideoVerificationSession_sessionId_idx" ON "VideoVerificationSession"("sessionId");
CREATE INDEX "VideoVerificationSession_status_idx" ON "VideoVerificationSession"("status");
CREATE INDEX "VideoVerificationSession_createdAt_idx" ON "VideoVerificationSession"("createdAt");

-- Add foreign key for UserVideoVerification to VideoVerificationSession
ALTER TABLE "UserVideoVerification" 
ADD CONSTRAINT "UserVideoVerification_videoVerificationSessionId_fkey" 
FOREIGN KEY ("videoVerificationSessionId") REFERENCES "VideoVerificationSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
