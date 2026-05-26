-- Track OAuth flow per connected account (Instagram Login vs Facebook Login).
ALTER TABLE "SocialAccount" ADD COLUMN IF NOT EXISTS "oauthProvider" TEXT;
