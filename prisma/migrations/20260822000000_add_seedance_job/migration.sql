-- Seedance scene-video V1 — bytedance/seedance-2.5 via fal.ai
-- Adds SeedanceJob table + two new WebhookEvent enum values so external
-- webhooks can subscribe to scene-video outcomes (mirrors REMIX_*).
-- Keeps its own table because the FAL webhook needs to look up a job by
-- request_id and credit-hold / refund logic must stay self-contained
-- (see also `RemixJob`, `TalkingHeadJob` — same pattern).

-- New WebhookEvent variants (Postgres requires ALTER TYPE ADD per value).
ALTER TYPE "WebhookEvent" ADD VALUE IF NOT EXISTS 'SCENE_COMPLETED';
ALTER TYPE "WebhookEvent" ADD VALUE IF NOT EXISTS 'SCENE_FAILED';

-- CreateEnum
CREATE TYPE "SeedanceJobStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'REFUNDED'
);

CREATE TYPE "SeedanceMode" AS ENUM (
  'REFERENCE_TO_VIDEO',
  'IMAGE_TO_VIDEO'
);

-- CreateTable
CREATE TABLE "SeedanceJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "mode" "SeedanceMode" NOT NULL DEFAULT 'REFERENCE_TO_VIDEO',
    "durationSec" INTEGER NOT NULL,
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "generateAudio" BOOLEAN NOT NULL DEFAULT true,
    "prompt" TEXT NOT NULL,
    "extraPromptTail" TEXT,
    "referenceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creditsHeld" INTEGER NOT NULL DEFAULT 0,
    "status" "SeedanceJobStatus" NOT NULL DEFAULT 'PENDING',
    "falRequestId" TEXT,
    "falModel" TEXT NOT NULL,
    "outputVideoUrl" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SeedanceJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeedanceJob_falRequestId_key" ON "SeedanceJob"("falRequestId");
CREATE INDEX "SeedanceJob_userId_idx" ON "SeedanceJob"("userId");
CREATE INDEX "SeedanceJob_influencerId_idx" ON "SeedanceJob"("influencerId");
CREATE INDEX "SeedanceJob_status_idx" ON "SeedanceJob"("status");
CREATE INDEX "SeedanceJob_userId_status_idx" ON "SeedanceJob"("userId", "status");
CREATE INDEX "SeedanceJob_createdAt_idx" ON "SeedanceJob"("createdAt");
