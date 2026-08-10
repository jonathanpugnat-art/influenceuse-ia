import {
  mapInstagramVideoPost,
  mapTikTokVideoRow,
  type InstagramVideoPostRow,
  type TikTokVideoRow,
} from "@/lib/trends/trend-video-items";
import type { ProviderContext, RawTrendItem, TrendsProvider } from "../types";
import {
  APIFY_INSTAGRAM_ACTOR_DEFAULT,
  APIFY_TIKTOK_ACTOR_DEFAULT,
  APIFY_TIKTOK_VIDEO_ACTOR_DEFAULT,
  TIKTOK_RESULTS_PER_HASHTAG_CAP,
} from "./constants";
import {
  isTikTokVideoFetchEnabled,
  resolveInstagramHashtags,
  resolveMinVideoViews,
  resolveTikTokCountry,
  resolveTikTokPeriod,
  resolveTikTokVideoHashtags,
  resolveTrendsFetchLimit,
} from "./env-config";
import {
  aggregateInstagramPosts,
  dedupeTrendItems,
  mapTikTokRow,
  normalizeTikTokHashtagRow,
  type InstagramPostRow,
} from "./mappers";
import { buildTikTokHashtagActorInput } from "./tiktok-hashtag-actor";
import { runApifyActor } from "./run-actor";

/** Prefer raw view counts, then growthScore. */
export function rankByReach(a: RawTrendItem, b: RawTrendItem): number {
  const av = a.viewCount ?? 0;
  const bv = b.viewCount ?? 0;
  if (bv !== av) return bv - av;
  return (b.growthScore ?? 0) - (a.growthScore ?? 0);
}

export function keepHighReachItem(
  item: RawTrendItem,
  minViews: number
): boolean {
  if (minViews <= 0) return true;
  // Hashtag-level signals are Creative Center aggregates — keep them.
  if (item.mediaKind === "hashtag_signal" || item.mediaKind === "carousel") {
    return true;
  }
  if (typeof item.viewCount === "number") {
    return item.viewCount >= minViews;
  }
  // Unknown views: keep only if growthScore already looks viral (~100k+).
  return (item.growthScore ?? 0) >= 50;
}

export class ApifyTrendsProvider implements TrendsProvider {
  readonly id = "apify";

  isConfigured(): boolean {
    return Boolean(process.env.APIFY_TOKEN);
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error("ApifyTrendsProvider is missing APIFY_TOKEN");
    }
    const token = process.env.APIFY_TOKEN!;
    const limit = resolveTrendsFetchLimit(ctx?.limit);
    // Oversample videos so min-view filter still fills the feed.
    const videoTarget = Math.ceil(limit * 0.85);
    const signalTarget = Math.max(20, Math.ceil(limit * 0.25));
    const minViews = resolveMinVideoViews();

