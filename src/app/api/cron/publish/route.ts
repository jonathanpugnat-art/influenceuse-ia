import { NextRequest, NextResponse } from "next/server";
import { checkAndPublish } from "@/server/services/scheduler.service";

// IG Reels publishing polls Meta up to ~60s per reel; leave headroom.
export const maxDuration = 300;

/**
 * Cron endpoint — called every minute by Vercel Cron or external scheduler.
 * Checks for SCHEDULED content and publishes them.
 *
 * Protected by: Authorization: Bearer <CRON_SECRET>
 * CRON_SECRET is required; requests without a valid Bearer token are rejected.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[cron/publish] CRON_SECRET is not set");
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Set it in your environment." },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkAndPublish();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/publish] Error:", error);
    return NextResponse.json(
      { error: "Scheduler failed", details: String(error) },
      { status: 500 }
    );
  }
}
