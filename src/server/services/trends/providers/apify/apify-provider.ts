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
} from "./constants";
import {
  isTikTokVideoFetchEnabled,
  resolveInstagramHashtags,
  resolveTikTokCountry,
  resolveTikTokPeriod,
  resolveTikTokVideoHashtags,
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
    const limit = ctx?.limit ?? 60;
    const videoTarget = Math.ceil(limit * 0.7);
    const signalTarget = Math.max(0, limit - videoTarget);

    const hashtagSignals = await this.fetchTikTok(
      token,
      ctx,
      Math.min(15, signalTarget)
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
        this.fetchInstagram(token, Math.min(12, signalTarget)),
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
    return deduped
      .sort((a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0))
      .slice(0, limit);
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
    const perTag = Math.max(2, Math.ceil(limit / hashtags.length));
    const downloadVideos =
      process.env.TRENDS_DOWNLOAD_VIDEOS?.trim().toLowerCase() === "true";
    const downloadCovers =
      process.env.TRENDS_DOWNLOAD_COVERS?.trim().toLowerCase() !== "false";
    const input: Record<string, unknown> = {
      hashtags,
      resultsPerPage: Math.min(perTag, 8),
      shouldDownloadVideos: downloadVideos,
      shouldDownloadCovers: downloadCovers,
      proxyConfiguration: { useApifyProxy: true },
    };
    const rows = await runApifyActor<TikTokVideoRow>(actorId, input, token);
    return rows
      .map((row) => mapTikTokVideoRow(row))
      .filter((r): r is RawTrendItem => r !== null)
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
    const perHashtag = Math.max(8, Math.ceil((limit * 3) / hashtags.length));
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
      .map((row) => mapInstagramVideoPost(row))
      .filter((r): r is RawTrendItem => r !== null)
      .sort((a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0));
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
    const perHashtag = Math.max(5, Math.ceil((limit * 10) / hashtags.length));
    const input: Record<string, unknown> = {
      hashtags,
      resultsType: "posts",
      resultsLimit: perHashtag,
    };
    const rows = await runApifyActor<InstagramPostRow>(actorId, input, token);
    const aggregated = aggregateInstagramPosts(rows);
    return aggregated
      .sort((a, b) => (b.growthScore ?? 0) - (a.growthScore ?? 0))
      .slice(0, limit);
  }
}

/** Back-compat alias — old code still imports `ApifyProvider`. */
export const ApifyProvider = ApifyTrendsProvider;
