import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  failSeedanceJob,
  finalizeSeedanceJob,
  reconcileSeedanceJob,
  verifySeedanceWebhookSecret,
} from "@/server/services/seedance.service";
import { extractFalVideoUrl } from "@/server/services/video-providers/fal-kling-i2v.provider";

// A Seedance 30s render is ~60-180s. We cap the webhook handler below
// Vercel's serverless budget; `falQueueCheck` handles its own timeouts
// when we reconcile.
export const maxDuration = 60;

/**
 * FAL webhook receiver for Seedance scene-video jobs.
 *
 * Payload shape varies between models (some send the full result, some
 * only a status ping). We:
 *   1. Verify our per-app shared secret.
 *   2. Look up the job by ?job=<id>.
 *   3. Try to extract the video URL directly from the payload.
 *   4. Fall back to `reconcileSeedanceJob` which re-queries FAL when the
 *      payload is ambiguous.
 *
 * All branches are idempotent — a duplicate delivery never double-charges
 * or double-emits `SCENE_COMPLETED`.
 */
export async function POST(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("job");
  const secret = req.nextUrl.searchParams.get("secret");

  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }
  if (!verifySeedanceWebhookSecret(secret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const job = await db.seedanceJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = parseFalPayload(body);

  if (parsed.status === "COMPLETED" && parsed.videoUrl) {
    await finalizeSeedanceJob(job.id, {
      videoUrl: parsed.videoUrl,
      rawPayload: body,
    });
    return NextResponse.json({ received: true, status: "COMPLETED" });
  }

  if (parsed.status === "FAILED") {
    await failSeedanceJob(
      job.id,
      parsed.error ?? "FAL reported a failed Seedance render."
    );
    return NextResponse.json({ received: true, status: "FAILED" });
  }

  // Ambiguous payload (status-only ping, unknown shape) — re-query FAL.
  await reconcileSeedanceJob(job.id);
  return NextResponse.json({ received: true, status: "RECONCILED" });
}

interface ParsedFalPayload {
  status: "COMPLETED" | "FAILED" | "UNKNOWN";
  videoUrl?: string | null;
  error?: string;
}

function parseFalPayload(body: unknown): ParsedFalPayload {
  if (!body || typeof body !== "object") return { status: "UNKNOWN" };
  const b = body as Record<string, unknown>;

  const status = typeof b.status === "string" ? b.status.toUpperCase() : null;
  if (status === "ERROR" || status === "FAILED") {
    return {
      status: "FAILED",
      error:
        typeof b.error === "string"
          ? b.error
          : typeof b.detail === "string"
            ? b.detail
            : "unknown FAL error",
    };
  }

  const videoFromRoot = extractFalVideoUrl(b);
  if (videoFromRoot) {
    return { status: "COMPLETED", videoUrl: videoFromRoot };
  }
  const nested = b.payload;
  if (nested && typeof nested === "object") {
    const videoFromNested = extractFalVideoUrl(nested);
    if (videoFromNested) {
      return { status: "COMPLETED", videoUrl: videoFromNested };
    }
  }

  if (status === "OK" || status === "COMPLETED") {
    return { status: "UNKNOWN" };
  }
  return { status: "UNKNOWN" };
}
