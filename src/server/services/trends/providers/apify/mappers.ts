import type { RawTrendItem } from "../types";

/**
 * TikTok Creative Center industries → our internal Niche enum keys.
 * The mapping is intentionally lossy — anything we can't map cleanly is
 * tagged `GENERAL` and the LLM personalization layer will figure it out.
 */
export function mapTikTokIndustryToNiche(industryLabel: string | undefined): string[] {
  if (!industryLabel) return ["GENERAL"];
  const l = industryLabel.toLowerCase();
  if (l.includes("apparel") || l.includes("fashion") || l.includes("beauty")) return ["FASHION"];
  if (l.includes("sport") || l.includes("fitness") || l.includes("health")) return ["FITNESS"];
  if (l.includes("travel") || l.includes("tourism")) return ["TRAVEL"];
  if (l.includes("food") || l.includes("beverage") || l.includes("restaurant")) return ["FOOD"];
  if (l.includes("tech") || l.includes("electronics") || l.includes("software")) return ["TECH"];
  if (l.includes("game") || l.includes("gaming") || l.includes("esports")) return ["GAMING"];
  if (l.includes("lifestyle") || l.includes("home") || l.includes("daily")) return ["LIFESTYLE"];
  return ["GENERAL"];
}

/** Coarse niche tagging from a list of hashtags (used for IG). */
export function inferNicheFromHashtags(hashtags: string[]): string[] {
  const joined = hashtags.join(" ").toLowerCase();
  const niches = new Set<string>();
  if (/fashion|ootd|outfit|style|streetwear|fashionista/.test(joined)) niches.add("FASHION");
  if (/fit(ness)?|workout|gym|running|crossfit|yoga/.test(joined)) niches.add("FITNESS");
  if (/travel|wanderlust|vacation|trip|explore|nomad/.test(joined)) niches.add("TRAVEL");
  if (/food|foodie|recipe|chef|dinner|brunch|coffee/.test(joined)) niches.add("FOOD");
  if (/tech|gadget|coding|developer|ai|startup/.test(joined)) niches.add("TECH");
  if (/gaming|gamer|esports|twitch|valorant|fortnite/.test(joined)) niches.add("GAMING");
  if (/lifestyle|life|daily|aesthetic|cozy|home|grwm/.test(joined)) niches.add("LIFESTYLE");
  if (niches.size === 0) niches.add("GENERAL");
  return Array.from(niches);
}

/**
 * Normalize TikTok video_views (which can be in the billions) into a 0..100
 * "growthScore" using a log scale so the UI doesn't show "9876543". Tuning:
 *   - 100k views   →  ~50
 *   - 1M  views    →  ~67
 *   - 10M views    →  ~83
 *   - 100M views   →  ~100
 */
export function viewsToGrowthScore(views: number | undefined): number | undefined {
  if (typeof views !== "number" || views <= 0) return undefined;
  const score = (Math.log10(views) / 8) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

export interface TikTokHashtagRow {
  hashtag_id?: string;
  hashtag_name?: string;
  industry_info?: { id?: string; label?: string; value?: string };
  video_views?: number;
  publish_cnt?: number;
  rank?: number;
  rank_diff_type?: number;
  analytics?: {
    rank?: number;
    period?: string;
    rank_change_readable?: string;
    publish_cnt?: number;
    video_views?: number;
  };
}

/** Normalize khadinakbar / scrapeengine rows into a single TikTokHashtagRow shape. */
export function normalizeTikTokHashtagRow(row: unknown): TikTokHashtagRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  if (typeof r.hashtag_name === "string" && r.hashtag_name.trim()) {
    const name = r.hashtag_name.trim();

    if (typeof r.industry_name === "string" || typeof r.post_count === "number") {
      const rankDiff = typeof r.rank_diff === "number" ? r.rank_diff : null;
      let rankChange: string | undefined;
      if (rankDiff !== null) {
        if (rankDiff > 0) rankChange = `Up ${rankDiff}`;
        else if (rankDiff < 0) rankChange = `Down ${Math.abs(rankDiff)}`;
        else rankChange = "Stable";
      }

      return {
        hashtag_id:
          typeof r.hashtag_id === "string" ? r.hashtag_id : undefined,
        hashtag_name: name,
        industry_info:
          typeof r.industry_name === "string"
            ? { label: r.industry_name }
            : undefined,
        video_views:
          typeof r.video_views === "number" ? r.video_views : undefined,
        publish_cnt:
          typeof r.post_count === "number" ? r.post_count : undefined,
        analytics: rankChange ? { rank_change_readable: rankChange } : undefined,
      };
    }

    return row as TikTokHashtagRow;
  }

  return null;
}

