import { db } from "@/server/db";
import { PLANS } from "@/lib/constants";
import { parseTrendFormatBrief } from "@/lib/trends/trend-format-brief";
import { trendTopPickFromItem, type TrendTopPick } from "@/lib/viral-brief";
import type { Influencer, Platform, TrendItem } from "@/generated/prisma/client";
import { TREND_FEED_TTL_HOURS } from "../constants";
import { dedupeTrendFeedItems } from "./feed-dedupe";

export interface FeedOptions {
  limit?: number;
  cursor?: string;
  platform?: Platform;
}

/**
 * P0 fallback when Apify quota is exhausted or fetch returns empty: bump
 * fetchedAt/expiresAt on existing TrendItems so the 72h feed filter serves
 * them again.
 */
export async function refreshTrendItemsFeedTtl(opts?: {
  limit?: number;
  niche?: string;
}): Promise<{ itemsRefreshed: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 120, 1), 500);
  const expiresAt = new Date(Date.now() + TREND_FEED_TTL_HOURS * 3600 * 1000);
  const now = new Date();

  const candidates = await db.trendItem.findMany({
    where: {
      isNsfw: false,
      ...(opts?.niche
        ? {
            OR: [
              { nicheTags: { has: opts.niche } },
              { nicheTags: { has: "GENERAL" } },
            ],
          }
        : {}),
    },
    orderBy: [
      { likesCount: { sort: "desc", nulls: "last" } },
      { viewCount: { sort: "desc", nulls: "last" } },
      { growthScore: "desc" },
      { fetchedAt: "desc" },
    ],
    take: limit,
    select: { id: true },
  });

  if (candidates.length === 0) {
    return { itemsRefreshed: 0 };
  }

  const touch = await db.trendItem.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { fetchedAt: now, expiresAt },
  });

  return { itemsRefreshed: touch.count };
}

export async function getFeedForInfluencer(
  influencer: Pick<Influencer, "id" | "niche" | "isNsfw">,
  opts: FeedOptions & { userPlan: keyof typeof PLANS; userLocale?: string }
): Promise<{ items: TrendItem[]; nextCursor: string | null }> {
  const planCfg = PLANS[opts.userPlan];
  const hardCap = Math.min(opts.limit ?? planCfg.trendsMaxFeed, planCfg.trendsMaxFeed);
  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );

  const nsfwClause = influencer.isNsfw ? {} : { isNsfw: false };

  const items = await db.trendItem.findMany({
    where: {
      ...nsfwClause,
      fetchedAt: { gte: freshSince },
      ...(opts.platform ? { platform: opts.platform } : {}),
      OR: [
        { nicheTags: { has: influencer.niche } },
        { nicheTags: { has: "GENERAL" } },
        { nicheTags: { isEmpty: true } },
      ],
    },
    orderBy: [
      { likesCount: { sort: "desc", nulls: "last" } },
      { viewCount: { sort: "desc", nulls: "last" } },
      { growthScore: { sort: "desc", nulls: "last" } },
      { fetchedAt: "desc" },
    ],
    take: hardCap + 1,
    ...(opts.cursor
      ? { skip: 1, cursor: { id: opts.cursor } }
      : {}),
  });

  const hasMore = items.length > hardCap;
  const trimmed = hasMore ? items.slice(0, hardCap) : items;
  const deduped = dedupeTrendFeedItems(trimmed);
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]!.id : null;
  return { items: deduped, nextCursor };
}

export async function getGlobalTrendFeed(
  opts: FeedOptions & {
    isNsfw: boolean;
    userPlan: keyof typeof PLANS;
    userLocale?: string;
  }
): Promise<{ items: TrendItem[]; nextCursor: string | null }> {
  const planCfg = PLANS[opts.userPlan];
  const hardCap = Math.min(opts.limit ?? planCfg.trendsMaxFeed, planCfg.trendsMaxFeed);
  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );

  const nsfwClause = opts.isNsfw ? {} : { isNsfw: false };

  const items = await db.trendItem.findMany({
    where: {
      ...nsfwClause,
      fetchedAt: { gte: freshSince },
      ...(opts.platform ? { platform: opts.platform } : {}),
    },
    orderBy: [
      { likesCount: { sort: "desc", nulls: "last" } },
      { viewCount: { sort: "desc", nulls: "last" } },
      { growthScore: { sort: "desc", nulls: "last" } },
      { fetchedAt: "desc" },
    ],
    take: hardCap + 1,
    ...(opts.cursor
      ? { skip: 1, cursor: { id: opts.cursor } }
      : {}),
  });

  const hasMore = items.length > hardCap;
  const trimmed = hasMore ? items.slice(0, hardCap) : items;
  const deduped = dedupeTrendFeedItems(trimmed);
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]!.id : null;
  return { items: deduped, nextCursor };
}

export async function getWizardTrendInspiration(opts: {
  niche: string;
  isNsfw: boolean;
  locale?: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    title: string;
    hook: string | null;
    formatBrief: unknown;
    platform: Platform;
  }>
> {
  const limit = Math.min(opts.limit ?? 5, 8);
  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );
  const nsfwClause = opts.isNsfw ? {} : { isNsfw: false };

  const items = await db.trendItem.findMany({
    where: {
      ...nsfwClause,
      fetchedAt: { gte: freshSince },
      OR: [
        { nicheTags: { has: opts.niche } },
        { nicheTags: { has: "GENERAL" } },
        { nicheTags: { isEmpty: true } },
      ],
    },
    orderBy: [
      { likesCount: { sort: "desc", nulls: "last" } },
      { viewCount: { sort: "desc", nulls: "last" } },
      { growthScore: "desc" },
      { fetchedAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      formatBrief: true,
      platform: true,
    },
  });

  return items.map((item) => {
    const brief = parseTrendFormatBrief(item.formatBrief);
    return {
      id: item.id,
      title: item.title,
      platform: item.platform,
      hook: brief?.hook ?? null,
      formatBrief: item.formatBrief,
    };
  });
}

export async function getTopTrendsForInfluencer(
  influencer: Pick<Influencer, "id" | "niche" | "isNsfw">,
  opts: { limit?: number; userPlan?: keyof typeof PLANS } = {}
): Promise<TrendTopPick[]> {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 6);
  const { items } = await getFeedForInfluencer(influencer, {
    userPlan: opts.userPlan ?? "PRO",
    limit,
  });
  return items.slice(0, limit).map((item) => trendTopPickFromItem(item));
}
