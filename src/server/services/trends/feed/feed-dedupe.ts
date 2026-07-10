import { getTrendFormatBrief } from "@/server/services/trend-media-analysis.service";
import { isVideoTrendItem } from "@/lib/trends/trend-video-items";
import type { TrendItem } from "@/generated/prisma/client";

const FEED_MEDIA_KIND_RANK: Record<string, number> = {
  video: 4,
  carousel: 3,
  image: 2,
  hashtag_signal: 1,
};

function trendFeedDedupeKey(item: TrendItem): string {
  const tag = item.hashtags[0]?.toLowerCase().replace(/^#/, "").trim();
  if (tag) return `${item.platform}:${tag}`;
  const title = item.title.toLowerCase().replace(/^#/, "").trim();
  return `${item.platform}:${title}`;
}

function trendFeedItemRank(item: TrendItem): number {
  const kind = FEED_MEDIA_KIND_RANK[item.mediaKind ?? ""] ?? 0;
  const thumb = item.thumbnailUrl ? 1 : 0;
  const brief = item.formatBrief ? 1 : 0;
  const score = item.growthScore ?? 0;
  return kind * 1_000 + thumb * 100 + brief * 50 + score;
}

/** Prefer video posts over duplicate hashtag signals for the same tag. */
export function dedupeTrendFeedItems(items: TrendItem[]): TrendItem[] {
  const byKey = new Map<string, TrendItem[]>();
  for (const item of items) {
    const key = trendFeedDedupeKey(item);
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }

  const out: TrendItem[] = [];
  for (const group of byKey.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }

    const signals = group.filter((i) => i.mediaKind === "hashtag_signal");
    const rich = group.filter((i) => i.mediaKind !== "hashtag_signal");

    if (rich.length > 0) {
      out.push(
        ...rich.sort((a, b) => trendFeedItemRank(b) - trendFeedItemRank(a))
      );
      continue;
    }

    const bestSignal = [...signals].sort(
      (a, b) => trendFeedItemRank(b) - trendFeedItemRank(a)
    )[0];
    if (bestSignal) out.push(bestSignal);
  }

  return out.sort((a, b) => {
    const scoreDiff = (b.growthScore ?? 0) - (a.growthScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime();
  });
}

/** Route trend deep links to photo vs reel studio. */
export function resolveTrendCreatorTarget(
  item: Pick<TrendItem, "formatBrief" | "mediaKind">
): "photo" | "reel" {
  const brief = getTrendFormatBrief(item);
  if (brief?.contentType === "REEL") return "reel";
  if (brief?.contentType === "PHOTO" || brief?.contentType === "CAROUSEL") {
    return "photo";
  }
  if (isVideoTrendItem(item.mediaKind)) return "reel";
  return "photo";
}
