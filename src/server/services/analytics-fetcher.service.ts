// ──────────────────────────────────────────────
// Analytics fetcher (Sprint 10 — Later)
//
// Periodically polls Instagram & TikTok APIs for views/likes/comments on every
// PublishResult that has a SUCCESS status, and persists the snapshot in the
// ContentAnalytics table. Powered by /api/cron/fetch-analytics.
//
// Design choices:
//  - Snapshot model: every fetch creates a new ContentAnalytics row (composite
//    unique [contentId, platform, fetchedAt]) so we keep the time series and
//    can graph the engagement curve. The aggregation queries already existed
//    in `analytics.ts` router (Sprint 8); they read the latest snapshot per
//    (contentId, platform).
//  - Slice-based: we cap at SLICE_SIZE per cron tick to stay within Vercel's
//    10s execution budget. The cron runs hourly, so a creator with thousands
//    of posts gets refreshed within a couple of hours.
//  - We refetch posts:
//      * younger than 24h → every cron tick (fast-moving early window)
//      * 1-7 days old → if last snapshot > 6h
//      * 7-30 days old → if last snapshot > 24h
//      * older → only every 7 days (mostly stable)
// ──────────────────────────────────────────────

import { db } from "@/server/db";
import { decrypt } from "@/lib/encryption";
import { getInsights } from "@/server/services/instagram.service";
import { getVideoInfo } from "@/server/services/tiktok.service";
import { createLogger } from "@/lib/logger";
import type { Platform } from "@/generated/prisma/client";

const log = createLogger("analytics-fetcher");

const SLICE_SIZE = 25;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface FetchResult {
  scanned: number;
  refreshed: number;
  failed: number;
  skipped: number;
}

/**
 * Returns the minimum delay we want between two snapshots given a publication
 * age. Younger posts evolve fast (hot-window) so we refresh them more often.
 */
export function refreshIntervalForAge(ageMs: number): number {
  if (ageMs < DAY) return 0;
  if (ageMs < 7 * DAY) return 6 * HOUR;
  if (ageMs < 30 * DAY) return DAY;
  return 7 * DAY;
}

/**
 * Computes engagement rate from raw counters. Uses views as denominator when
 * available (best correlate of reach), else falls back to likes+comments.
 */
export function computeEngagementRate(opts: {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}): number {
  const interactions = opts.likes + opts.comments + opts.shares + opts.saves;
  if (opts.views > 0) return interactions / opts.views;
  if (interactions === 0) return 0;
  return interactions / Math.max(interactions, 1);
}

interface PublishedRow {
  id: string;
  contentId: string;
  platform: Platform;
  externalPostId: string | null;
  publishedAt: Date | null;
  content: {
    influencer: {
      socialAccounts: Array<{
        platform: Platform;
        accessToken: string | null;
        tokenExpiresAt: Date | null;
        platformUserId: string | null;
      }>;
    };
    contentAnalytics: Array<{ fetchedAt: Date }>;
  };
}

/**
 * Pure helper — given the row + now(), decide whether we should fetch.
 * Exported for unit tests so we don't need a DB to verify the logic.
 */
export function shouldRefresh(row: {
  publishedAt: Date | null;
  latestFetchedAt: Date | null;
  now: Date;
}): boolean {
  if (!row.publishedAt) return false;
  const age = row.now.getTime() - row.publishedAt.getTime();
  if (age < 0) return false;
  const interval = refreshIntervalForAge(age);
  if (!row.latestFetchedAt) return true;
  return row.now.getTime() - row.latestFetchedAt.getTime() >= interval;
}

async function fetchOne(row: PublishedRow): Promise<"refreshed" | "skipped" | "failed"> {
  const account = row.content.influencer.socialAccounts.find(
    (sa) => sa.platform === row.platform
  );
  if (!account?.accessToken || !row.externalPostId) {
    return "skipped";
  }

  let token: string;
  try {
    token = decrypt(account.accessToken);
  } catch (err) {
    log.warn(`Decryption failed for ${row.platform} on ${row.contentId}`, err);
    return "failed";
  }

  let views = 0;
  let likes = 0;
  let comments = 0;
  let saves = 0;
  // Neither Instagram Graph nor TikTok Content Posting API exposes a
  // public "shares" counter — we keep the column for schema parity but
  // record 0 until we wire a richer source.
  const shares = 0;

  try {
    if (row.platform === "INSTAGRAM") {
      const insights = await getInsights(token, row.externalPostId, [
        "impressions",
        "reach",
        "engagement",
        "saved",
      ]);
      views = insights.impressions ?? insights.reach ?? 0;
      likes = insights.engagement ?? 0;
      saves = insights.saved ?? 0;
    } else if (row.platform === "TIKTOK") {
      const info = await getVideoInfo(token, row.externalPostId);
      views = Number(info.view_count ?? 0);
      likes = Number(info.like_count ?? 0);
      comments = Number(info.comment_count ?? 0);
    } else {
      // OnlyFans / other platforms have no public analytics API.
      return "skipped";
    }
  } catch (err) {
    log.warn(
      `Fetch failed for ${row.platform} ${row.externalPostId}`,
      err instanceof Error ? err.message : err
    );
    return "failed";
  }

  const engagementRate = computeEngagementRate({ views, likes, comments, shares, saves });

  await db.contentAnalytics.create({
    data: {
      contentId: row.contentId,
      platform: row.platform,
      views,
      likes,
      comments,
      shares,
      saves,
      engagementRate,
    },
  });

  return "refreshed";
}

/**
 * Top-level entry point called by the cron. Selects up to SLICE_SIZE published
 * posts that are due for a refresh, fetches their stats sequentially (so we
 * don't burst third-party APIs) and persists snapshots.
 */
export async function fetchAnalyticsSlice(opts?: {
  sliceSize?: number;
}): Promise<FetchResult> {
  const sliceSize = opts?.sliceSize ?? SLICE_SIZE;
  const now = new Date();

  // We pull all SUCCESS PublishResults with a recent enough publishedAt to be
  // worth refreshing (≤ 90d). Filter in JS using shouldRefresh().
  const rows = await db.publishResult.findMany({
    where: {
      status: "SUCCESS",
      externalPostId: { not: null },
      publishedAt: {
        not: null,
        gte: new Date(now.getTime() - 90 * DAY),
      },
    },
    orderBy: { publishedAt: "desc" },
    take: sliceSize * 4, // fetch a wider candidate window, filter down to sliceSize.
    select: {
      id: true,
      contentId: true,
      platform: true,
      externalPostId: true,
      publishedAt: true,
      content: {
        select: {
          influencer: {
            select: {
              socialAccounts: {
                select: {
                  platform: true,
                  accessToken: true,
                  tokenExpiresAt: true,
                  platformUserId: true,
                },
              },
            },
          },
          contentAnalytics: {
            orderBy: { fetchedAt: "desc" },
            take: 1,
            select: { fetchedAt: true },
          },
        },
      },
    },
  });

  const candidates = rows.filter((r) =>
    shouldRefresh({
      publishedAt: r.publishedAt,
      latestFetchedAt: r.content.contentAnalytics[0]?.fetchedAt ?? null,
      now,
    })
  );

  const slice = candidates.slice(0, sliceSize);
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of slice) {
    const outcome = await fetchOne(row as PublishedRow);
    if (outcome === "refreshed") refreshed++;
    else if (outcome === "skipped") skipped++;
    else failed++;
  }

  log.info(
    `slice scanned=${rows.length} candidates=${candidates.length} refreshed=${refreshed} failed=${failed} skipped=${skipped}`
  );

  return { scanned: rows.length, refreshed, failed, skipped };
}
