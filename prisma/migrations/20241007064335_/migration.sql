/*
  Warnings:

  - You are about to drop the column `refreshToken` on the `SocialMediaAccount` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SocialMediaAccount" DROP COLUMN "refreshToken",
ADD COLUMN     "accessTokenSecret" TEXT;
