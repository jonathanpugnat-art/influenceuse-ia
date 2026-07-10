// ──────────────────────────────────────────────
// v0.12 — Trends LLM personalization prompt.
//
// The output is a STRICT JSON array of `TrendRecommendation` objects, one per
// raw trend we send in. We constrain `scene`, `pose`, `expression`, `type`,
// `platform` to the same enums used by the photo/reel creator so the result
// can be applied 1:1 (no UI translation needed).
//
// Hard rules baked into the prompt:
//   1. Never invent identifiable people (real influencers, celebrities) or
//      proprietary songs that aren't in the raw data.
//   2. Never name an actual song/sound unless `trend.soundName` was provided.
//   3. Outfits MUST match the influencer's gender.
//   4. Stay within `language` (fr / en). Never mix.
//   5. If NSFW is disabled for the influencer, refuse to suggest sexual
//      framing and downgrade to SFW alternatives.
// ──────────────────────────────────────────────

import { LANGUAGE_LABELS } from "@/lib/prompts/caption-prompts";

export const TREND_SCENES = [
  "studio",
  "beach",
  "urban",
  "gym",
  "bedroom",
  "restaurant",
  "nature",
  "cafe",
  "rooftop",
  "pool",
] as const;
export type TrendScene = (typeof TREND_SCENES)[number];

export const TREND_POSES = [
  "portrait",
  "fullBody",
  "selfie",
  "action",
  "candid",
  "sitting",
  "profile",
] as const;
export type TrendPose = (typeof TREND_POSES)[number];

export const TREND_EXPRESSIONS = [
  "smile",
  "seductive",
  "serious",
  "playful",
  "mysterious",
  "natural",
  "laughing",
  "surprised",
] as const;
export type TrendExpression = (typeof TREND_EXPRESSIONS)[number];

export const TREND_CONTENT_TYPES = ["PHOTO", "REEL", "CAROUSEL"] as const;
export type TrendContentType = (typeof TREND_CONTENT_TYPES)[number];

export const TREND_PLATFORMS = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;
export type TrendPlatform = (typeof TREND_PLATFORMS)[number];

export interface TrendInfluencerContext {
  influencerName: string;
  influencerGender: "female" | "male" | "nonbinary";
  niche: string;
  personality: string;
  bio: string;
  isNsfw: boolean;
  language: "fr" | "en";
}

/** Minimal trend payload we ship to the LLM. Source-of-truth for citations. */
export interface TrendForPrompt {
  /** Internal id we expect echoed back so we can correlate the LLM response. */
  trendId: string;
  platform: string;
  title: string;
  description?: string;
  hashtags: string[];
  soundName?: string;
  growthScore?: number;
  /** Optional vision/text format analysis from scraped posts. */
  formatBrief?: {
    contentType: string;
    sceneDescription: string;
    pose: string;
    expression: string;
    outfit: string;
    mood: string;
    hook: string;
    lighting?: string;
    cameraStyle?: string;
    inspirationNotes?: string;
    customPrompt?: string;
    videoType?: string;
    reelStoryboard?: { startSec: number; endSec: number; visual: string }[];
    confidence: string;
    analyzedFrom: string;
  };
}

export const TREND_PERSONALIZATION_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

const TREND_JSON_SCHEMA_DESCRIPTION = `Return STRICT JSON. The output is an array, one object per input trend, in the same order:
[
  {
    "trendId": string,                  // must echo the input trend id
    "hook": string,                     // <= 90 chars, scroll-stopping viral angle (pattern interrupt / POV / contrast) in the influencer's voice — not a generic caption
    "concept": string,                  // 1-2 sentences describing the visual content
    "type": "PHOTO" | "REEL" | "CAROUSEL",
    "platform": "INSTAGRAM" | "TIKTOK" | "ONLYFANS",
    "scene": "studio" | "beach" | "urban" | "gym" | "bedroom" | "restaurant" | "nature" | "cafe" | "rooftop" | "pool",
    "pose": "portrait" | "fullBody" | "selfie" | "action" | "candid" | "sitting" | "profile",
    "expression": "smile" | "seductive" | "serious" | "playful" | "mysterious" | "natural" | "laughing" | "surprised",
    "outfit": string,                   // short outfit description (gender-appropriate)
    "customPrompt": string,             // 1-2 sentence extra guidance to inject in the image prompt; never mention real people
    "confidence": "high" | "medium" | "low",
    "citations": string[]               // short labels referencing ONLY the input fields used,
                                        // e.g. ["trend.title", "trend.hashtags[0]", "trend.soundName"]
  }
]
ONLY output valid JSON. No markdown fences, no commentary.`;

