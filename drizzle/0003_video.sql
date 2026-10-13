-- Ofmia P2 — real video (I2V)
ALTER TYPE "public"."job_kind" ADD VALUE IF NOT EXISTS 'video';
--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');
--> statement-breakpoint
ALTER TYPE "public"."post_source_kind" ADD VALUE IF NOT EXISTS 'post';
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_kind" "media_kind" DEFAULT 'image' NOT NULL;
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "parent_post_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "posts" ADD CONSTRAINT "posts_parent_post_id_posts_id_fk"
    FOREIGN KEY ("parent_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_parent_idx" ON "posts" ("parent_post_id");
--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "job_subject";
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "job_subject" CHECK (
  (kind in ('post', 'video') and post_id is not null)
  or (kind = 'preview' and preview_id is not null)
);
