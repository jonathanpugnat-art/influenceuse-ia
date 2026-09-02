import {
  mapInstagramPost,
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
  resolveMinLikes,
  resolveMinVideoViews,
  resolveTikTokCountry,
  resolveTikTokIndustry,
  resolveTikTokPeriod,
  resolveTikTokVideoHashtags,
  resolveTrendsFetchLimit,
} from "./env-config";
import {
  dedupeTrendItems,
  mapTikTokRow,
  normalizeTikTokHashtagRow,
} from "./mappers";
import { keepHighReachItem, rankByReach } from "./quality";
import { buildTikTokHashtagActorInput } from "./tiktok-hashtag-actor";
import { runApifyActor } from "./run-actor";

export { keepHighReachItem, rankByReach } from "./quality";

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
    const videoTarget = Math.ceil(limit * 0.9);
    const signalTarget = Math.max(20, Math.ceil(limit * 0.25));
    const minViews = resolveMinVideoViews();
    const minLikes = resolveMinLikes();

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

    const [tiktokVideos, instagramPosts] = await Promise.allSettled([
      isTikTokVideoFetchEnabled()
        ? this.fetchTikTokVideos(token, ctx, videoTarget, trendingTags)
        : Promise.resolve([]),
      this.fetchInstagramPosts(token, videoTarget),
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

    if (instagramPosts.status === "fulfilled") merge(instagramPosts.value);
    else
      console.error(
        "[trends/apify] Instagram post sub-fetch failed:",
        instagramPosts.reason
      );

    merge(hashtagSignals);

    if (!collectedAny) {
      throw new Error("Apify provider returned no data");
    }

    const deduped = dedupeTrendItems(out);
    const filtered = deduped.filter((item) =>
      keepHighReachItem(item, minViews, minLikes)
    );
    const pool = filtered.length > 0 ? filtered : deduped;
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
        Math.ceil((limit * 1.5) / Math.max(hashtags.length, 1))
      )
    );
    const downloadVideos =
      process.env.TRENDS_DOWNLOAD_VIDEOS?.trim().toLowerCase() === "true";
    const downloadCovers =
      process.env.TRENDS_DOWNLOAD_COVERS?.trim().toLowerCase() !== "false";
    const minViews = resolveMinVideoViews();
    const minLikes = resolveMinLikes();
    const input: Record<string, unknown> = {
      hashtags,
      resultsPerPage: perTag,
      shouldDownloadVideos: downloadVideos,
      shouldDownloadCovers: downloadCovers,
      proxyConfiguration: { useApifyProxy: true },
    };
    const rows = await runApifyActor<TikTokVideoRow>(actorId, input, token);
    return rows
      .map((row) => mapTikTokVideoRow(row))
      .filter((r): r is RawTrendItem => r !== null)
      .filter((item) => keepHighReachItem(item, minViews, minLikes))
      .sort(rankByReach)
      .slice(0, limit);
  }

  private async fetchInstagramPosts(
    token: string,
    limit: number
  ): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];
    const actorId =
      process.env.APIFY_INSTAGRAM_ACTOR?.trim() || APIFY_INSTAGRAM_ACTOR_DEFAULT;
    const hashtags = resolveInstagramHashtags();
    const perHashtag = Math.max(12, Math.ceil((limit * 4) / hashtags.length));
    const minViews = resolveMinVideoViews();
    const minLikes = resolveMinLikes();
    const input: Record<string, unknown> = {
      hashtags,
      resultsType: "posts",
      resultsLimit: perHashtag,
    };
    const rows = await runApifyActor<InstagramVideoPostRow>(
      actorId,
      input,
      token
    );
    return rows
      .map((row) => mapInstagramPost(row))
      .filter((r): r is RawTrendItem => r !== null)
      .filter((item) => keepHighReachItem(item, minViews, minLikes))
      .sort(rankByReach)
      .slice(0, limit);
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
    const industry = resolveTikTokIndustry();
    const input = buildTikTokHashtagActorInput(actorId, {
      country,
      period,
      limit,
      industry,
    });
    const rows = await runApifyActor<unknown>(actorId, input, token);
    return rows
      .map((row) => {
        const normalized = normalizeTikTokHashtagRow(row);
        return normalized ? mapTikTokRow(normalized, { country, period }) : null;
      })
      .filter((r): r is RawTrendItem => r !== null);
  }
}

/** Back-compat alias — old code still imports `ApifyProvider`. */
export const ApifyProvider = ApifyTrendsProvider;
