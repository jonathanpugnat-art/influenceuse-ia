-- Talking-head V1 — voice fields on Influencer + TalkingHeadJob table.
-- Voice lives on the Character so remix/talking/publish reuse it.

-- Influencer voice columns
ALTER TABLE "Influencer"
  ADD COLUMN "voiceId"         TEXT,
  ADD COLUMN "voiceProvider"   TEXT,
  ADD COLUMN "voiceLabel"      TEXT,
  ADD COLUMN "voiceConsentAt"  TIMESTAMP(3),
  ADD COLUMN "voiceSampleUrl"  TEXT,
  ADD COLUMN "voiceLanguage"   TEXT;

-- MediaAsset flag consumed by the publish flow (synthetic voice disclosure)
ALTER TABLE "MediaAsset"
  ADD COLUMN "isSyntheticSpeech" BOOLEAN NOT NULL DEFAULT false;

-- Enum
CREATE TYPE "TalkingHeadJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REFUNDED'
);

-- TalkingHeadJob table
CREATE TABLE "TalkingHeadJob" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "influencerId"       TEXT NOT NULL,
  "script"             TEXT NOT NULL,
  "voiceId"            TEXT NOT NULL,
  "voiceProvider"      TEXT NOT NULL DEFAULT 'elevenlabs',
  "language"           TEXT NOT NULL DEFAULT 'fr',
  "portraitImageUrl"   TEXT NOT NULL,
  "audioUrl"           TEXT,
  "audioDurationSec"   DOUBLE PRECISION,
  "videoUrl"           TEXT,
  "thumbnailUrl"       TEXT,
  "hedraAudioAssetId"  TEXT,
  "hedraImageAssetId"  TEXT,
  "hedraGenerationId"  TEXT,
  "hedraModelSlug"     TEXT,
  "creditsHeld"        INTEGER NOT NULL DEFAULT 0,
  "status"             "TalkingHeadJobStatus" NOT NULL DEFAULT 'PENDING',
  "error"              TEXT,
  "metadata"           JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  "completedAt"        TIMESTAMP(3),

  CONSTRAINT "TalkingHeadJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TalkingHeadJob_hedraGenerationId_key"
  ON "TalkingHeadJob"("hedraGenerationId");

CREATE INDEX "TalkingHeadJob_userId_idx"          ON "TalkingHeadJob"("userId");
CREATE INDEX "TalkingHeadJob_influencerId_idx"    ON "TalkingHeadJob"("influencerId");
CREATE INDEX "TalkingHeadJob_status_idx"          ON "TalkingHeadJob"("status");
CREATE INDEX "TalkingHeadJob_userId_status_idx"   ON "TalkingHeadJob"("userId", "status");
CREATE INDEX "TalkingHeadJob_status_updatedAt_idx" ON "TalkingHeadJob"("status", "updatedAt");
CREATE INDEX "TalkingHeadJob_createdAt_idx"       ON "TalkingHeadJob"("createdAt");

ALTER TABLE "TalkingHeadJob"
  ADD CONSTRAINT "TalkingHeadJob_influencerId_fkey"
  FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
