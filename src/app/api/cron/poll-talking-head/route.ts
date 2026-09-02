import { NextRequest, NextResponse } from "next/server";
import { pollPendingTalkingHeadJobs } from "@/server/services/talking-head.service";

// One Hedra poll is a fast JSON call plus at most one MP4 mirror to R2 for
// each completed job. 60s is plenty for the 25-job batch the service takes.
export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Cron — advance every PROCESSING TalkingHeadJob.
 *
 * Talking-head V1 does not use webhooks (Hedra's public API is poll-based)
 * so we tick this cron every few minutes. Also runs jobs the user closed
 * their tab on — the shared `pollPendingTalkingHeadJobs` is idempotent
 * and safe to invoke from the tRPC `getJob` query in parallel.
 *
 * Protected by: `Authorization: Bearer <CRON_SECRET>` (same convention as
 * the other crons in this repo).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[cron/poll-talking-head] CRON_SECRET is not set");
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
    const result = await pollPendingTalkingHeadJobs();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/poll-talking-head] Error:", error);
    return NextResponse.json(
      { error: "Talking-head poll failed", details: String(error) },
      { status: 500 }
    );
  }
}
