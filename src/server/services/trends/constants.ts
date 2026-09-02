/** How long a TrendItem stays in the feed by default. */
export const TREND_FEED_TTL_HOURS = 72;

/** Soft TTL for the snapshot cache — cron skips a fetch if the latest snapshot
 *  for a platform/region is fresher than this. */
export const TREND_FETCH_TTL_HOURS = 24;

/** Known niche keys (matches the Prisma `Niche` enum) plus the cross-niche
 *  catch-all "GENERAL". Used to clean provider-supplied niche tags. */
export const KNOWN_NICHE_TAGS = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
  "GENERAL",
] as const;

/**
 * How many freshly-fetched trends get their visual `formatBrief` analyzed
 * automatically (top N by growthScore). Keeps cost bounded — set to 0 to
 * disable auto-analysis and fall back to on-demand "Analyser le format".
 */
export const TRENDS_AUTO_ANALYZE_LIMIT = (() => {
  const raw = Number(process.env.TRENDS_AUTO_ANALYZE_LIMIT);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 30;
})();
