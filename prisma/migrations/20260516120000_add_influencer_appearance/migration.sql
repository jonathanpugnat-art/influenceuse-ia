-- Sprint 13 — Influencer uniqueness guard
--
-- We persist the random appearance variations + a fingerprint of the full
-- visual identity on every Influencer row. The fingerprint is indexed so a
-- future "duplicate influencer warning" tRPC query can hit it in O(1).
--
-- Backfill: existing rows keep NULL on both columns. The wizard's regenerate
-- button will populate them on the next base-image generation. We don't need
-- a one-shot backfill because the columns are optional and only consumed by
-- new code paths.

ALTER TABLE "Influencer"
  ADD COLUMN "appearanceVariations" JSONB,
  ADD COLUMN "appearanceFingerprint" TEXT;

CREATE INDEX "Influencer_appearanceFingerprint_idx"
  ON "Influencer"("appearanceFingerprint");