export function mapTikTokRow(
  row: TikTokHashtagRow,
  ctx: { country: string; period: string }
): RawTrendItem | null {
  const name = row.hashtag_name?.trim();
  if (!name) return null;
  const views = row.video_views ?? row.analytics?.video_views;
  const rankChange = row.analytics?.rank_change_readable;
  const niches = mapTikTokIndustryToNiche(row.industry_info?.label);
  const description = [
    row.industry_info?.label ? `Industry: ${row.industry_info.label}.` : "",
    typeof row.publish_cnt === "number"
      ? `${row.publish_cnt.toLocaleString("en-US")} posts published`
      : "",
    typeof views === "number"
      ? `${views.toLocaleString("en-US")} aggregated video views`
      : "",
    rankChange ? `Trend direction: ${rankChange}.` : "",
    `Period: last ${ctx.period} days in ${ctx.country}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    externalId: `apify-tiktok-${row.hashtag_id ?? name.toLowerCase()}`,
    platform: "TIKTOK",
    title: `#${name}`,
    description,
    hashtags: [name],
    growthScore: viewsToGrowthScore(views),
    viewCount: typeof views === "number" ? views : undefined,
    sourceUrl: `https://www.tiktok.com/tag/${encodeURIComponent(name)}`,
    nicheTags: niches,
    isNsfw: false,
    region: ctx.country,
    mediaKind: "hashtag_signal",
    mediaUrls: [],
  };
}

export interface InstagramPostRow {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  playCount?: number;
  type?: string; // "Image" | "Video" | "Sidecar"
  inputUrl?: string;
  displayUrl?: string;
  videoUrl?: string;
  thumbnailSrc?: string;
  images?: string[];
}

/** Collect public media URLs from one IG post row (Apify shape). */
export function extractPostMediaUrls(post: InstagramPostRow): string[] {
  const urls = new Set<string>();
  for (const u of [
    post.displayUrl,
    post.videoUrl,
    post.thumbnailSrc,
    post.url,
  ]) {
    if (u?.startsWith("http")) urls.add(u);
  }
  for (const img of post.images ?? []) {
    if (img?.startsWith("http")) urls.add(img);
  }
  return [...urls];
}

/**
 * Aggregate raw Instagram posts into one trend per source hashtag. We pick
 * the top-3 most engaged posts per tag, then build a single TrendItem that
 * summarizes what's working.
 */
export function aggregateInstagramPosts(
  posts: InstagramPostRow[]
): RawTrendItem[] {
  const byTag = new Map<string, InstagramPostRow[]>();
  for (const post of posts) {
    // The actor exposes the *queried* hashtag in `inputUrl` like
    //   "https://www.instagram.com/explore/tags/<tag>"
    const m = post.inputUrl?.match(/\/tags\/([^/?#]+)/i);
    const tag = m?.[1]?.toLowerCase();
    if (!tag) continue;
    const list = byTag.get(tag) ?? [];
    list.push(post);
    byTag.set(tag, list);
  }

  const out: RawTrendItem[] = [];
  for (const [tag, list] of byTag.entries()) {
    if (list.length === 0) continue;
    const ranked = [...list].sort(
      (a, b) =>
        ((b.likesCount ?? 0) + 5 * (b.commentsCount ?? 0)) -
        ((a.likesCount ?? 0) + 5 * (a.commentsCount ?? 0))
    );
    const top = ranked.slice(0, 3);
    const totalEng = ranked.reduce(
      (s, p) => s + (p.likesCount ?? 0) + (p.commentsCount ?? 0),
      0
    );
    const allHashtags = new Set<string>([tag]);
    for (const p of top) {
      for (const h of p.hashtags ?? []) allHashtags.add(h.toLowerCase());
    }
    // Caption preview — first non-empty caption from the top post, trimmed.
    const samplePost = top[0];
    const sample = samplePost?.caption?.trim();
    const description =
      (sample
        ? `Top post excerpt: "${sample.split(/\n+/)[0]?.slice(0, 200)}". `
        : "") +
      `${ranked.length} recent posts under #${tag} with ~${totalEng.toLocaleString(
        "en-US"
      )} combined likes+comments.`;

    const mediaUrls = [
      ...new Set(top.flatMap((p) => extractPostMediaUrls(p))),
    ].slice(0, 8);
    const isVideo = top.some((p) => p.type?.toLowerCase() === "video");
    const thumb = mediaUrls[0];
    const thumbAlt = mediaUrls[1];

    out.push({
      externalId: `apify-instagram-${tag}`,
      platform: "INSTAGRAM",
      title: `#${tag}`,
      description,
      hashtags: Array.from(allHashtags).slice(0, 12),
      growthScore: viewsToGrowthScore(totalEng),
      sourceUrl: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`,
      thumbnailUrl: thumb,
      thumbnailUrlAlt: thumbAlt,
      embedUrl: samplePost?.url?.startsWith("http") ? samplePost.url : undefined,
      nicheTags: inferNicheFromHashtags(Array.from(allHashtags)),
      isNsfw: false,
      mediaUrls,
      mediaKind: isVideo ? "video" : top.length > 1 ? "carousel" : "image",
    });
  }
  return out;
}

export function dedupeTrendItems(items: RawTrendItem[]): RawTrendItem[] {
  const seen = new Set<string>();
  const out: RawTrendItem[] = [];
  for (const item of items) {
    if (seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    out.push(item);
  }
  return out;
}
