import { db } from "@/server/db";
import { resolveTrendsProvider } from "../providers/trend-provider";
import { TREND_FETCH_TTL_HOURS, TRENDS_AUTO_ANALYZE_LIMIT } from "../constants";
import { analyzeTopTrendsFormat } from "../analysis/format-analysis";
import { mirrorFreshTrendThumbnails } from "@/server/services/trend-thumbnail-storage.service";
import { persistRawTrends } from "./persist-raw-trends";
import type { CronRunResult } from "./cron-types";

export type { CronRunResult } from "./cron-types";

/**
 * Cron handler entry point. Pulls raw trends from the active provider and
 * persists everything. Idempotent — duplicate fetches dedupe on contentHash.
 */
export async function runTrendsFetch(opts?: {
  force?: boolean;
  region?: string;
  locale?: string;
  limit?: number;
}): Promise<CronRunResult> {
  const provider = resolveTrendsProvider();
  if (!provider) {
    return {
      ok: true,
      provider: null,
      snapshotsCreated: 0,
      itemsCreated: 0,
      skipped: "no-provider-configured",
    };
  }

  if (!opts?.force) {
    const recent = await db.trendSnapshot.findFirst({
      where: {
        provider: provider.id,
        fetchedAt: {
          gte: new Date(Date.now() - TREND_FETCH_TTL_HOURS * 3600 * 1000),
        },
      },
      orderBy: { fetchedAt: "desc" },
      select: { id: true, fetchedAt: true },
    });
    if (recent) {
      return {
        ok: true,
        provider: provider.id,
        snapshotsCreated: 0,
        itemsCreated: 0,
        skipped: `cached-until-${new Date(
          recent.fetchedAt.getTime() + TREND_FETCH_TTL_HOURS * 3600 * 1000
        ).toISOString()}`,
      };
    }
  }

  const raw = await provider.fetchRawTrends({
    region: opts?.region,
    locale: opts?.locale,
    limit: opts?.limit,
  });

  if (raw.length === 0) {
    return {
      ok: true,
      provider: provider.id,
      snapshotsCreated: 0,
      itemsCreated: 0,
      skipped: "empty-feed",
    };
  }

  const persisted = await persistRawTrends(provider, raw, {
    region: opts?.region,
    locale: opts?.locale,
  });

  const result: CronRunResult = { ...persisted };

  const feedTouched = result.itemsCreated + (result.itemsRefreshed ?? 0);
  if (feedTouched > 0) {
    try {
      const mirrored = await mirrorFreshTrendThumbnails(
        Math.max(TRENDS_AUTO_ANALYZE_LIMIT * 3, 12)
      );
      if (mirrored > 0) {
        result.thumbnailsMirrored = mirrored;
      }
    } catch (err) {
      console.error("[trends] thumbnail mirror batch failed (non-fatal):", err);
    }
  }

  if (feedTouched > 0 && TRENDS_AUTO_ANALYZE_LIMIT > 0) {
    try {
      result.formatsAnalyzed = await analyzeTopTrendsFormat(
        TRENDS_AUTO_ANALYZE_LIMIT
      );
    } catch (err) {
      console.error("[trends] auto format analysis failed (non-fatal):", err);
    }
  }

  return result;
}
