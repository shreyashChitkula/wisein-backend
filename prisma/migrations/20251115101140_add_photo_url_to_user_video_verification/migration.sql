/*
  Warnings:

  - You are about to drop the column `comparisonResult` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the column `faceDetected` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the column `faceMatchScore` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the column `livenessScore` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the column `videoDuration` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the column `videoFormat` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the column `videoSize` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the column `videoVerificationSessionId` on the `UserVideoVerification` table. All the data in the column will be lost.
  - You are about to drop the `VideoVerificationSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserVideoVerification" DROP CONSTRAINT "UserVideoVerification_videoVerificationSessionId_fkey";

-- DropForeignKey
ALTER TABLE "VideoVerificationSession" DROP CONSTRAINT "VideoVerificationSession_userId_fkey";

-- DropIndex
DROP INDEX "UserVideoVerification_verified_idx";

-- AlterTable
ALTER TABLE "UserVideoVerification" DROP COLUMN "comparisonResult",
DROP COLUMN "faceDetected",
DROP COLUMN "faceMatchScore",
DROP COLUMN "livenessScore",
DROP COLUMN "videoDuration",
DROP COLUMN "videoFormat",
DROP COLUMN "videoSize",
DROP COLUMN "videoVerificationSessionId",
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- DropTable
DROP TABLE "VideoVerificationSession";
