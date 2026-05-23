/**
 * Structured "format inspiration" extracted from real posts (vision + metadata).
 * Used to seed photo/reel creators — never copies faces or real creators.
 */

import { z } from "zod";
import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import { clampPremiumNsfwLevel } from "@/lib/premium-content";
import {
  TREND_EXPRESSIONS,
  TREND_POSES,
  TREND_SCENES,
} from "@/lib/prompts/trend-prompts";

function clampScene(v: string): string {
  return (TREND_SCENES as readonly string[]).includes(v) ? v : "custom";
}
function clampPose(v: string): string {
  return (TREND_POSES as readonly string[]).includes(v) ? v : "candid";
}
function clampExpression(v: string): string {
  return (TREND_EXPRESSIONS as readonly string[]).includes(v) ? v : "natural";
}

/** Subset mirrored from trends.service recommendation fields. */
export type TrendRecommendationFieldsLite = {
  type: string;
  platform: string;
  scene: string;
  pose: string;
  expression: string;
  outfit: string;
  customPrompt: string;
  hook: string;
  confidence?: "high" | "medium" | "low";
  citations?: string[];
};

export const trendFormatBriefSchema = z.object({
  contentType: z.enum(["PHOTO", "REEL", "CAROUSEL", "MIXED"]),
  mood: z.string().max(200),
  /** English — injected into image prompt as sceneDescription */
  sceneDescription: z.string().max(800),
  pose: z.string().max(60),
  expression: z.string().max(60),
  outfit: z.string().max(300),
  lighting: z.string().max(120),
  cameraStyle: z.string().max(200),
  hook: z.string().max(120),
  customPrompt: z.string().max(400),
  reelDurationSec: z.number().int().min(5).max(90).optional(),
  videoType: z.string().max(40).optional(),
  reelScript: z.string().max(600).optional(),
  reelEffects: z.string().max(120).optional(),
  reelStoryboard: z
    .array(
      z.object({
        startSec: z.number(),
        endSec: z.number(),
        visual: z.string().max(300),
      })
    )
    .max(8)
    .optional(),
  inspirationNotes: z.string().max(500),
  confidence: z.enum(["high", "medium", "low"]),
  analyzedFrom: z.enum(["vision", "text_only"]),
});

export type TrendFormatBrief = z.infer<typeof trendFormatBriefSchema>;

export function parseTrendFormatBrief(raw: unknown): TrendFormatBrief | null {
  const parsed = trendFormatBriefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Map analyzed videoType hints to reel creator keys. */
export function mapVideoTypeToReelKey(hint?: string): string {
  if (!hint) return "talking_head";
  const h = hint.toLowerCase();
  if (h.includes("grwm") || h.includes("get ready")) return "grwm";
  if (h.includes("transition")) return "transition";
  if (h.includes("ootd") || h.includes("outfit")) return "ootd";
  if (h.includes("dance")) return "dance";
  if (h.includes("gym") || h.includes("workout")) return "workout";
  if (h.includes("travel") || h.includes("vlog")) return "travel";
  if (h.includes("tutorial") || h.includes("skincare")) return "tutorial";
  if (h.includes("day")) return "day_in_life";
  return "talking_head";
}

export function formatBriefToPhotoSeed(
  brief: TrendFormatBrief,
  influencerId: string,
  hashtags: string[],
  isNsfw: boolean
) {
  const scene = clampScene("custom");
  return {
    influencerId,
    scene,
    sceneDescription: brief.sceneDescription,
    pose: clampPose(brief.pose),
    outfit: brief.outfit,
    expression: clampExpression(brief.expression),
    photoStyle: "natural",
    timeOfDay: "natural",
    customPrompt: [brief.customPrompt, brief.cameraStyle, brief.lighting]
      .filter(Boolean)
      .join(". "),
    caption: brief.hook,
    hashtags,
    contentMode: isNsfw ? ("NSFW" as const) : ("SFW" as const),
    nsfwLevel: isNsfw ? clampPremiumNsfwLevel("suggestive") : undefined,
  };
}

export function formatBriefToReelSeed(
  brief: TrendFormatBrief,
  influencerId: string,
  hashtags: string[]
) {
  const duration = (brief.reelDurationSec ?? 15) as 15 | 30 | 60;
  const clampedDuration: 15 | 30 | 60 =
    duration <= 15 ? 15 : duration <= 30 ? 30 : 60;

  return {
    influencerId,
    duration: clampedDuration,
    format: "VERTICAL" as const,
    videoType: mapVideoTypeToReelKey(brief.videoType),
    script:
      brief.reelScript ??
      brief.reelStoryboard?.map((s) => `${s.startSec}-${s.endSec}s: ${s.visual}`).join(" ") ??
      brief.hook,
    sceneDescription: brief.sceneDescription ?? "",
    outfit: brief.outfit ?? "",
    music: "",
    effects: brief.reelEffects ? [brief.reelEffects] : [],
    textOverlay: "",
    caption: brief.hook,
    hashtags,
    contentMode: "SFW" as const,
  };
}

/** Merge LLM recommendation with format brief (brief wins on scene/outfit when high confidence). */
export function mergeRecommendationWithBrief<T extends TrendRecommendationFieldsLite>(
  fields: T,
  brief: TrendFormatBrief | null
): T {
  if (!brief) return fields;
  const useBrief = brief.confidence === "high" || brief.confidence === "medium";
  if (!useBrief) return fields;

  const scene = fields.scene && fields.scene !== "studio" ? fields.scene : "custom";
  const sceneDescription =
    brief.sceneDescription.trim().length > 0
      ? brief.sceneDescription
      : getSceneInspirationText(scene);

  return {
    ...fields,
    type: brief.contentType === "REEL" ? "REEL" : fields.type,
    hook: fields.hook || brief.hook,
    scene,
    sceneDescription,
    pose: brief.pose ? clampPose(brief.pose) : fields.pose,
    expression: brief.expression
      ? clampExpression(brief.expression)
      : fields.expression,
    outfit: brief.outfit || fields.outfit,
    customPrompt: [brief.customPrompt, brief.cameraStyle, fields.customPrompt]
      .filter(Boolean)
      .join(". "),
    confidence: brief.confidence,
    citations: [
      ...(fields.citations ?? []),
      "formatBrief.sceneDescription",
      "formatBrief.analyzedFrom",
    ],
  } as T & { sceneDescription?: string };
}
