UPDATE "characters"
SET "biometric_consent_at" = "created_at"
WHERE "door" = 'clone' AND "biometric_consent_at" IS NULL;-->statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "clone_biometric_consent" CHECK (
  (door = 'builder') OR (biometric_consent_at IS NOT NULL)
);
