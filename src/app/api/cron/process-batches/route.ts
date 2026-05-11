import { NextRequest, NextResponse } from "next/server";
import { processNextBatchSlice } from "@/server/services/batch.service";

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
    const result = await processNextBatchSlice();
    return NextResponse.json({
      ok: true,
      ...result,
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
