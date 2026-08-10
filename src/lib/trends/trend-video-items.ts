/**
 * Map scraped TikTok / Instagram posts into trend items with real video URLs.
 * Used by Apify provider + vision analysis + apply-to-creator routing.
 */

import type { RawTrendItem } from "@/server/services/trend-provider";
import type { TrendFormatBrief } from "@/lib/trends/trend-format-brief";

const IMAGE_URL_RE = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const VIDEO_URL_RE = /\.mp4(\?|$)/i;

/** Direct MP4 (or similar) URL for inline card preview. */
export function pickVideoUrlFromTrend(input: {
  mediaUrls?: string[] | null;
}): string | null {
  for (const url of input.mediaUrls ?? []) {
    if (url?.startsWith("http") && VIDEO_URL_RE.test(url)) {
      return url;
    }
  }
  return null;
}

/** Best poster/thumbnail when `thumbnailUrl` is missing on the row. */
export function pickPosterUrlFromTrend(input: {
  thumbnailUrl?: string | null;
  thumbnailUrlAlt?: string | null;
  mediaUrls?: string[] | null;
}): string | null {
  if (input.thumbnailUrl?.startsWith("http")) return input.thumbnailUrl;
  for (const url of input.mediaUrls ?? []) {
    if (url?.startsWith("http") && !VIDEO_URL_RE.test(url)) {
      return url;
    }
  }
  if (input.thumbnailUrlAlt?.startsWith("http")) return input.thumbnailUrlAlt;
  return null;
}

export function extractTikTokVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

export function buildTikTokEmbedUrl(sourceUrl: string | null | undefined): string | null {
  const id = extractTikTokVideoId(sourceUrl);
  if (!id) return null;
  return `https://www.tiktok.com/embed/v2/${id}`;
}

export function buildInstagramEmbedUrl(
  sourceUrl: string | null | undefined
): string | null {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  if (!match?.[1]) return null;
  return `https://www.instagram.com/reel/${match[1]}/embed`;
}

/** Inline preview: MP4 first, then platform embed iframe. */
export function resolveTrendInlinePreview(input: {
  platform: "TIKTOK" | "INSTAGRAM" | "ONLYFANS";
  sourceUrl?: string | null;
  embedUrl?: string | null;
  mediaUrls?: string[] | null;
}): { kind: "video"; url: string } | { kind: "embed"; url: string } | null {
  const mp4 = pickVideoUrlFromTrend({ mediaUrls: input.mediaUrls });
  if (mp4) return { kind: "video", url: mp4 };

  const tiktokEmbed =
    input.platform === "TIKTOK"
      ? buildTikTokEmbedUrl(input.embedUrl ?? input.sourceUrl)
      : null;
  if (tiktokEmbed) return { kind: "embed", url: tiktokEmbed };

  const igEmbed =
    input.platform === "INSTAGRAM"
      ? buildInstagramEmbedUrl(input.embedUrl ?? input.sourceUrl)
      : null;
  if (igEmbed) return { kind: "embed", url: igEmbed };

  return null;
}

/** URLs suitable for Claude vision (static images only — not MP4). */
export function pickVisionUrlsFromTrend(input: {
  thumbnailUrl?: string | null;
  thumbnailUrlAlt?: string | null;
  mediaUrls?: string[] | null;
  videoFrameUrls?: string[] | null;
}): string[] {
  const candidates = [
    ...(input.videoFrameUrls ?? []),
    input.thumbnailUrl,
    input.thumbnailUrlAlt,
    ...(input.mediaUrls ?? []),
  ].filter((u): u is string => Boolean(u?.startsWith("http")));

  const images = candidates.filter((u) => IMAGE_URL_RE.test(u) || !/\.mp4(\?|$)/i.test(u));
  return [...new Set(images)].slice(0, 6);
}

export function isVideoTrendItem(mediaKind?: string | null): boolean {
  return mediaKind === "video";
}

/** Best-effort map from analyzed format → studio look preset id. */
export function inferStudioLookFromBrief(brief: TrendFormatBrief): string | null {
  const hay = [
    brief.sceneDescription,
    brief.outfit,
    brief.videoType,
    brief.mood,
    brief.customPrompt,
  ]
    .join(" ")
    .toLowerCase();

  if (/gym|workout|mirror selfie|fitness|legging|sport/.test(hay)) {
    return "mirror-selfie-gym";
  }
  if (/cafe|coffee|latte|brunch|macbook/.test(hay)) return "cafe-aesthetic";
  if (/beach|ocean|bikini|pool|sand|sunset beach/.test(hay)) return "beach-vibes";
  if (/airport|travel|terminal|luggage|flight/.test(hay)) return "airport-ootd";
  if (/rooftop|skyline|sunset cocktail/.test(hay)) return "rooftop-sunset";
  if (/restaurant|dinner|date night|bistro/.test(hay)) return "restaurant-chic";
  if (/morning routine|grwm|bedroom|pyjama|bathroom/.test(hay)) return "morning-routine";
  if (/paris|eiffel|landmark/.test(hay)) return "paris-landmark";
  if (/street|urban|city walk|ootd/.test(hay)) return "street-style";
  return "street-style";
}

export interface TikTokVideoRow {
  id?: string;
  text?: string;
  webVideoUrl?: string;
  videoUrl?: string;
  playCount?: number;
  diggCount?: number;
  shareCount?: number;
  commentCount?: number;
  createTime?: number;
  covers?: { default?: string; origin?: string };
  coverUrl?: string;
  authorMeta?: { name?: string; nickName?: string; uniqueId?: string };
  musicMeta?: { musicName?: string; musicAuthor?: string };
  hashtags?: Array<{ name?: string } | string>;
}

