import { NextRequest, NextResponse } from "next/server";
import {
  analyzeTopTrendsFormat,
  refreshTrendItemsFeedTtl,
  runTrendsFetch,
} from "@/server/services/trends.service";

/**
 * v0.12 — Daily cron that refreshes the trends cache.
 *
 * Schedule (configured in `vercel.json`): once a day. The service-level
 * cache (`TREND_FETCH_TTL_HOURS`) makes it safe to call more often without
 * burning provider quota.
 *
 * Protected by `Authorization: Bearer <CRON_SECRET>` like the other crons.
 * If `TRENDS_PROVIDER` / `APIFY_TOKEN` / `TRENDS_HTTP_URL` are not set, the
 * cron returns `{ ok: true, skipped: "no-provider-configured" }` — no error.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.trim() === "") {
    console.error("[cron/fetch-trends] CRON_SECRET is not set");
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Set it in your environment." },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional manual overrides via query params (helpful for debugging /
  // for the "Refresh now" admin button to bypass the 24h cache).
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const region = url.searchParams.get("region") ?? undefined;
  const locale = url.searchParams.get("locale") ?? undefined;
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? Math.max(1, Math.min(200, Number(limitStr))) : undefined;

  try {
    const result = await runTrendsFetch({ force, region, locale, limit });
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/fetch-trends] Provider error, trying TTL refresh:", message);

    // P0 — Apify quota / transient failures: keep the product usable by
    // re-publishing existing TrendItems into the 72h feed window.
    try {
      const ttl = await refreshTrendItemsFeedTtl({ limit: 120 });
      let formatsAnalyzed = 0;
      if (ttl.itemsRefreshed > 0) {
        formatsAnalyzed = await analyzeTopTrendsFormat(6);
      }
      return NextResponse.json({
        ok: true,
        provider: process.env.TRENDS_PROVIDER ?? "unknown",
        snapshotsCreated: 0,
        itemsCreated: 0,
        itemsRefreshed: ttl.itemsRefreshed,
        formatsAnalyzed,
        skipped: `provider-error-ttl-fallback: ${message}`,
        timestamp: new Date().toISOString(),
      });
    } catch (fallbackError) {
      console.error("[cron/fetch-trends] TTL fallback failed:", fallbackError);
      return NextResponse.json(
        { ok: false, error: message },
        { status: 500 }
      );
    }
  }
}
