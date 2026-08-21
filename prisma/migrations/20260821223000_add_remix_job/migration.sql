-- Viral Remix V1 — Kling O3 Omni V2V + elements
-- Adds RemixJob table and two new WebhookEvent enum values so external
-- webhooks (Zapier, n8n…) can subscribe to remix outcomes just like
-- CONTENT_PUBLISHED / CONTENT_FAILED.

-- New WebhookEvent variants (Postgres requires ALTER TYPE ADD per value).
ALTER TYPE "WebhookEvent" ADD VALUE IF NOT EXISTS 'REMIX_COMPLETED';
ALTER TYPE "WebhookEvent" ADD VALUE IF NOT EXISTS 'REMIX_FAILED';

-- CreateEnum
CREATE TYPE "RemixJobStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'REFUNDED'
);

-- CreateTable
CREATE TABLE "RemixJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'standard',
    "durationSec" INTEGER NOT NULL,
    "sourceDurationSec" DOUBLE PRECISION,
    "sourceVideoUrl" TEXT NOT NULL,
    "frontalImageUrl" TEXT NOT NULL,
    "referenceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keepAudio" BOOLEAN NOT NULL DEFAULT true,
    "prompt" TEXT NOT NULL,
    "creditsHeld" INTEGER NOT NULL DEFAULT 0,
    "status" "RemixJobStatus" NOT NULL DEFAULT 'PENDING',
    "falRequestId" TEXT,
    "falModel" TEXT NOT NULL,
    "oembedPreview" JSONB,
    "outputVideoUrl" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RemixJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RemixJob_falRequestId_key" ON "RemixJob"("falRequestId");
CREATE INDEX "RemixJob_userId_idx" ON "RemixJob"("userId");
CREATE INDEX "RemixJob_influencerId_idx" ON "RemixJob"("influencerId");
CREATE INDEX "RemixJob_status_idx" ON "RemixJob"("status");
CREATE INDEX "RemixJob_userId_status_idx" ON "RemixJob"("userId", "status");
CREATE INDEX "RemixJob_createdAt_idx" ON "RemixJob"("createdAt");
