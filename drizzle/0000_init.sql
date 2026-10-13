-- Ofmia P0 initial schema (Neon EU)
CREATE TYPE "public"."character_door" AS ENUM('builder', 'clone');
CREATE TYPE "public"."post_status" AS ENUM('pending', 'succeeded', 'failed');
CREATE TYPE "public"."post_source_kind" AS ENUM('format', 'scene', 'reel', 'legacy');
CREATE TYPE "public"."job_kind" AS ENUM('preview', 'post');
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'timed_out', 'canceled');
CREATE TYPE "public"."ledger_reason" AS ENUM('grant', 'generation_debit', 'generation_refund', 'adjustment');

CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE "characters" (
  "id" uuid PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL,
  "name" varchar(40) NOT NULL,
  "door" "character_door" NOT NULL,
  "traits" jsonb,
  "face_key" text NOT NULL,
  "face_content_type" text NOT NULL,
  "sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "niche" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "previews" (
  "id" uuid PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL,
  "traits" jsonb NOT NULL,
  "image_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE "posts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "character_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "status" "post_status" DEFAULT 'pending' NOT NULL,
  "image_key" text,
  "content_type" text DEFAULT 'image/jpeg' NOT NULL,
  "source_kind" "post_source_kind" NOT NULL,
  "source_ref" text NOT NULL,
  "source_label" text NOT NULL,
  "prompt" text NOT NULL,
  "caption" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL,
  "kind" "job_kind" NOT NULL,
  "status" "job_status" DEFAULT 'queued' NOT NULL,
  "preview_id" uuid,
  "post_id" uuid,
  "provider" text DEFAULT 'replicate' NOT NULL,
  "model" text NOT NULL,
  "prediction_id" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error_code" text,
  "error_message" varchar(500),
  "inngest_run_id" text,
  "provider_metrics" jsonb,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "provider_completed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer
);

CREATE TABLE "credits_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "delta" integer NOT NULL,
  "reason" "ledger_reason" NOT NULL,
  "job_id" uuid,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "credits_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE "trends" (
  "hashtag" varchar(40) PRIMARY KEY NOT NULL,
  "reels" jsonb NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL,
  "fetched_by" text
);

ALTER TABLE "characters" ADD CONSTRAINT "characters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "previews" ADD CONSTRAINT "previews_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT "posts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT "posts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_preview_id_previews_id_fk" FOREIGN KEY ("preview_id") REFERENCES "public"."previews"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "trends" ADD CONSTRAINT "trends_fetched_by_users_id_fk" FOREIGN KEY ("fetched_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_prediction_id_unique" UNIQUE("prediction_id");
ALTER TABLE "characters" ADD CONSTRAINT "door_traits" CHECK ((door = 'builder') = (traits is not null));
ALTER TABLE "jobs" ADD CONSTRAINT "job_subject" CHECK ((kind = 'post' and post_id is not null) or (kind = 'preview' and preview_id is not null));

CREATE INDEX "characters_owner_created_idx" ON "characters" USING btree ("owner_id","created_at");
CREATE INDEX "previews_owner_idx" ON "previews" USING btree ("owner_id");
CREATE INDEX "previews_expires_idx" ON "previews" USING btree ("expires_at");
CREATE INDEX "posts_owner_status_idx" ON "posts" USING btree ("owner_id","status");
CREATE INDEX "posts_character_created_idx" ON "posts" USING btree ("character_id","created_at");
CREATE INDEX "jobs_owner_queued_idx" ON "jobs" USING btree ("owner_id","queued_at");
CREATE INDEX "jobs_p95_idx" ON "jobs" USING btree ("kind","status","completed_at");
CREATE INDEX "credits_user_idx" ON "credits_ledger" USING btree ("user_id");
