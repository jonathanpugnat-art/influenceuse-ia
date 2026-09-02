import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  failRemixJob,
  finalizeRemixJob,
  reconcileRemixJob,
  verifyRemixWebhookSecret,
} from "@/server/services/remix.service";
import { extractFalVideoUrl } from "@/server/services/video-providers/fal-kling-i2v.provider";

// A Kling remix render is ~30-90s; we cap the webhook handler well below
// Vercel's serverless budget so a stalled fetch can't hold the connection
// open indefinitely (falQueueCheck itself already handles its own timeouts).
export const maxDuration = 60;

/**
 * FAL webhook receiver.
 *
 * FAL POSTs a JSON body when a queued job completes. The exact payload
 * shape can vary between models (some send the full result, some only a
 * status ping with the request_id), so we:
 *   1. Verify our per-app shared secret in the query string.
 *   2. Look up the job by ?job=<id>.
 *   3. Try to extract the video URL directly from the payload.
 *   4. Fall back to `reconcileRemixJob` which re-queries FAL if the
 *      payload only tells us the state.
 *
 * All branches are idempotent — a duplicate delivery never double-charges
 * or double-emits `REMIX_COMPLETED`.
 */
export async function POST(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("job");
  const secret = req.nextUrl.searchParams.get("secret");

  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }
  if (!verifyRemixWebhookSecret(secret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const job = await db.remixJob.findUnique({ where: { id: jobId } });
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
    await finalizeRemixJob(job.id, {
      videoUrl: parsed.videoUrl,
      rawPayload: body,
    });
    return NextResponse.json({ received: true, status: "COMPLETED" });
  }

  if (parsed.status === "FAILED") {
    await failRemixJob(
      job.id,
      parsed.error ?? "FAL reported a failed remix render."
    );
    return NextResponse.json({ received: true, status: "FAILED" });
  }

  // Ambiguous payload (status-only ping, unknown shape) — re-query FAL.
  await reconcileRemixJob(job.id);
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
  // Nested payload — some FAL webhooks wrap the model output in `payload`.
  const nested = b.payload;
  if (nested && typeof nested === "object") {
    const videoFromNested = extractFalVideoUrl(nested);
    if (videoFromNested) {
      return { status: "COMPLETED", videoUrl: videoFromNested };
    }
  }

  if (status === "OK" || status === "COMPLETED") {
    // Payload says done but we couldn't find a URL — force a reconcile
    // by returning UNKNOWN.
    return { status: "UNKNOWN" };
  }
  return { status: "UNKNOWN" };
}
