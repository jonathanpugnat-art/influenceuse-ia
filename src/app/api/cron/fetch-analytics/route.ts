import { NextRequest, NextResponse } from "next/server";
import { fetchAnalyticsSlice } from "@/server/services/analytics-fetcher.service";

export const maxDuration = 60;

/**
 * Cron endpoint — pulls latest views/likes/comments from Instagram & TikTok
 * for posts that are due for a refresh and persists a ContentAnalytics row.
 *
 * Schedule: hourly (Vercel cron). Each tick processes a slice of up to 25
 * posts to stay within Vercel's 10s budget.
 *
 * Protected by: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[cron/fetch-analytics] CRON_SECRET is not set");
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fetchAnalyticsSlice();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/fetch-analytics] Error:", error);
    return NextResponse.json(
      { error: "Analytics fetch failed", details: String(error) },
      { status: 500 }
    );
  }
}
