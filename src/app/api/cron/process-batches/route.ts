import { NextRequest, NextResponse } from "next/server";
import { processNextBatchSlice } from "@/server/services/batch.service";
import { failStaleGenerations } from "@/server/services/stale-generation.service";
import { failStaleVideoJobs } from "@/server/services/stale-video-job.service";

// The slice budgets 45s of image generation; leave headroom for Replicate retries.
export const maxDuration = 300;

/**
 * Cron endpoint — processes pending DRAFT content from editorial batches
 * created by content.generateContentPlan (Phase 3).
 *
 * Designed to run every minute. Processes a small slice per call so a single
 * function invocation stays well under serverless timeout and Replicate
 * rate-limits, while a long batch (e.g. 30 photos) drains across multiple
 * ticks.
 *
 * Protected by: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[cron/process-batches] CRON_SECRET is not set");
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Watchdog: fail zombie generations (function killed mid-`after()`)
    // so the studio UI stops spinning and shows an actionable error.
    const swept = await failStaleGenerations().catch((err) => {
      console.error("[cron/process-batches] stale sweep failed:", err);
      return { failedContents: 0, failedJobs: 0 };
    });

    // Seedance / Remix: webhook never arrived → refund after 20 min.
    const videoSwept = await failStaleVideoJobs().catch((err) => {
      console.error("[cron/process-batches] stale video sweep failed:", err);
      return { seedance: 0, remix: 0 };
    });

    const result = await processNextBatchSlice();
    return NextResponse.json({
      ok: true,
      ...result,
      staleSwept: swept.failedContents,
      staleVideoSwept: videoSwept.seedance + videoSwept.remix,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/process-batches] Error:", error);
    return NextResponse.json(
      { error: "Batch processing failed", details: String(error) },
      { status: 500 }
    );
  }
}
