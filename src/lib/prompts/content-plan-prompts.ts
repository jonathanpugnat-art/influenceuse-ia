// ──────────────────────────────────────────────
// Content Plan & Ideas — system prompts
// ──────────────────────────────────────────────

import { LANGUAGE_LABELS, NICHE_TONES } from "@/lib/prompts/caption-prompts";

export interface ContentPlanContext {
  influencerName: string;
  influencerGender: "female" | "male" | "nonbinary";
  niche: string;
  personality: string;
  bio: string;
  language: "fr" | "en";
  platforms: string[]; // e.g. ["INSTAGRAM", "TIKTOK"]
  days: number; // 1..14
  postsPerDay: number; // 1..5
  postingHours?: number[]; // optional preferred hours UTC, e.g. [9, 18]
  goals?: string; // "growth", "engagement", "brand awareness"
  tone?: string;
}

export interface IdeasContext {
  influencerName: string;
  niche: string;
  personality: string;
  language: "fr" | "en";
  platform: string;
  count: number;
}

const PLAN_JSON_SCHEMA_DESCRIPTION = `Return STRICT JSON. Schema:
{
  "summary": string,
  "posts": [
    {
      "dayIndex": number,        // 0..(days-1)
      "slotIndex": number,       // 0..(postsPerDay-1)
      "platform": "INSTAGRAM" | "TIKTOK" | "ONLYFANS",
      "type": "PHOTO" | "REEL" | "CAROUSEL",
      "hook": string,            // first sentence that stops the scroll, max 90 chars
      "concept": string,         // 1-2 sentences describing the visual content
      "scene": string,           // one of: studio, beach, urban, gym, bedroom, restaurant, nature, cafe, rooftop, pool
      "pose": string,            // one of: portrait, fullBody, selfie, action, candid, sitting, profile
      "expression": string,      // one of: smile, seductive, serious, playful, mysterious, natural, laughing, surprised
      "outfit": string,          // short outfit description (gender-appropriate)
      "caption": string,         // ready-to-post caption with the influencer's voice
      "hashtags": string[],      // 8-15 hashtags WITH '#' prefix
      "cta": string              // short call to action
    }
  ]
}
ONLY output valid JSON. No markdown fences, no commentary.`;

export function buildContentPlanSystemPrompt(ctx: ContentPlanContext): string {
  const langLabel = LANGUAGE_LABELS[ctx.language] ?? ctx.language;
  const tone = ctx.tone ?? NICHE_TONES[ctx.niche] ?? "authentique";
  const platforms = ctx.platforms.join(", ");
  const totalPosts = ctx.days * ctx.postsPerDay;

  return [
    `You are an elite social media strategist creating a ${ctx.days}-day editorial plan for an AI virtual influencer.`,
    `Influencer profile:`,
    `- Name: ${ctx.influencerName}`,
    `- Gender: ${ctx.influencerGender}`,
    `- Niche: ${ctx.niche}`,
    `- Personality: ${ctx.personality}`,
    `- Bio: ${ctx.bio}`,
    `- Tone: ${tone}`,
    `- Output language for hooks/captions/CTAs: ${langLabel}`,
    `- Target platforms: ${platforms}`,
    ctx.goals ? `- Goal: ${ctx.goals}` : "",
    `Plan size: ${ctx.days} days × ${ctx.postsPerDay} post(s)/day = ${totalPosts} posts.`,
    "",
    "Constraints:",
    "- Vary scenes/poses/expressions across the week to avoid repetition.",
    "- Match the platform: TikTok → REEL with a 60-90 chars hook; Instagram → PHOTO/CAROUSEL/REEL; OnlyFans → intimate, opt-in tone (still SFW unless asked).",
    "- Outfits MUST match the influencer gender. NEVER suggest dresses/skirts/heels/makeup for male influencers.",
    "- Captions must sound like the same person talking, with their personality. Avoid generic phrases.",
    "- Stay SFW.",
    "",
    PLAN_JSON_SCHEMA_DESCRIPTION,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildIdeasSystemPrompt(ctx: IdeasContext): string {
  const langLabel = LANGUAGE_LABELS[ctx.language] ?? ctx.language;
  return [
    `You are an elite social media strategist generating fresh content ideas for an AI virtual influencer.`,
    `Name: ${ctx.influencerName}`,
    `Niche: ${ctx.niche}`,
    `Personality: ${ctx.personality}`,
    `Platform: ${ctx.platform}`,
    `Output language: ${langLabel}`,
    "",
    `Generate EXACTLY ${ctx.count} ideas as a JSON array of objects:`,
    `[
  { "hook": string, "concept": string, "type": "PHOTO" | "REEL" | "CAROUSEL", "scene": string }
]`,
    "Hooks must be scroll-stopping, < 90 chars. Vary scenes. Output ONLY valid JSON.",
  ].join("\n");
}

/** Reusable JSON repair instruction when the first call returns invalid JSON. */
export const JSON_REPAIR_INSTRUCTION =
  "Your previous answer was not valid JSON or did not match the requested schema. " +
  "Reply ONLY with the corrected, schema-compliant JSON. No markdown fences, no commentary.";
