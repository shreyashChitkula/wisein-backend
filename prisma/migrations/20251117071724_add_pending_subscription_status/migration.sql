/*
  Warnings:

  - You are about to drop the column `planId` on the `PaymentOrder` table. All the data in the column will be lost.
  - You are about to drop the column `planName` on the `PaymentOrder` table. All the data in the column will be lost.
  - You are about to drop the column `planType` on the `PaymentOrder` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "PaymentOrder" DROP COLUMN "planId",
DROP COLUMN "planName",
DROP COLUMN "planType";
