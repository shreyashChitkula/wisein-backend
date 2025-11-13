-- CreateTable
CREATE TABLE "UserVideoVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoVerificationSessionId" TEXT,
    "videoUrl" TEXT,
    "videoSize" INTEGER,
    "videoDuration" INTEGER,
    "videoFormat" TEXT,
    "faceDetected" BOOLEAN NOT NULL DEFAULT false,
    "livenessScore" DOUBLE PRECISION,
    "faceMatchScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "comparisonResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVideoVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoVerificationSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "recordingUrl" TEXT,
    "recordingDuration" INTEGER,
    "serverSideUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoVerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserVideoVerification_userId_key" ON "UserVideoVerification"("userId");

-- CreateIndex
CREATE INDEX "UserVideoVerification_userId_idx" ON "UserVideoVerification"("userId");

-- CreateIndex
CREATE INDEX "UserVideoVerification_status_idx" ON "UserVideoVerification"("status");

-- CreateIndex
CREATE INDEX "UserVideoVerification_verified_idx" ON "UserVideoVerification"("verified");

-- CreateIndex
CREATE INDEX "UserVideoVerification_createdAt_idx" ON "UserVideoVerification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoVerificationSession_sessionId_key" ON "VideoVerificationSession"("sessionId");

-- CreateIndex
CREATE INDEX "VideoVerificationSession_userId_idx" ON "VideoVerificationSession"("userId");

-- CreateIndex
CREATE INDEX "VideoVerificationSession_sessionId_idx" ON "VideoVerificationSession"("sessionId");

-- CreateIndex
CREATE INDEX "VideoVerificationSession_status_idx" ON "VideoVerificationSession"("status");

-- CreateIndex
CREATE INDEX "VideoVerificationSession_createdAt_idx" ON "VideoVerificationSession"("createdAt");

-- AddForeignKey
ALTER TABLE "UserVideoVerification" ADD CONSTRAINT "UserVideoVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVideoVerification" ADD CONSTRAINT "UserVideoVerification_videoVerificationSessionId_fkey" FOREIGN KEY ("videoVerificationSessionId") REFERENCES "VideoVerificationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoVerificationSession" ADD CONSTRAINT "VideoVerificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
