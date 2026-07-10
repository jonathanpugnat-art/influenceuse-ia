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
      "sceneDescription": string, // 1-3 English sentences: concrete setting, lighting, mood, props
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
  const slotHint =
    ctx.postingHours && ctx.postingHours.length > 0
      ? `Preferred posting hours (UTC): ${ctx.postingHours.join(", ")}. Spread slots across morning/midday/evening when possible.`
      : "Space posts across the week — avoid clustering similar formats or angles on consecutive slots.";

  return [
    `You are a senior social media manager and editorial strategist — not a generic content generator.`,
    `Your job: build a ${ctx.days}-day plan that grows the account through intentional variety, rhythm, and voice consistency.`,
    "",
    `Influencer profile (study this deeply — every post must feel unmistakably like them):`,
    `- Name: ${ctx.influencerName}`,
    `- Gender: ${ctx.influencerGender}`,
    `- Niche: ${ctx.niche}`,
    `- Personality: ${ctx.personality}`,
    `- Bio: ${ctx.bio}`,
    `- Tone: ${tone}`,
    `- Output language for hooks, captions, CTAs, and summary: ${langLabel}`,
    `- Target platforms: ${platforms}`,
    ctx.goals ? `- Business goal: ${ctx.goals}` : "",
    `Plan size: ${ctx.days} days × ${ctx.postsPerDay} post(s)/day = ${totalPosts} posts.`,
    slotHint,
    "",
    "Strategic requirements:",
    "- FORMAT MIX: Rotate PHOTO, REEL, and CAROUSEL across the plan. Do NOT default every slot to PHOTO.",
    "  • REEL → TikTok-first or high-motion Instagram; strong 60–90 char hooks, trend-aware angles.",
    "  • CAROUSEL → educational, before/after, tips, or storytelling sequences (3–5 slides implied in concept).",
    "  • PHOTO → hero shots, lifestyle moments, and story-style vertical frames (ephemeral vibe in concept/caption — use type PHOTO, not a separate enum).",
    "- HOOK & ANGLE VARIETY: No two posts should open with the same hook pattern. Rotate: question, bold claim, micro-story, POV, myth-bust, list tease, behind-the-scenes, social proof.",
    "- PERSONALITY & NICHE: Tie every concept to the influencer's personality traits and niche codes. Reference their bio details when relevant. Avoid generic influencer filler.",
    "- WEEKLY RHYTHM: Distribute formats and moods across dayIndex — e.g. lighter/relatable mid-week, aspirational on weekends, value carousel early week, reel peak engagement days.",
    "- PLATFORM FIT: TikTok → prefer REEL; Instagram → mix PHOTO/CAROUSEL/REEL; OnlyFans → intimate opt-in tone (still SFW unless asked).",
    "- VISUAL VARIETY: Vary scenes, poses, expressions, and outfits across the week — no copy-paste setups.",
    "- sceneDescription: write concrete English visual direction (setting, lighting, mood, props) used by the image generator. Must align with concept, scene, outfit, and pose — never a generic preset.",
    "- VOICE: Captions must sound like one consistent person. Match personality in word choice, humor, and CTA style.",
    "- SAFETY: Stay SFW. Outfits MUST match the influencer gender. NEVER suggest dresses/skirts/heels/makeup for male influencers.",
    "",
    "Summary field (required strategy note):",
    `- Write "summary" as a 3–5 sentence strategy brief in ${langLabel}.`,
    "- Explain WHY this plan works for THIS influencer (niche + personality + goal).",
    "- Mention format mix, weekly rhythm, and the main content angles used. No bullet list — flowing prose.",
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
