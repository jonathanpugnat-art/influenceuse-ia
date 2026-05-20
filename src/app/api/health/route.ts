import { NextResponse } from "next/server";
import { db } from "@/server/db";

/**
 * Auto-publish readiness: the publication pipeline (cron + OAuth + APIs) is
 * deeply tested, but it silently no-ops in production if the required env
 * vars are missing. This block surfaces "which platform is actually ready
 * to ship" so uptime monitors and the admin dashboard catch misconfigs
 * before users do.
 */
function getAutoPublishReadiness() {
  const instagram = Boolean(
    (process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID) &&
      (process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET)
  );
  const tiktok = Boolean(
    process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET
  );
  const cron = Boolean(
    process.env.CRON_SECRET && process.env.CRON_SECRET.trim() !== ""
  );
  const encryption = Boolean(
    process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.length >= 32
  );

    const replicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim());
    const r2 =
      Boolean(process.env.R2_ACCOUNT_ID) &&
      Boolean(process.env.R2_ACCESS_KEY_ID) &&
      Boolean(process.env.R2_SECRET_ACCESS_KEY);
    const r2Public = Boolean(process.env.R2_PUBLIC_URL?.trim());

    return {
      cron,
      encryption,
      replicate,
      storage: { r2, r2Public },
      platforms: {
        instagram,
        tiktok,
        onlyfans: r2 || !process.env.VERCEL,
      },
      ready: cron && encryption && replicate && (r2Public || !process.env.VERCEL),
    };
}

/**
 * GET /api/health
 *
 * Liveness + readiness probe used by uptime monitors (Vercel, BetterStack…).
 * Returns 200 only if the DB is reachable. Lightweight query (`SELECT 1`).
 *
 * Also exposes an `autoPublish` block that surfaces the readiness of the
 * publication pipeline (cron secret, encryption secret, Instagram/TikTok
 * OAuth credentials). When any of these is missing, the scheduled-content
 * flow silently breaks — we want it visible to monitoring, not to users.
 */
export async function GET() {
  const startedAt = Date.now();
  const autoPublish = getAutoPublishReadiness();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.9.0",
        autoPublish,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return NextResponse.json(
      {
        status: "error",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        error: "database_unreachable",
        autoPublish,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
