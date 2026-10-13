CREATE TYPE "public"."face_angle" AS ENUM('front', 'three_quarter_left', 'three_quarter_right');-->statement-breakpoint
CREATE TYPE "public"."face_ref_origin" AS ENUM('face', 'source', 'generated');-->statement-breakpoint
CREATE TABLE "face_refs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "character_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "angle" "face_angle" NOT NULL,
  "key" text NOT NULL,
  "content_type" text NOT NULL,
  "origin" "face_ref_origin" NOT NULL,
  "embedding" jsonb,
  "score" real,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);-->statement-breakpoint
ALTER TABLE "face_refs" ADD CONSTRAINT "face_refs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "face_refs" ADD CONSTRAINT "face_refs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
CREATE UNIQUE INDEX "face_refs_character_angle_uq" ON "face_refs" USING btree ("character_id","angle");
