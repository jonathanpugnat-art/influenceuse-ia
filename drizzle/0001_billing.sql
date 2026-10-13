-- Ofmia P1 — Stripe billing columns + ledger reasons
ALTER TYPE "public"."ledger_reason" ADD VALUE IF NOT EXISTS 'stripe_subscription_grant';
--> statement-breakpoint
ALTER TYPE "public"."ledger_reason" ADD VALUE IF NOT EXISTS 'stripe_pack_grant';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_current_period_end" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" varchar(20) DEFAULT 'free' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_uidx" ON "users" ("stripe_customer_id");