export function buildTrendPersonalizationPrompt(
  influencer: TrendInfluencerContext,
  trends: TrendForPrompt[]
): { systemPrompt: string; userPrompt: string } {
  const langLabel = LANGUAGE_LABELS[influencer.language] ?? influencer.language;

  const safetyClause = influencer.isNsfw
    ? "The influencer's account is flagged NSFW: tasteful suggestive framing is allowed when (and only when) the source trend supports it. Stay legal, no minors, no explicit nudity."
    : "The influencer's account is SFW: NEVER suggest sexual, intimate, or undressed framing — even if the source trend hints at it. Downgrade to a tasteful, fully clothed alternative.";

  const systemPrompt = [
    `You are an elite short-form social media strategist. You translate raw trend signals into actionable, ready-to-shoot content briefs for an AI virtual influencer.`,
    ``,
    `Influencer profile:`,
    `- Name: ${influencer.influencerName}`,
    `- Gender: ${influencer.influencerGender}`,
    `- Niche: ${influencer.niche}`,
    `- Personality: ${influencer.personality}`,
    `- Bio: ${influencer.bio}`,
    `- Output language for hooks/concepts/outfits: ${langLabel}`,
    `- NSFW account: ${influencer.isNsfw ? "yes" : "no"}`,
    ``,
    `Hard rules — violations are unacceptable:`,
    `1. NEVER invent or name real people: no celebrities, no real influencers, no public figures, no "in the style of <person>". The influencer is the only character in frame.`,
    `2. NEVER invent a song, sound, or audio name. Only repeat \`trend.soundName\` verbatim when it is present in the input. If absent, do NOT mention any specific song — describe a generic vibe instead (e.g. "upbeat morning beat").`,
    `3. Outfits MUST match the influencer's gender. NEVER suggest dresses/skirts/heels/makeup for male influencers.`,
    `4. ${safetyClause}`,
    `5. NEVER feature, suggest, or imply minors. All scenes are adult-only.`,
    `6. Use ONLY values from the allowed enums for type / platform / scene / pose / expression.`,
    `7. When the trend signal is sparse (no description, no hashtags), set "confidence" to "low" and write a generic, niche-aware concept. Cite "trend.title" in citations and acknowledge in "concept" that this is a generic interpretation inspired by the trend.`,
    `8. Each citation MUST reference an input field that was actually present (e.g. you cannot cite "trend.soundName" if it was empty).`,
    `9. The hook MUST encode a concrete viral angle: POV, before/after, "wait for it", relatable micro-moment, or a niche-specific twist — never a bland description of the scene.`,
    `10. When \`formatBrief\` is present, weave mood, lighting, cameraStyle, and inspirationNotes into customPrompt (English). Map sceneDescription to the closest allowed scene enum.`,
    ``,
    TREND_JSON_SCHEMA_DESCRIPTION,
  ].join("\n");

  const userPrompt = [
    `Here are ${trends.length} trend(s). For each one, produce one recommendation object. Output the JSON array now, in the same order as the input, and nothing else.`,
    `When \`formatBrief\` is present, treat it as the primary visual source: reuse sceneDescription, mood, lighting, and cameraStyle in customPrompt (English), align pose/outfit/expression/type with it. Borrow format pacing from inspirationNotes when useful. Do NOT copy real people.`,
    ``,
    `Trends:`,
    JSON.stringify(trends, null, 2),
  ].join("\n");

  return { systemPrompt, userPrompt };
}
