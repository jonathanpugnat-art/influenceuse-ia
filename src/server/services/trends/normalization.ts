import { createHash } from "node:crypto";
import {
  TREND_CONTENT_TYPES,
  TREND_EXPRESSIONS,
  TREND_PLATFORMS,
  TREND_POSES,
  TREND_SCENES,
} from "@/lib/prompts/trend-prompts";
import { KNOWN_NICHE_TAGS } from "./constants";

const sceneSet = new Set<string>(TREND_SCENES);
const poseSet = new Set<string>(TREND_POSES);
const expressionSet = new Set<string>(TREND_EXPRESSIONS);
const typeSet = new Set<string>(TREND_CONTENT_TYPES);
const platformSet = new Set<string>(TREND_PLATFORMS);
const nicheTagSet = new Set<string>(KNOWN_NICHE_TAGS);

export function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function normalizeNicheTags(input: string[] | undefined): string[] {
  if (!input || input.length === 0) return ["GENERAL"];
  const out = new Set<string>();
  for (const raw of input) {
    const up = raw.trim().toUpperCase();
    if (nicheTagSet.has(up)) out.add(up);
  }
  if (out.size === 0) out.add("GENERAL");
  return Array.from(out);
}

export function matchesNiche(
  trendNiches: string[],
  influencerNiche: string
): boolean {
  if (trendNiches.length === 0) return true;
  if (trendNiches.includes("GENERAL")) return true;
  const target = influencerNiche.toUpperCase();
  return trendNiches.some((t) => t.toUpperCase() === target);
}

export function normalizeHashtags(hashtags: string[] | undefined): string[] {
  if (!hashtags) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hashtags) {
    const cleaned = h.trim().replace(/^#+/, "").toLowerCase();
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out.slice(0, 30);
}

export function clampScene(v: string): string {
  return sceneSet.has(v) ? v : "studio";
}

export function clampPose(v: string): string {
  return poseSet.has(v) ? v : "portrait";
}

export function clampExpression(v: string): string {
  return expressionSet.has(v) ? v : "natural";
}

export function clampContentType(v: string): "PHOTO" | "REEL" | "CAROUSEL" {
  return (typeSet.has(v) ? v : "PHOTO") as "PHOTO" | "REEL" | "CAROUSEL";
}

export function clampPlatform(v: string): "INSTAGRAM" | "TIKTOK" | "ONLYFANS" {
  return (platformSet.has(v) ? v : "INSTAGRAM") as
    | "INSTAGRAM"
    | "TIKTOK"
    | "ONLYFANS";
}
