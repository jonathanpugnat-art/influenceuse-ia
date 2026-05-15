-- v0.12 — Trends intelligence (TikTok / Instagram)
--
-- Adds three tables:
--   * TrendSnapshot — raw provider payload, deduped by content hash.
--   * TrendItem    — normalized feed item (one row per trend card).
--   * TrendRecommendation — per-influencer LLM personalization.
--
-- See `prisma/schema.prisma` for field-level comments.

-- ──────────────────────────────────────────────
-- TrendSnapshot
-- ──────────────────────────────────────────────
CREATE TABLE "TrendSnapshot" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "region" TEXT,
    "locale" TEXT,
    "provider" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrendSnapshot_provider_platform_contentHash_key"
    ON "TrendSnapshot"("provider", "platform", "contentHash");
CREATE INDEX "TrendSnapshot_platform_fetchedAt_idx"
    ON "TrendSnapshot"("platform", "fetchedAt");
CREATE INDEX "TrendSnapshot_fetchedAt_idx"
    ON "TrendSnapshot"("fetchedAt");

-- ──────────────────────────────────────────────
-- TrendItem
-- ──────────────────────────────────────────────
CREATE TABLE "TrendItem" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hashtags" TEXT[],
    "soundName" TEXT,
    "growthScore" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "nicheTags" TEXT[],
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "region" TEXT,
    "expiresAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrendItem_platform_idx" ON "TrendItem"("platform");
CREATE INDEX "TrendItem_fetchedAt_idx" ON "TrendItem"("fetchedAt");
CREATE INDEX "TrendItem_platform_isNsfw_fetchedAt_idx"
    ON "TrendItem"("platform", "isNsfw", "fetchedAt");
CREATE INDEX "TrendItem_snapshotId_idx" ON "TrendItem"("snapshotId");

ALTER TABLE "TrendItem" ADD CONSTRAINT "TrendItem_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "TrendSnapshot"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- TrendRecommendation
-- ──────────────────────────────────────────────
CREATE TABLE "TrendRecommendation" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "trendItemId" TEXT NOT NULL,
    "generatedHook" TEXT NOT NULL,
    "generatedFields" JSONB NOT NULL,
    "llmModel" TEXT NOT NULL,
    "userDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrendRecommendation_influencerId_trendItemId_key"
    ON "TrendRecommendation"("influencerId", "trendItemId");
CREATE INDEX "TrendRecommendation_influencerId_idx"
    ON "TrendRecommendation"("influencerId");
CREATE INDEX "TrendRecommendation_influencerId_userDismissed_idx"
    ON "TrendRecommendation"("influencerId", "userDismissed");
CREATE INDEX "TrendRecommendation_createdAt_idx"
    ON "TrendRecommendation"("createdAt");

ALTER TABLE "TrendRecommendation" ADD CONSTRAINT "TrendRecommendation_influencerId_fkey"
    FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrendRecommendation" ADD CONSTRAINT "TrendRecommendation_trendItemId_fkey"
    FOREIGN KEY ("trendItemId") REFERENCES "TrendItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
