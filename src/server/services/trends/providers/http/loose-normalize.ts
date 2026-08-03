import type { Platform } from "@/generated/prisma/client";
import type { RawTrendItem } from "../types";

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function asPlatform(v: unknown): Platform | undefined {
  if (typeof v !== "string") return undefined;
  const up = v.toUpperCase();
  if (up === "TIKTOK" || up === "INSTAGRAM" || up === "ONLYFANS") {
    return up as Platform;
  }
  return undefined;
}

export function normalizeLooseItem(row: unknown): RawTrendItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const platform = asPlatform(r.platform);
  const title = asString(r.title) ?? asString(r.name) ?? asString(r.hashtag);
  const externalId =
    asString(r.externalId) ?? asString(r.id) ?? asString(r.url);
  if (!platform || !title || !externalId) return null;
  return {
    externalId,
    platform,
    title,
    description: asString(r.description),
    hashtags: asStringArray(r.hashtags).map((h) => h.replace(/^#/, "")),
    soundName: asString(r.soundName) ?? asString(r.sound),
    growthScore: asNumber(r.growthScore) ?? asNumber(r.score),
    sourceUrl: asString(r.sourceUrl) ?? asString(r.url),
    nicheTags: asStringArray(r.nicheTags),
    isNsfw: asBoolean(r.isNsfw) ?? false,
    locale: asString(r.locale),
    region: asString(r.region),
  };
}
