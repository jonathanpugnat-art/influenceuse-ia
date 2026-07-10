/**
 * P0 — Repopulate the trends feed + vision formatBrief batch.
 *
 * 1. Force-fetch from Apify (or configured provider)
 * 2. On Apify failure / empty → refresh TTL on existing DB items (fallback)
 * 3. Auto-analyze top N unanalyzed trends (vision Claude)
 * 4. Print feed health for Luna Test (sanity check)
 *
 * Usage:
 *   npx tsx scripts/p0-refresh-trends.ts
 *   TRENDS_FORMAT_ANALYZE_LIMIT=30 npx tsx scripts/p0-refresh-trends.ts
 */

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import {
  analyzeTopTrendsFormat,
  getFeedForInfluencer,
  getGlobalTrendFeed,
  refreshTrendItemsFeedTtl,
  runTrendsFetch,
} from "../src/server/services/trends.service";

const LUNA_ID = "cmqy5kbes0001vesyrlwrvefe";

async function main() {
  const analyzeLimit = (() => {
    const raw = Number(process.env.TRENDS_FORMAT_ANALYZE_LIMIT);
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return 30;
  })();

  console.log("=== P0 trends refresh ===\n");
  console.log(`Format analyze limit: ${analyzeLimit}\n`);

  let fetchResult: Awaited<ReturnType<typeof runTrendsFetch>> | null = null;
  let ttlFallback: { itemsRefreshed: number } | null = null;

  try {
    fetchResult = await runTrendsFetch({ force: true });
    console.log("Fetch result:", JSON.stringify(fetchResult, null, 2));
  } catch (error) {
    console.warn(
      "[P0] Apify/provider fetch failed — falling back to DB TTL refresh:",
      error instanceof Error ? error.message : error
    );
  }

  const feedTouched =
    (fetchResult?.itemsCreated ?? 0) + (fetchResult?.itemsRefreshed ?? 0);

  if (!fetchResult?.ok || feedTouched === 0) {
    console.log("\nRefreshing feed TTL on existing trend items (FITNESS + global)…");
    ttlFallback = await refreshTrendItemsFeedTtl({ limit: 120, niche: "FITNESS" });
    console.log(`TTL refresh: ${ttlFallback.itemsRefreshed} items`);
    if (ttlFallback.itemsRefreshed < 40) {
      const extra = await refreshTrendItemsFeedTtl({ limit: 120 });
      console.log(`TTL refresh (all niches): ${extra.itemsRefreshed} items`);
      ttlFallback.itemsRefreshed += extra.itemsRefreshed;
    }
  }

  let formatsAnalyzed = fetchResult?.formatsAnalyzed ?? 0;
  const analyzeTarget = analyzeLimit;
  if (formatsAnalyzed < analyzeTarget) {
    const remaining = analyzeTarget - formatsAnalyzed;
    console.log(`\nRunning format analysis (up to ${remaining})…`);
    const extra = await analyzeTopTrendsFormat(remaining);
    formatsAnalyzed += extra;
    console.log(`Formats analyzed this run: ${extra} (total ${formatsAnalyzed})`);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const freshSince = new Date(Date.now() - 72 * 3600 * 1000);
    const freshCount = await prisma.trendItem.count({
      where: { fetchedAt: { gte: freshSince } },
    });
    const withBrief = await prisma.trendItem.count({
      where: {
        fetchedAt: { gte: freshSince },
        formatBrief: { not: Prisma.DbNull },
      },
    });
    const fitnessFresh = await prisma.trendItem.count({
      where: {
        fetchedAt: { gte: freshSince },
        nicheTags: { has: "FITNESS" },
      },
    });

    const luna = await prisma.influencer.findUnique({
      where: { id: LUNA_ID },
      include: { user: { select: { plan: true, locale: true } } },
    });

    let lunaFeed = 0;
    if (luna) {
      const feed = await getFeedForInfluencer(luna, {
        limit: 10,
        userPlan: luna.user.plan,
        userLocale: luna.user.locale,
      });
      lunaFeed = feed.items.length;
    }
    const global = await getGlobalTrendFeed({
      limit: 10,
      userPlan: "PRO",
      isNsfw: false,
    });

    console.log("\n=== Feed health ===");
    console.log(
      JSON.stringify(
        {
          apifyFetch: fetchResult
            ? {
                ok: fetchResult.ok,
                skipped: fetchResult.skipped,
                itemsCreated: fetchResult.itemsCreated,
                itemsRefreshed: fetchResult.itemsRefreshed,
              }
            : "failed",
          ttlFallback,
          freshItemsLast72h: freshCount,
          freshWithFormatBrief: withBrief,
          freshFitnessTagged: fitnessFresh,
          lunaFeedCount: lunaFeed,
          globalFeedCount: global.items.length,
          formatsAnalyzed,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
