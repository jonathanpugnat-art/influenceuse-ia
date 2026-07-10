import { APIFY_TIKTOK_ACTOR_LEGACY } from "./constants";

export function isKhadinakbarHashtagActor(actorId: string): boolean {
  return actorId.includes("khadinakbar/tiktok-trending-hashtags");
}

export function isLegacyScrapeengineHashtagActor(actorId: string): boolean {
  return (
    actorId.includes("scrapeengine/tiktok-trending-hashtags") ||
    actorId === APIFY_TIKTOK_ACTOR_LEGACY
  );
}

/** Build actor input — khadinakbar (pay-per-use) vs scrapeengine (legacy rent). */
export function buildTikTokHashtagActorInput(
  actorId: string,
  opts: { country: string; period: "7" | "30" | "120"; limit: number }
): Record<string, unknown> {
  const proxyConfiguration = { useApifyProxy: true };

  if (isKhadinakbarHashtagActor(actorId)) {
    return {
      timePeriod: opts.period,
      country: opts.country,
      industry: "All Industries",
      maxResults: Math.min(Math.max(opts.limit, 1), 100),
      isNewToTop100: false,
      proxyConfiguration,
    };
  }

  return {
    result_type: "top100_with_analytics",
    country: opts.country,
    top100_period: opts.period,
    total_hashtags: Math.min(opts.limit, 100),
    sort_order: "popular",
    industry: "",
    proxyConfiguration,
  };
}
