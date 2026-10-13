-- Ofmia P1 — ledger hardening + Stripe audit + plan rename
ALTER TYPE "public"."ledger_reason" ADD VALUE IF NOT EXISTS 'stripe_refund_clawback';
--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE IF NOT EXISTS 'stripe_dispute_clawback';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" varchar(20);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_synced_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "credits_ledger" ADD COLUMN IF NOT EXISTS "stripe_ref" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credits_user_created_idx" ON "credits_ledger" ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone
);
--> statement-breakpoint
UPDATE "users" SET "plan" = 'decouverte' WHERE "plan" = 'free';
--> statement-breakpoint
UPDATE "users" SET "plan" = 'creator' WHERE "plan" = 'pro';
--> statement-breakpoint
UPDATE "users" SET "plan" = 'agence' WHERE "plan" = 'enterprise';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'decouverte';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION credits_ledger_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.job_id IS NULL
     AND OLD.job_id IS NOT NULL
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.delta IS NOT DISTINCT FROM OLD.delta
     AND NEW.reason IS NOT DISTINCT FROM OLD.reason
     AND NEW.idempotency_key IS NOT DISTINCT FROM OLD.idempotency_key
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.stripe_ref IS NOT DISTINCT FROM OLD.stripe_ref
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'credits_ledger is immutable';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS credits_ledger_immutable_trg ON "credits_ledger";
--> statement-breakpoint
CREATE TRIGGER credits_ledger_immutable_trg
  BEFORE UPDATE ON "credits_ledger"
  FOR EACH ROW
  EXECUTE FUNCTION credits_ledger_immutable();
