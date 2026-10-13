export type MetadataDriver = "fs" | "db";
export type BlobDriver = "fs" | "r2";

export type AppEnv = {
  METADATA_DRIVER: MetadataDriver;
  BLOB_DRIVER: BlobDriver;
  NODE_ENV: "development" | "test" | "production";
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_JURISDICTION: "eu" | "default";
  INNGEST_EVENT_KEY?: string;
  INNGEST_SIGNING_KEY?: string;
  REPLICATE_API_TOKEN?: string;
  REPLICATE_WEBHOOK_SIGNING_SECRET?: string;
  APP_BASE_URL?: string;
  SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_POSTHOG_KEY?: string;
  NEXT_PUBLIC_POSTHOG_HOST?: string;
  CREDITS_ENFORCED: boolean;
  BILLING_ENABLED: boolean;
  INITIAL_CREDITS: number;
  PREVIEW_TTL_HOURS: number;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PORTAL_CONFIG_ID?: string;
  STRIPE_STARTER_PRICE_ID?: string;
  STRIPE_PRO_PRICE_ID?: string;
  STRIPE_ENTERPRISE_PRICE_ID?: string;
  STRIPE_PRICE_STARTER?: string;
  STRIPE_PRICE_CREATOR?: string;
  STRIPE_PRICE_AGENCE?: string;
  STRIPE_PRICE_PACK_SMALL?: string;
  STRIPE_PRICE_PACK_MEDIUM?: string;
  STRIPE_PRICE_PACK_LARGE?: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  IDENTITY_SCORING_ENABLED: boolean;
  FACE_EMBED_MODEL?: string;
  IDENTITY_SCORE_PASS: number;
  IDENTITY_SCORE_WARN: number;
  IDENTITY_AUTO_RETRY_MAX: number;
  IDENTITY_REFS_ENABLED: boolean;
  LORA_ENABLED: boolean;
  REPLICATE_LORA_DESTINATION?: string;
  REPLICATE_FAST_FLUX_TRAINER_VERSION?: string;
};

let cached: AppEnv | null = null;

function readString(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  return value && value.length > 0 ? value : undefined;
}

