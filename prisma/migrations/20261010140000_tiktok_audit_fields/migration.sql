-- TikTok Content Posting API audit — composer-captured fields
-- Adds the per-publish TikTok settings the composer now collects (interaction
-- toggles, commercial disclosure, post status for polling) so a scheduled
-- publish uses the exact values the user confirmed.
--
-- All columns are NULLABLE with a safe default so backfill is a no-op and
-- existing rows keep behaving like today's SELF_ONLY-only flow.

ALTER TABLE "Content"
  ADD COLUMN "tiktokDisableComment"       BOOLEAN DEFAULT false,
  ADD COLUMN "tiktokDisableDuet"          BOOLEAN DEFAULT false,
  ADD COLUMN "tiktokDisableStitch"        BOOLEAN DEFAULT false,
  ADD COLUMN "tiktokBrandOrganicToggle"   BOOLEAN DEFAULT false,
  ADD COLUMN "tiktokBrandContentToggle"   BOOLEAN DEFAULT false,
  ADD COLUMN "tiktokPostStatus"           TEXT,
  ADD COLUMN "tiktokPostStatusFetchedAt"  TIMESTAMP(3),
  ADD COLUMN "tiktokPostId"               TEXT;