export function mapTikTokVideoRow(row: TikTokVideoRow): RawTrendItem | null {
  const id = row.id?.trim();
  const webUrl = row.webVideoUrl?.trim();
  if (!id && !webUrl) return null;

  const caption = row.text?.trim() ?? "";
  const handle = row.authorMeta?.uniqueId ?? row.authorMeta?.name;
  const authorHandle = handle ? `@${handle.replace(/^@/, "")}` : undefined;

  const tagNames: string[] = [];
  for (const h of row.hashtags ?? []) {
    if (typeof h === "string") tagNames.push(h.replace(/^#/, "").toLowerCase());
    else if (h?.name) tagNames.push(h.name.replace(/^#/, "").toLowerCase());
  }

  const title =
    caption.split(/\n/)[0]?.slice(0, 80).trim() ||
    (tagNames[0] ? `#${tagNames[0]} trend` : "TikTok trend");

  const views = row.playCount ?? row.diggCount;
  const cover =
    row.covers?.default ?? row.covers?.origin ?? row.coverUrl ?? undefined;
  const videoUrl = row.videoUrl?.startsWith("http") ? row.videoUrl : undefined;
  const mediaUrls = [cover, videoUrl].filter((u): u is string => Boolean(u));

  const description = [
    caption ? `Caption: "${caption.slice(0, 220)}".` : "",
    typeof views === "number" ? `${views.toLocaleString("en-US")} plays.` : "",
    row.musicMeta?.musicName ? `Sound: ${row.musicMeta.musicName}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: `apify-tiktok-video-${id ?? webUrl}`,
    platform: "TIKTOK",
    title,
    description,
    hashtags: tagNames.length > 0 ? tagNames : ["fyp"],
    soundName: row.musicMeta?.musicName?.slice(0, 200),
    growthScore: viewsToGrowthScore(views),
    viewCount: typeof views === "number" ? views : undefined,
    sourceUrl: webUrl ?? `https://www.tiktok.com/video/${id}`,
    embedUrl: webUrl,
    thumbnailUrl: cover,
    authorHandle,
    nicheTags: inferNicheFromHashtags(tagNames.length ? tagNames : ["fyp"]),
    isNsfw: false,
    mediaKind: "video",
    mediaUrls,
  };
}

export interface InstagramVideoPostRow {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  playCount?: number;
  type?: string;
  videoUrl?: string;
  displayUrl?: string;
  thumbnailSrc?: string;
  ownerUsername?: string;
}

export function mapInstagramVideoPost(row: InstagramVideoPostRow): RawTrendItem | null {
  const isVideo =
    row.type?.toLowerCase() === "video" || Boolean(row.videoUrl?.startsWith("http"));
  if (!isVideo) return null;

  const postUrl = row.url?.trim();
  const shortCode = row.shortCode?.trim();
  if (!postUrl && !shortCode) return null;

  const caption = row.caption?.trim() ?? "";
  const tags = (row.hashtags ?? []).map((h) => h.replace(/^#/, "").toLowerCase());
  const title =
    caption.split(/\n/)[0]?.slice(0, 80).trim() ||
    (tags[0] ? `#${tags[0]} reel` : "Instagram reel");

  const views = row.videoViewCount ?? row.playCount;
  const engagementProxy =
    typeof views === "number" && views > 0
      ? views
      : (row.likesCount ?? 0) * 20 + (row.commentsCount ?? 0) * 100;

  const thumb = row.displayUrl ?? row.thumbnailSrc;
  const videoUrl = row.videoUrl?.startsWith("http") ? row.videoUrl : undefined;
  const mediaUrls = [thumb, videoUrl].filter((u): u is string => Boolean(u?.startsWith("http")));

  return {
    externalId: `apify-instagram-video-${row.id ?? shortCode ?? postUrl}`,
    platform: "INSTAGRAM",
    title,
    description: [
      caption ? `Caption: "${caption.slice(0, 220)}".` : "Trending Instagram reel.",
      typeof views === "number" ? `${views.toLocaleString("en-US")} views.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    hashtags: tags.length > 0 ? tags : ["reels"],
    growthScore: viewsToGrowthScore(Math.max(engagementProxy, 1)),
    viewCount: typeof views === "number" ? views : undefined,
    sourceUrl: postUrl ?? `https://www.instagram.com/reel/${shortCode}/`,
    embedUrl: postUrl,
    thumbnailUrl: thumb,
    authorHandle: row.ownerUsername ? `@${row.ownerUsername.replace(/^@/, "")}` : undefined,
    nicheTags: inferNicheFromHashtags(tags.length ? tags : ["reels"]),
    isNsfw: false,
    mediaKind: "video",
    mediaUrls,
  };
}

function viewsToGrowthScore(views: number | undefined): number | undefined {
  if (typeof views !== "number" || views <= 0) return undefined;
  const score = (Math.log10(views) / 8) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

function inferNicheFromHashtags(hashtags: string[]): string[] {
  const joined = hashtags.join(" ").toLowerCase();
  const niches = new Set<string>();
  if (/fashion|ootd|outfit|style|streetwear/.test(joined)) niches.add("FASHION");
  if (/fit|workout|gym|running|yoga/.test(joined)) niches.add("FITNESS");
  if (/travel|wanderlust|vacation|trip/.test(joined)) niches.add("TRAVEL");
  if (/food|foodie|recipe|brunch|coffee/.test(joined)) niches.add("FOOD");
  if (/tech|gadget|coding|ai/.test(joined)) niches.add("TECH");
  if (/gaming|gamer|esports/.test(joined)) niches.add("GAMING");
  if (/lifestyle|grwm|aesthetic|cozy|daily/.test(joined)) niches.add("LIFESTYLE");
  if (niches.size === 0) niches.add("GENERAL");
  return Array.from(niches);
}
