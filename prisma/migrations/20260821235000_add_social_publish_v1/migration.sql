-- Social Publish V1 : IG Reels + TikTok Direct Post
-- ─────────────────────────────────────────────────
-- SocialAccount gains:
--   - scopes[]         : OAuth scopes granted by the user
--   - privacyOptions   : TikTok creator_info privacy_level_options snapshot
-- Content gains publish-time metadata:
--   - isAiGenerated    : true always (V1 forces is_ai_generated / is_aigc)
--   - firstComment     : optional first comment posted after IG publish
--   - shareToFeed      : IG Reels feed mirror flag
--   - tiktokPrivacyLevel: SELF_ONLY / MUTUAL_FOLLOW_FRIENDS / PUBLIC_TO_EVERYONE
--   - igMediaId        : Meta media id returned by /media_publish
--   - tiktokPublishId  : TikTok Direct Post publish_id

ALTER TABLE "SocialAccount"
  ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "privacyOptions" JSONB;

ALTER TABLE "Content"
  ADD COLUMN "isAiGenerated" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "firstComment" TEXT,
  ADD COLUMN "shareToFeed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tiktokPrivacyLevel" TEXT,
  ADD COLUMN "igMediaId" TEXT,
  ADD COLUMN "tiktokPublishId" TEXT;