    const hashtagSignals = await this.fetchTikTok(
      token,
      ctx,
      Math.min(40, signalTarget)
    ).catch((err) => {
      console.error("[trends/apify] TikTok hashtag sub-fetch failed:", err);
      return [] as RawTrendItem[];
    });
    const trendingTags = hashtagSignals
      .map((t) => t.hashtags[0]?.replace(/^#/, ""))
      .filter(Boolean) as string[];

    const [tiktokVideos, instagramVideos, instagramAggregates] =
      await Promise.allSettled([
        isTikTokVideoFetchEnabled()
          ? this.fetchTikTokVideos(token, ctx, videoTarget, trendingTags)
          : Promise.resolve([]),
        this.fetchInstagramVideos(token, videoTarget),
        this.fetchInstagram(token, Math.min(24, signalTarget)),
      ]);

    const out: RawTrendItem[] = [];
    let collectedAny = false;

    const merge = (items: RawTrendItem[]) => {
      if (items.length === 0) return;
      collectedAny = true;
      out.push(...items);
    };

    if (tiktokVideos.status === "fulfilled") merge(tiktokVideos.value);
    else
      console.error(
        "[trends/apify] TikTok video sub-fetch failed:",
        tiktokVideos.reason
      );

    if (instagramVideos.status === "fulfilled") merge(instagramVideos.value);
    else
      console.error(
        "[trends/apify] Instagram video sub-fetch failed:",
        instagramVideos.reason
      );

    merge(hashtagSignals);

    if (instagramAggregates.status === "fulfilled")
      merge(instagramAggregates.value);
    else
      console.error(
        "[trends/apify] Instagram aggregate sub-fetch failed:",
        instagramAggregates.reason
      );

    if (!collectedAny) {
      throw new Error("Apify provider returned no data");
    }

    const deduped = dedupeTrendItems(out);
    const filtered = deduped.filter((item) => keepHighReachItem(item, minViews));
    // If the bar was too high, fall back to unfiltered ranked list so cron
    // never returns an empty feed after a successful scrape.
    const pool = filtered.length >= Math.min(20, limit) ? filtered : deduped;
    return pool.sort(rankByReach).slice(0, limit);
  }

  private async fetchTikTokVideos(
    token: string,
    ctx: ProviderContext | undefined,
    limit: number,
    trendingHashtagNames: string[]
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_TIKTOK_VIDEO_ACTOR?.trim() ||
      APIFY_TIKTOK_VIDEO_ACTOR_DEFAULT;
    const hashtags = resolveTikTokVideoHashtags(trendingHashtagNames);
    const perTag = Math.max(
      5,
      Math.min(
        TIKTOK_RESULTS_PER_HASHTAG_CAP,
        Math.ceil((limit * 1.5) / hashtags.length)
      )
    );
    const downloadVideos =
      process.env.TRENDS_DOWNLOAD_VIDEOS?.trim().toLowerCase() === "true";
    const downloadCovers =
      process.env.TRENDS_DOWNLOAD_COVERS?.trim().toLowerCase() !== "false";
    const minViews = resolveMinVideoViews();
    const input: Record<string, unknown> = {
      hashtags,
      resultsPerPage: perTag,
      shouldDownloadVideos: downloadVideos,
      shouldDownloadCovers: downloadCovers,
      proxyConfiguration: { useApifyProxy: true },
    };
    const rows = await runApifyActor<TikTokVideoRow>(actorId, input, token);
    return rows
      .filter((row) => minViews <= 0 || (row.playCount ?? 0) >= minViews)
      .map((row) => mapTikTokVideoRow(row))
      .filter((r): r is RawTrendItem => r !== null)
      .sort(rankByReach)
      .slice(0, limit);
  }

  private async fetchInstagramVideos(
    token: string,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_INSTAGRAM_ACTOR?.trim() || APIFY_INSTAGRAM_ACTOR_DEFAULT;
    const hashtags = resolveInstagramHashtags();
    const perHashtag = Math.max(12, Math.ceil((limit * 4) / hashtags.length));
    const minViews = resolveMinVideoViews();
    const input: Record<string, unknown> = {
      hashtags,
      resultsType: "posts",
      resultsLimit: perHashtag,
    };
    const rows = await runApifyActor<InstagramVideoPostRow & InstagramPostRow>(
      actorId,
      input,
      token
    );
    const videos = rows
      .filter((row) => {
        const views = row.videoViewCount ?? row.playCount ?? 0;
        // Keep video posts; if views missing, map later and rely on final filter.
        if (minViews > 0 && views > 0 && views < minViews) return false;
        return true;
      })
      .map((row) => mapInstagramVideoPost(row))
      .filter((r): r is RawTrendItem => r !== null)
      .sort(rankByReach);
    return videos.slice(0, limit);
  }

  private async fetchTikTok(
    token: string,
    ctx: ProviderContext | undefined,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_TIKTOK_ACTOR?.trim() || APIFY_TIKTOK_ACTOR_DEFAULT;
    const country = resolveTikTokCountry(ctx);
    const period = resolveTikTokPeriod();
    const input = buildTikTokHashtagActorInput(actorId, {
      country,
      period,
      limit,
    });
    const rows = await runApifyActor<unknown>(actorId, input, token);
    return rows
      .map((row) => {
        const normalized = normalizeTikTokHashtagRow(row);
        return normalized ? mapTikTokRow(normalized, { country, period }) : null;
      })
      .filter((r): r is RawTrendItem => r !== null);
  }

  private async fetchInstagram(
    token: string,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_INSTAGRAM_ACTOR?.trim() || APIFY_INSTAGRAM_ACTOR_DEFAULT;
    const hashtags = resolveInstagramHashtags();
    const perHashtag = Math.max(8, Math.ceil((limit * 12) / hashtags.length));
    const input: Record<string, unknown> = {
      hashtags,
      resultsType: "posts",
      resultsLimit: perHashtag,
    };
    const rows = await runApifyActor<InstagramPostRow>(actorId, input, token);
    const aggregated = aggregateInstagramPosts(rows);
    return aggregated.sort(rankByReach).slice(0, limit);
  }
}

/** Back-compat alias — old code still imports `ApifyProvider`. */
export const ApifyProvider = ApifyTrendsProvider;
