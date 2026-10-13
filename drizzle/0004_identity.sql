CREATE TYPE "public"."identity_status" AS ENUM('pending', 'fidele', 'proche', 'derive', 'non_mesure');-->statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "identity_embedding" jsonb;-->statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "identity_model" text;-->statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "identity_updated_at" timestamp with time zone;-->statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "biometric_consent_at" timestamp with time zone;-->statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "identity_score" real;-->statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "identity_status" "identity_status" DEFAULT 'pending' NOT NULL;-->statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "identity_model" text;-->statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "generation_attempts" integer DEFAULT 1 NOT NULL;-->statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "regen_of_post_id" uuid;-->statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_regen_of_post_id_posts_id_fk" FOREIGN KEY ("regen_of_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;-->statement-breakpoint
CREATE INDEX "posts_identity_idx" ON "posts" USING btree ("owner_id","identity_status","completed_at");
