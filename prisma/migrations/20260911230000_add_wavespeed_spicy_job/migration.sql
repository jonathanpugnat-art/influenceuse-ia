-- NSFW Pro V1 — WaveSpeed Wan 2.2 Spicy I2V
-- Separate table so fal Kling/Seedance SFW jobs never share this path.
-- Credit hold / refund stays self-contained (mirrors SeedanceJob).

ALTER TYPE "WebhookEvent" ADD VALUE IF NOT EXISTS 'NSFW_VIDEO_COMPLETED';
ALTER TYPE "WebhookEvent" ADD VALUE IF NOT EXISTS 'NSFW_VIDEO_FAILED';

ALTER TABLE "Influencer"
  ADD COLUMN "nsfwVideoConsentAt" TIMESTAMP(3);

ALTER TABLE "MediaAsset"
  ADD COLUMN "isSynthetic" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "WavespeedSpicyJobStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'REFUNDED'
);

CREATE TABLE "WavespeedSpicyJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "creditsHeld" INTEGER NOT NULL DEFAULT 0,
    "status" "WavespeedSpicyJobStatus" NOT NULL DEFAULT 'PENDING',
    "wavespeedPredictionId" TEXT,
    "wavespeedModel" TEXT NOT NULL,
    "outputVideoUrl" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "consentAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WavespeedSpicyJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WavespeedSpicyJob_wavespeedPredictionId_key" ON "WavespeedSpicyJob"("wavespeedPredictionId");
CREATE INDEX "WavespeedSpicyJob_userId_idx" ON "WavespeedSpicyJob"("userId");
CREATE INDEX "WavespeedSpicyJob_influencerId_idx" ON "WavespeedSpicyJob"("influencerId");
CREATE INDEX "WavespeedSpicyJob_status_idx" ON "WavespeedSpicyJob"("status");
CREATE INDEX "WavespeedSpicyJob_userId_status_idx" ON "WavespeedSpicyJob"("userId", "status");
CREATE INDEX "WavespeedSpicyJob_createdAt_idx" ON "WavespeedSpicyJob"("createdAt");
