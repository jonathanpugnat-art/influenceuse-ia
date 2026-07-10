import { nanoid } from "nanoid";
import { pickVisionUrlsFromTrend } from "@/lib/trends/trend-video-items";
import {
  isAnthropicVisionSafeUrl,
  normalizeVisionMediaType,
} from "@/lib/trends/trend-vision-images";
import { downloadTrendCdnAsset } from "@/lib/trends/trend-cdn-download";
import { db } from "@/server/db";
import { uploadFile } from "@/server/services/storage.service";
import { TREND_FEED_TTL_HOURS } from "@/server/services/trends/constants";
import type { TrendItem } from "@/generated/prisma/client";

function thumbnailFilename(
  trendItemId: string,
  slot: "thumb" | "thumb-alt"
): string {
  return `trend-${slot}-${trendItemId}-${nanoid(6)}.jpg`;
}

function imageContentType(
  contentType: string,
  url: string
): string {
  const normalized = normalizeVisionMediaType(contentType, url);
  return normalized === "image/png"
    ? "image/png"
    : normalized === "image/webp"
      ? "image/webp"
      : normalized === "image/gif"
        ? "image/gif"
        : "image/jpeg";
}

/** Mirror an external cover to durable storage when social CDNs block vision. */
export async function mirrorTrendThumbnailUrl(
  sourceUrl: string,
  trendItemId: string,
  slot: "thumb" | "thumb-alt"
): Promise<string | null> {
  const url = sourceUrl.trim();
  if (!url.startsWith("http")) return null;
  if (isAnthropicVisionSafeUrl(url)) return url;

  try {
    const downloaded = await downloadTrendCdnAsset(url);
    if (!downloaded) return null;

    return await uploadFile(
      downloaded.buffer,
      thumbnailFilename(trendItemId, slot),
      imageContentType(downloaded.contentType, url)
    );
  } catch (error) {
    console.warn(
      `[trend-thumbnail-storage] Mirror failed (${slot}) for ${trendItemId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function scoreVisionCandidateUrl(url: string): number {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return 0;
  if (path.endsWith(".webp") || path.endsWith(".png")) return 1;
  if (path.endsWith(".heic") || path.endsWith(".heif")) return 10;
  return 5;
}

function sortVisionCandidates(urls: string[]): string[] {
  return [...urls].sort(
    (a, b) => scoreVisionCandidateUrl(a) - scoreVisionCandidateUrl(b)
  );
}

function collectMirrorCandidates(
  item: Pick<TrendItem, "thumbnailUrl" | "thumbnailUrlAlt" | "mediaUrls">
): { primaryCandidates: string[]; altCandidates: string[] } {
  const visionUrls = pickVisionUrlsFromTrend({
    thumbnailUrl: item.thumbnailUrl,
    thumbnailUrlAlt: item.thumbnailUrlAlt,
    mediaUrls: item.mediaUrls,
    videoFrameUrls: [],
  });

  const primaryCandidates: string[] = [];
  const altCandidates: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (list: string[], value?: string | null) => {
    const v = value?.trim();
    if (!v?.startsWith("http") || seen.has(v)) return;
    seen.add(v);
    list.push(v);
  };

  pushUnique(primaryCandidates, item.thumbnailUrl);
  for (const url of visionUrls) pushUnique(primaryCandidates, url);
  pushUnique(altCandidates, item.thumbnailUrlAlt);
  for (const url of visionUrls) {
    if (!primaryCandidates.includes(url)) pushUnique(altCandidates, url);
  }

  return {
    primaryCandidates: sortVisionCandidates(primaryCandidates),
    altCandidates: sortVisionCandidates(altCandidates),
  };
}

async function mirrorFirstAvailable(
  candidates: string[],
  trendItemId: string,
  slot: "thumb" | "thumb-alt"
): Promise<{ url: string | null; changed: boolean }> {
  for (const candidate of candidates) {
    if (isAnthropicVisionSafeUrl(candidate)) {
      return { url: candidate, changed: false };
    }
    const mirrored = await mirrorTrendThumbnailUrl(candidate, trendItemId, slot);
    if (mirrored) {
      return { url: mirrored, changed: mirrored !== candidate };
    }
  }
  return { url: null, changed: false };
}

/**
 * Persist TikTok/IG covers on R2 so cards + Claude vision use stable URLs.
 * Falls back to `mediaUrls` when `thumbnailUrl` is missing on scraped videos.
 */
export async function mirrorTrendThumbnails(
  item: Pick<TrendItem, "id" | "thumbnailUrl" | "thumbnailUrlAlt" | "mediaUrls">
): Promise<{
  thumbnailUrl: string | null;
  thumbnailUrlAlt: string | null;
  changed: boolean;
}> {
  const { primaryCandidates, altCandidates } = collectMirrorCandidates(item);

  let thumbnailUrl = item.thumbnailUrl;
  let thumbnailUrlAlt = item.thumbnailUrlAlt;
  let changed = false;

  const needsPrimary =
    !thumbnailUrl ||
    (thumbnailUrl.startsWith("http") && !isAnthropicVisionSafeUrl(thumbnailUrl));
  if (needsPrimary && primaryCandidates.length > 0) {
    const mirrored = await mirrorFirstAvailable(
      primaryCandidates,
      item.id,
      "thumb"
    );
    if (mirrored.url) {
      if (mirrored.url !== thumbnailUrl) changed = true;
      thumbnailUrl = mirrored.url;
    }
  }

  const needsAlt =
    !thumbnailUrlAlt ||
    (thumbnailUrlAlt.startsWith("http") &&
      !isAnthropicVisionSafeUrl(thumbnailUrlAlt));
  if (needsAlt && altCandidates.length > 0) {
    const mirrored = await mirrorFirstAvailable(
      altCandidates.filter((u) => u !== thumbnailUrl),
      item.id,
      "thumb-alt"
    );
    if (mirrored.url && mirrored.url !== thumbnailUrl) {
      if (mirrored.url !== thumbnailUrlAlt) changed = true;
      thumbnailUrlAlt = mirrored.url;
    }
  }

  return { thumbnailUrl, thumbnailUrlAlt, changed };
}

function itemNeedsThumbnailMirror(
  item: Pick<TrendItem, "thumbnailUrl" | "thumbnailUrlAlt" | "mediaUrls" | "mediaKind">
): boolean {
  if ((item.mediaUrls?.length ?? 0) > 0 && !item.thumbnailUrl) return true;
  if (item.mediaKind === "video" && !item.thumbnailUrl) return true;
  if (item.thumbnailUrl && !isAnthropicVisionSafeUrl(item.thumbnailUrl)) return true;
  if (item.thumbnailUrlAlt && !isAnthropicVisionSafeUrl(item.thumbnailUrlAlt)) {
    return true;
  }
  if (
    item.thumbnailUrl &&
    scoreVisionCandidateUrl(item.thumbnailUrl) >= 10 &&
    (item.mediaUrls?.length ?? 0) > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Mirror covers for fresh trends right after Apify fetch — before formatBrief
 * vision batch so analyzeTopTrendsFormat finds stable thumbnailUrl values.
 */
export async function mirrorFreshTrendThumbnails(
  limit = 24
): Promise<number> {
  if (limit <= 0) return 0;

  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );

  const items = await db.trendItem.findMany({
    where: {
      fetchedAt: { gte: freshSince },
      isNsfw: false,
      OR: [
        { mediaKind: "video" },
        { NOT: { mediaUrls: { equals: [] } } },
      ],
    },
    orderBy: [{ growthScore: "desc" }, { fetchedAt: "desc" }],
    take: limit * 2,
    select: {
      id: true,
      thumbnailUrl: true,
      thumbnailUrlAlt: true,
      mediaUrls: true,
      mediaKind: true,
    },
  });

  let mirrored = 0;
  for (const item of items) {
    if (mirrored >= limit) break;
    if (!itemNeedsThumbnailMirror(item)) continue;

    const result = await mirrorTrendThumbnails(item);
    const thumbImproved =
      Boolean(result.thumbnailUrl) &&
      result.thumbnailUrl !== item.thumbnailUrl;
    const altImproved =
      Boolean(result.thumbnailUrlAlt) &&
      result.thumbnailUrlAlt !== item.thumbnailUrlAlt;

    if (!result.changed && !thumbImproved && !altImproved) continue;

    await db.trendItem.update({
      where: { id: item.id },
      data: {
        thumbnailUrl: result.thumbnailUrl,
        thumbnailUrlAlt: result.thumbnailUrlAlt,
      },
    });
    mirrored += 1;
  }

  if (mirrored > 0) {
    console.info(`[trend-thumbnail-storage] Mirrored ${mirrored} trend cover(s)`);
  }

  return mirrored;
}
