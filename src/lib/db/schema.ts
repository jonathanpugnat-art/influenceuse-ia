import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import type { Niche } from "@/lib/niche";
import type { Reel } from "@/lib/reels";
import type { ImageContentType } from "@/lib/storage-ids";
import type { Traits } from "@/lib/traits";

export const characterDoor = pgEnum("character_door", ["builder", "clone"]);
export const postStatus = pgEnum("post_status", ["pending", "succeeded", "failed"]);
export const postSourceKind = pgEnum("post_source_kind", [
  "format",
  "scene",
  "reel",
  "legacy",
  "post",
]);
export const mediaKind = pgEnum("media_kind", ["image", "video"]);
export const jobKind = pgEnum("job_kind", ["preview", "post", "video", "lora_training"]);
export const faceAngle = pgEnum("face_angle", [
  "front",
  "three_quarter_left",
  "three_quarter_right",
]);
export const faceRefOrigin = pgEnum("face_ref_origin", ["face", "source", "generated"]);
export const loraStatus = pgEnum("lora_status", [
  "queued",
  "training",
  "validating",
  "ready",
  "failed",
  "deleted",
]);
export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "timed_out",
  "canceled",
]);
export const ledgerReason = pgEnum("ledger_reason", [
  "grant",
  "generation_debit",
  "generation_refund",
  "adjustment",
  "stripe_subscription_grant",
  "stripe_pack_grant",
  "stripe_refund_clawback",
  "stripe_dispute_clawback",
]);
export const identityStatus = pgEnum("identity_status", [
  "pending",
  "fidele",
  "proche",
  "derive",
  "non_mesure",
]);

export type StoredImage = {
  key: string;
  contentType: ImageContentType;
};

export type IdentityStatus = (typeof identityStatus.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    stripeCurrentPeriodEnd: timestamp("stripe_current_period_end", { withTimezone: true }),
    stripeSubscriptionSyncedAt: timestamp("stripe_subscription_synced_at", { withTimezone: true }),
    subscriptionStatus: varchar("subscription_status", { length: 20 }),
    plan: varchar("plan", { length: 20 }).default("decouverte").notNull(),
  },
  (table) => [uniqueIndex("users_stripe_customer_uidx").on(table.stripeCustomerId)],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 40 }).notNull(),
    door: characterDoor("door").notNull(),
    traits: jsonb("traits").$type<Traits>(),
    faceKey: text("face_key").notNull(),
    faceContentType: text("face_content_type").$type<ImageContentType>().notNull(),
    sources: jsonb("sources").$type<StoredImage[]>().default([]).notNull(),
    niche: jsonb("niche").$type<Niche>(),
    identityEmbedding: jsonb("identity_embedding").$type<number[]>(),
    identityModel: text("identity_model"),
    identityUpdatedAt: timestamp("identity_updated_at", { withTimezone: true }),
    biometricConsentAt: timestamp("biometric_consent_at", { withTimezone: true }),
    loraEnabled: boolean("lora_enabled").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("characters_owner_created_idx").on(table.ownerId, table.createdAt),
    check("door_traits", sql`(door = 'builder') = (traits is not null)`),
    check(
      "clone_biometric_consent",
      sql`(door = 'builder') or (biometric_consent_at is not null)`,
    ),
  ],
);

export const previews = pgTable(
  "previews",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    traits: jsonb("traits").$type<Traits>().notNull(),
    imageKey: text("image_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("previews_owner_idx").on(table.ownerId),
    index("previews_expires_idx").on(table.expiresAt),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: postStatus("status").default("pending").notNull(),
    mediaKind: mediaKind("media_kind").default("image").notNull(),
    imageKey: text("image_key"),
    contentType: text("content_type").default("image/jpeg").notNull(),
    parentPostId: uuid("parent_post_id"),
    sourceKind: postSourceKind("source_kind").notNull(),
    sourceRef: text("source_ref").notNull(),
    sourceLabel: text("source_label").notNull(),
    prompt: text("prompt").notNull(),
    caption: text("caption"),
    identityScore: real("identity_score"),
    identityStatus: identityStatus("identity_status").default("pending").notNull(),
    identityModel: text("identity_model"),
    generationAttempts: integer("generation_attempts").default(1).notNull(),
    regenOfPostId: uuid("regen_of_post_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("posts_owner_status_idx").on(table.ownerId, table.status),
    index("posts_character_created_idx").on(table.characterId, table.createdAt),
    index("posts_parent_idx").on(table.parentPostId),
    index("posts_identity_idx").on(table.ownerId, table.identityStatus, table.completedAt),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: jobKind("kind").notNull(),
    status: jobStatus("status").default("queued").notNull(),
    previewId: uuid("preview_id").references(() => previews.id, { onDelete: "set null" }),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    characterId: uuid("character_id").references(() => characters.id, { onDelete: "cascade" }),
    provider: text("provider").default("replicate").notNull(),
    model: text("model").notNull(),
    predictionId: text("prediction_id").unique(),
    attempts: integer("attempts").default(0).notNull(),
    errorCode: text("error_code"),
    errorMessage: varchar("error_message", { length: 500 }),
    inngestRunId: text("inngest_run_id"),
    providerMetrics: jsonb("provider_metrics").$type<{ predictTime?: number }>(),
    queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    providerCompletedAt: timestamp("provider_completed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("jobs_owner_queued_idx").on(table.ownerId, table.queuedAt),
    index("jobs_p95_idx").on(table.kind, table.status, table.completedAt),
    check(
      "job_subject",
      sql`(kind in ('post', 'video') and post_id is not null) or (kind = 'preview' and preview_id is not null) or (kind = 'lora_training' and character_id is not null)`,
    ),
  ],
);

export const faceRefs = pgTable(
  "face_refs",
  {
    id: uuid("id").primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    angle: faceAngle("angle").notNull(),
    key: text("key").notNull(),
    contentType: text("content_type").$type<ImageContentType>().notNull(),
    origin: faceRefOrigin("origin").notNull(),
    embedding: jsonb("embedding").$type<number[]>(),
    score: real("score"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("face_refs_character_angle_uq").on(table.characterId, table.angle),
  ],
);

export const characterLoras = pgTable(
  "character_loras",
  {
    id: uuid("id").primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: loraStatus("status").default("queued").notNull(),
    triggerWord: text("trigger_word").notNull(),
    trainingId: text("training_id"),
    replicateVersion: text("replicate_version"),
    photoCount: integer("photo_count").notNull(),
    validationScore: real("validation_score"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("character_loras_training_uidx").on(table.trainingId),
    uniqueIndex("character_loras_active_uq")
      .on(table.characterId)
      .where(sql`status IN ('queued','training','validating','ready')`),
  ],
);

export const creditsLedger = pgTable(
  "credits_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: ledgerReason("reason").notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    stripeRef: text("stripe_ref"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("credits_user_idx").on(table.userId),
    index("credits_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const trends = pgTable("trends", {
  hashtag: varchar("hashtag", { length: 40 }).primaryKey(),
  reels: jsonb("reels").$type<Reel[]>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  fetchedBy: text("fetched_by").references(() => users.id, { onDelete: "set null" }),
});
