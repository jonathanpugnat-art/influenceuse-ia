-- TrendItem media + format analysis columns (schema drift fix)

ALTER TABLE "TrendItem"
  ADD COLUMN IF NOT EXISTS "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "mediaKind" TEXT,
  ADD COLUMN IF NOT EXISTS "formatBrief" JSONB,
  ADD COLUMN IF NOT EXISTS "formatAnalyzedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "formatAnalysisModel" TEXT;
