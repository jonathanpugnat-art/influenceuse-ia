import type { ProviderContext } from "../types";
import {
  APIFY_INSTAGRAM_HASHTAGS_DEFAULT,
  TRENDS_FETCH_LIMIT_DEFAULT,
  TRENDS_MIN_VIDEO_VIEWS_DEFAULT,
} from "./constants";

export function resolveTikTokCountry(ctx?: ProviderContext): string {
  const fromCtx = ctx?.region?.trim()?.toUpperCase();
  if (fromCtx && fromCtx.length === 2) return fromCtx;
  const fromEnv = process.env.APIFY_TIKTOK_COUNTRY?.trim()?.toUpperCase();
  if (fromEnv && fromEnv.length === 2) return fromEnv;
  return "FR";
}

export function resolveTikTokPeriod(): "7" | "30" | "120" {
  const v = process.env.APIFY_TIKTOK_PERIOD?.trim();
  if (v === "30" || v === "120") return v;
  return "7";
}

export function resolveTrendsFetchLimit(ctxLimit?: number): number {
  if (typeof ctxLimit === "number" && Number.isFinite(ctxLimit) && ctxLimit > 0) {
    return Math.min(300, Math.floor(ctxLimit));
  }
  const fromEnv = Number(process.env.TRENDS_FETCH_LIMIT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(300, Math.floor(fromEnv));
  }
  return TRENDS_FETCH_LIMIT_DEFAULT;
}

/** Minimum TikTok plays / IG video views to keep a scraped post. */
export function resolveMinVideoViews(): number {
  const raw = process.env.TRENDS_MIN_VIDEO_VIEWS?.trim();
  if (raw === "0") return 0;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return TRENDS_MIN_VIDEO_VIEWS_DEFAULT;
}

export function resolveInstagramHashtags(): string[] {
  const raw = process.env.APIFY_INSTAGRAM_HASHTAGS;
  if (!raw) return APIFY_INSTAGRAM_HASHTAGS_DEFAULT;
  const list = raw
    .split(",")
    .map((s) => s.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : APIFY_INSTAGRAM_HASHTAGS_DEFAULT;
}

export function resolveTikTokVideoHashtags(hashtagNames: string[]): string[] {
  const fromEnv = process.env.APIFY_TIKTOK_VIDEO_HASHTAGS?.split(",")
    .map((s) => s.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
  if (fromEnv && fromEnv.length > 0) return fromEnv.slice(0, 20);
  const merged = [
    ...hashtagNames.map((h) => h.replace(/^#/, "").toLowerCase()),
    ...resolveInstagramHashtags(),
  ];
  return [...new Set(merged)].slice(0, 16);
}

export function isTikTokVideoFetchEnabled(): boolean {
  const raw = process.env.APIFY_TIKTOK_VIDEOS?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  return true;
}
