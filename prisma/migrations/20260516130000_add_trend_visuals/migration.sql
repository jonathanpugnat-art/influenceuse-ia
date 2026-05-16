-- Sprint 13.2 — Real visual previews on Trend cards
--
-- Adds 4 new optional columns to TrendItem so the UI can render a real
-- thumbnail + optional embed instead of pure text. All NULL on existing
-- rows; the next cron run (curated provider) will repopulate them.
--
-- - thumbnailUrl: hero image of the card (Unsplash for curated, real
--   creator thumbnail for Apify when available)
-- - thumbnailUrlAlt: optional 2nd image for hover-swap effect
-- - embedUrl: TikTok / Instagram canonical post URL we can iframe-embed
-- - authorHandle: "@username" for attribution (mostly populated by Apify)

ALTER TABLE "TrendItem"
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "thumbnailUrlAlt" TEXT,
  ADD COLUMN "embedUrl" TEXT,
  ADD COLUMN "authorHandle" TEXT;
