import type { RawTrendItem } from "../types";

/** Hashtags that dump random mega-viral junk (pranks, spam, celebrity names). */
export const TREND_JUNK_HASHTAGS = new Set([
  "fyp",
  "foryou",
  "foryoupage",
  "fypシ",
  "viral",
  "trending",
  "reels",
  "viralvideo",
  "viralvideos",
  "trend",
  "explore",
  "explorepage",
  "foryoupageofficial",
  "xyzbca",
]);

const FORMAT_HASHTAG_RE =
  /grwm|ootd|getreadywithme|dayinmylife|outfit|fashion|beauty|makeup|lifestyle|fitness|gym|workout|travel|aesthetic|skincare|hair|model|slay/;

export function isUsefulVideoHashtag(tag: string): boolean {
  const t = tag.replace(/^#/, "").toLowerCase().trim();
  if (!t) return false;
  if (TREND_JUNK_HASHTAGS.has(t)) return false;
  return FORMAT_HASHTAG_RE.test(t);
}

export function isHashtagSignal(item: Pick<RawTrendItem, "mediaKind">): boolean {
  return item.mediaKind === "hashtag_signal";
}

/**
 * Keep posts that actually perform. Hashtag-only Creative Center rows are
 * kept for catalog/seeding but ranked last in the UI.
 *
 * Rules:
 * - views AND likes when both exist
 * - likes-only (typical IG) or views-only (typical TikTok) still pass
 * - unknown engagement: reject unless growthScore already looks viral (~1M+)
 */
export function keepHighReachItem(
  item: RawTrendItem,
  minViews: number,
  minLikes = 0
): boolean {
  if (minViews <= 0 && minLikes <= 0) return true;
  if (isHashtagSignal(item)) return true;

  const views = item.viewCount ?? 0;
  const likes = item.likesCount ?? 0;
  const viewsOk = minViews <= 0 || views >= minViews;
  const likesOk = minLikes <= 0 || likes >= minLikes;

  if (views > 0 && likes > 0) return viewsOk && likesOk;
  if (views > 0) return viewsOk;
  if (likes > 0) return likesOk;
  return (item.growthScore ?? 0) >= 67;
}

/** Rank real performing posts first; hashtag signals last. */
export function rankByReach(a: RawTrendItem, b: RawTrendItem): number {
  const aPost = isHashtagSignal(a) ? 0 : 1;
  const bPost = isHashtagSignal(b) ? 0 : 1;
  if (bPost !== aPost) return bPost - aPost;

  const likesDiff = (b.likesCount ?? 0) - (a.likesCount ?? 0);
  if (likesDiff !== 0) return likesDiff;

  const viewsDiff = (b.viewCount ?? 0) - (a.viewCount ?? 0);
  if (viewsDiff !== 0) return viewsDiff;

  return (b.growthScore ?? 0) - (a.growthScore ?? 0);
}
