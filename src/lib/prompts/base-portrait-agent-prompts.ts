import { z } from "zod";

export const BASE_PORTRAIT_AGENT_MODEL = "claude-haiku-4-5-20251001";

export const basePortraitRecommendSchema = z.object({
  recommendedIds: z.array(z.string()).max(3),
  rationale: z.string().max(280).optional(),
});

export type BasePortraitRecommendResult = z.infer<
  typeof basePortraitRecommendSchema
>;

export const BASE_PORTRAIT_AGENT_SYSTEM_PROMPT = `You are Aura — creative director for AI virtual influencers.

Given an influencer brief and a catalog of pre-generated base portraits, pick up to 3 portrait IDs that best match the brief's positioning, aesthetic, and monetization intent.

RULES:
- Only use IDs from the provided catalog — never invent IDs.
- Prefer portraits whose tags, ethnicity, and bodyType align with the brief vibe (premium OF, fitness coach, streetwear, cozy lifestyle, etc.).
- When brief mentions explicit ADULT/OF positioning, prefer isNsfw portraits if available in the catalog.
- Return 1-3 IDs ordered by best fit (best first). If none fit well, pick the closest 1-2 and explain briefly in rationale.
- Write rationale in the requested output language (fr or en), max 2 sentences.

Return STRICT JSON only:
{
  "recommendedIds": ["id1", "id2"],
  "rationale": "optional short explanation"
}`;

export function validateBasePortraitRecommend(
  raw: unknown
): BasePortraitRecommendResult {
  return basePortraitRecommendSchema.parse(raw);
}

export function buildBasePortraitRecommendUserPrompt(opts: {
  locale: "fr" | "en";
  niche: string;
  gender: string;
  brief: string;
  portraits: Array<{
    id: string;
    ethnicity: string;
    bodyType: string;
    isNsfw: boolean;
    tags: string[];
  }>;
}): string {
  const catalog = opts.portraits
    .map(
      (p, i) =>
        `${i + 1}. id=${p.id} | ethnicity=${p.ethnicity} | body=${p.bodyType} | nsfw=${p.isNsfw} | tags=${p.tags.join(", ") || "none"}`
    )
    .join("\n");

  return [
    `Output language for rationale: ${opts.locale === "fr" ? "French" : "English"}`,
    `Niche: ${opts.niche}`,
    `Gender: ${opts.gender}`,
    "",
    `INFLUENCER BRIEF:\n${opts.brief.trim()}`,
    "",
    "Catalog (pick up to 3 ids):",
    catalog,
  ].join("\n");
}
