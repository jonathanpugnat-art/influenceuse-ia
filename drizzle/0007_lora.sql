ALTER TYPE "public"."job_kind" ADD VALUE IF NOT EXISTS 'lora_training';-->statement-breakpoint
CREATE TYPE "public"."lora_status" AS ENUM('queued', 'training', 'validating', 'ready', 'failed', 'deleted');-->statement-breakpoint
CREATE TABLE "character_loras" (
  "id" uuid PRIMARY KEY NOT NULL,
  "character_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "status" "lora_status" DEFAULT 'queued' NOT NULL,
  "trigger_word" text NOT NULL,
  "training_id" text,
  "replicate_version" text,
  "photo_count" integer NOT NULL,
  "validation_score" real,
  "job_id" uuid,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);-->statement-breakpoint
ALTER TABLE "character_loras" ADD CONSTRAINT "character_loras_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "character_loras" ADD CONSTRAINT "character_loras_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "character_loras" ADD CONSTRAINT "character_loras_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;-->statement-breakpoint
CREATE UNIQUE INDEX "character_loras_training_uidx" ON "character_loras" USING btree ("training_id");-->statement-breakpoint
CREATE UNIQUE INDEX "character_loras_active_uq" ON "character_loras" USING btree ("character_id") WHERE status IN ('queued','training','validating','ready');-->statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "lora_enabled" boolean DEFAULT false NOT NULL;-->statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "character_id" uuid;-->statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "job_subject";-->statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "job_subject" CHECK (
  (kind IN ('post', 'video') AND post_id IS NOT NULL)
  OR (kind = 'preview' AND preview_id IS NOT NULL)
  OR (kind = 'lora_training' AND character_id IS NOT NULL)
);