export function getEnv(overrides: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached && overrides === process.env) return cached;

  const metadata = (readString(overrides, "METADATA_DRIVER") ?? "fs") as MetadataDriver;
  const blob = (readString(overrides, "BLOB_DRIVER") ?? "fs") as BlobDriver;
  const nodeEnv = (readString(overrides, "NODE_ENV") ?? "development") as AppEnv["NODE_ENV"];

  if (metadata !== "fs" && metadata !== "db") {
    throw new Error("METADATA_DRIVER doit être fs ou db.");
  }
  if (blob !== "fs" && blob !== "r2") {
    throw new Error("BLOB_DRIVER doit être fs ou r2.");
  }

  const env: AppEnv = {
    METADATA_DRIVER: metadata,
    BLOB_DRIVER: blob,
    NODE_ENV: nodeEnv === "production" || nodeEnv === "test" ? nodeEnv : "development",
    DATABASE_URL: readString(overrides, "DATABASE_URL"),
    DATABASE_URL_UNPOOLED: readString(overrides, "DATABASE_URL_UNPOOLED"),
    R2_ACCOUNT_ID: readString(overrides, "R2_ACCOUNT_ID"),
    R2_ACCESS_KEY_ID: readString(overrides, "R2_ACCESS_KEY_ID"),
    R2_SECRET_ACCESS_KEY: readString(overrides, "R2_SECRET_ACCESS_KEY"),
    R2_BUCKET_NAME: readString(overrides, "R2_BUCKET_NAME"),
    R2_JURISDICTION: readString(overrides, "R2_JURISDICTION") === "default" ? "default" : "eu",
    INNGEST_EVENT_KEY: readString(overrides, "INNGEST_EVENT_KEY"),
    INNGEST_SIGNING_KEY: readString(overrides, "INNGEST_SIGNING_KEY"),
    REPLICATE_API_TOKEN: readString(overrides, "REPLICATE_API_TOKEN"),
    REPLICATE_WEBHOOK_SIGNING_SECRET: readString(overrides, "REPLICATE_WEBHOOK_SIGNING_SECRET"),
    APP_BASE_URL: readString(overrides, "APP_BASE_URL"),
    SENTRY_DSN: readString(overrides, "SENTRY_DSN"),
    NEXT_PUBLIC_SENTRY_DSN: readString(overrides, "NEXT_PUBLIC_SENTRY_DSN"),
    NEXT_PUBLIC_POSTHOG_KEY: readString(overrides, "NEXT_PUBLIC_POSTHOG_KEY"),
    NEXT_PUBLIC_POSTHOG_HOST: readString(overrides, "NEXT_PUBLIC_POSTHOG_HOST"),
    CREDITS_ENFORCED: readString(overrides, "CREDITS_ENFORCED") === "true",
    BILLING_ENABLED: readString(overrides, "BILLING_ENABLED") === "true",
    INITIAL_CREDITS: Number(readString(overrides, "INITIAL_CREDITS") ?? "30"),
    PREVIEW_TTL_HOURS: Number(readString(overrides, "PREVIEW_TTL_HOURS") ?? "48"),
    STRIPE_SECRET_KEY: readString(overrides, "STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: readString(overrides, "STRIPE_WEBHOOK_SECRET"),
    STRIPE_PORTAL_CONFIG_ID: readString(overrides, "STRIPE_PORTAL_CONFIG_ID"),
    STRIPE_STARTER_PRICE_ID: readString(overrides, "STRIPE_STARTER_PRICE_ID"),
    STRIPE_PRO_PRICE_ID: readString(overrides, "STRIPE_PRO_PRICE_ID"),
    STRIPE_ENTERPRISE_PRICE_ID: readString(overrides, "STRIPE_ENTERPRISE_PRICE_ID"),
    STRIPE_PRICE_STARTER: readString(overrides, "STRIPE_PRICE_STARTER"),
    STRIPE_PRICE_CREATOR: readString(overrides, "STRIPE_PRICE_CREATOR"),
    STRIPE_PRICE_AGENCE: readString(overrides, "STRIPE_PRICE_AGENCE"),
    STRIPE_PRICE_PACK_SMALL: readString(overrides, "STRIPE_PRICE_PACK_SMALL"),
    STRIPE_PRICE_PACK_MEDIUM: readString(overrides, "STRIPE_PRICE_PACK_MEDIUM"),
    STRIPE_PRICE_PACK_LARGE: readString(overrides, "STRIPE_PRICE_PACK_LARGE"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: readString(
      overrides,
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ),
    IDENTITY_SCORING_ENABLED: readString(overrides, "IDENTITY_SCORING_ENABLED") === "true",
    FACE_EMBED_MODEL: readString(overrides, "FACE_EMBED_MODEL"),
    IDENTITY_SCORE_PASS: Number(readString(overrides, "IDENTITY_SCORE_PASS") ?? "0.7"),
    IDENTITY_SCORE_WARN: Number(readString(overrides, "IDENTITY_SCORE_WARN") ?? "0.55"),
    IDENTITY_AUTO_RETRY_MAX: Number(readString(overrides, "IDENTITY_AUTO_RETRY_MAX") ?? "1"),
    IDENTITY_REFS_ENABLED: readString(overrides, "IDENTITY_REFS_ENABLED") === "true",
    LORA_ENABLED: readString(overrides, "LORA_ENABLED") === "true",
    REPLICATE_LORA_DESTINATION: readString(overrides, "REPLICATE_LORA_DESTINATION"),
    REPLICATE_FAST_FLUX_TRAINER_VERSION: readString(
      overrides,
      "REPLICATE_FAST_FLUX_TRAINER_VERSION",
    ),
  };

  if (env.IDENTITY_SCORING_ENABLED && !env.FACE_EMBED_MODEL) {
    throw new Error("FACE_EMBED_MODEL requis quand IDENTITY_SCORING_ENABLED=true.");
  }
  if (env.LORA_ENABLED && !env.REPLICATE_LORA_DESTINATION) {
    throw new Error("REPLICATE_LORA_DESTINATION requis quand LORA_ENABLED=true.");
  }
  if (env.LORA_ENABLED && !env.REPLICATE_FAST_FLUX_TRAINER_VERSION) {
    throw new Error("REPLICATE_FAST_FLUX_TRAINER_VERSION requis quand LORA_ENABLED=true.");
  }
  if (
    !(
      env.IDENTITY_SCORE_PASS > 0 &&
      env.IDENTITY_SCORE_PASS <= 1 &&
      env.IDENTITY_SCORE_WARN >= 0 &&
      env.IDENTITY_SCORE_WARN < env.IDENTITY_SCORE_PASS
    )
  ) {
    throw new Error("IDENTITY_SCORE_WARN/PASS invalides (0 ≤ warn < pass ≤ 1).");
  }
  if (
    !Number.isInteger(env.IDENTITY_AUTO_RETRY_MAX) ||
    env.IDENTITY_AUTO_RETRY_MAX < 0 ||
    env.IDENTITY_AUTO_RETRY_MAX > 2
  ) {
    throw new Error("IDENTITY_AUTO_RETRY_MAX doit être 0, 1 ou 2.");
  }

  if (env.NODE_ENV === "production" && (env.METADATA_DRIVER === "fs" || env.BLOB_DRIVER === "fs")) {
    throw new Error("En production METADATA_DRIVER et BLOB_DRIVER doivent être db/r2.");
  }
  if (env.METADATA_DRIVER === "db" && !env.DATABASE_URL) {
    throw new Error("DATABASE_URL requis quand METADATA_DRIVER=db.");
  }
  if (env.BLOB_DRIVER === "r2") {
    const missing = (
      ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const
    ).filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`Variables R2 manquantes: ${missing.join(", ")}`);
    }
  }
  if (env.NODE_ENV === "production" && !env.REPLICATE_WEBHOOK_SIGNING_SECRET) {
    throw new Error("REPLICATE_WEBHOOK_SIGNING_SECRET requis en production.");
  }
  if (env.BILLING_ENABLED) {
    const missing = (["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const).filter(
      (key) => !env[key],
    );
    if (missing.length > 0) {
      throw new Error(`Variables Stripe manquantes (BILLING_ENABLED): ${missing.join(", ")}`);
    }
  }

  if (overrides === process.env) cached = env;
  return env;
}

export function resetEnvCache(): void {
  cached = null;
}
