/*
  Warnings:

  - A unique constraint covering the columns `[digilockerAccountId]` on the table `UserVerification` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserVerification" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "comparisonResult" JSONB,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "digilockerAccountId" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "nameAsPerAadhaar" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DigiLockerVerificationSession" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userVerificationId" TEXT,
    "mobileNumber" TEXT NOT NULL,
    "digilockerAccountId" TEXT,
    "status" TEXT NOT NULL,
    "flowType" TEXT NOT NULL,
    "consentUrl" TEXT,
    "webhookProvidedMobileNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigiLockerVerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigiLockerVerificationSession_verificationId_key" ON "DigiLockerVerificationSession"("verificationId");

-- CreateIndex
CREATE INDEX "DigiLockerVerificationSession_userId_idx" ON "DigiLockerVerificationSession"("userId");

-- CreateIndex
CREATE INDEX "DigiLockerVerificationSession_verificationId_idx" ON "DigiLockerVerificationSession"("verificationId");

-- CreateIndex
CREATE INDEX "DigiLockerVerificationSession_status_idx" ON "DigiLockerVerificationSession"("status");

-- CreateIndex
CREATE INDEX "DigiLockerVerificationSession_createdAt_idx" ON "DigiLockerVerificationSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserVerification_digilockerAccountId_key" ON "UserVerification"("digilockerAccountId");

-- CreateIndex
CREATE INDEX "UserVerification_digilockerAccountId_idx" ON "UserVerification"("digilockerAccountId");

-- AddForeignKey
ALTER TABLE "DigiLockerVerificationSession" ADD CONSTRAINT "DigiLockerVerificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigiLockerVerificationSession" ADD CONSTRAINT "DigiLockerVerificationSession_userVerificationId_fkey" FOREIGN KEY ("userVerificationId") REFERENCES "UserVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
