import { z } from "zod";

/**
 * Structured niche understanding produced by the wizard "niche brain" agent.
 *
 * Unlike the free-text `brief`, this profile is machine-actionable: its
 * `visualCodes` and `contentPillars` are injected into downstream photo/content
 * prompts so generation is realistic AND specific to the chosen niche
 * (a fitness coach gym shot ≠ an OF boudoir shot ≠ a food kitchen shot).
 *
 * The agent never writes wizard form fields — it only builds this profile.
 */

export const NICHE_CATEGORIES = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
] as const;

export type NicheCategory = (typeof NICHE_CATEGORIES)[number];

const NICHE_ALIASES: Record<string, NicheCategory> = {
  FASHION: "FASHION",
  MODE: "FASHION",
  FITNESS: "FITNESS",
  SPORT: "FITNESS",
  LIFESTYLE: "LIFESTYLE",
  TRAVEL: "TRAVEL",
  VOYAGE: "TRAVEL",
  TECH: "TECH",
  GAMING: "GAMING",
  JEUX: "GAMING",
  ADULT: "ADULT",
  OF: "ADULT",
  ONLYFANS: "ADULT",
  FOOD: "FOOD",
  CUISINE: "FOOD",
};

/** Coerce a free-form/localized niche string to a canonical category. */
export function coerceNicheCategory(value: unknown): NicheCategory | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const key = value.trim().toUpperCase();
  if ((NICHE_CATEGORIES as readonly string[]).includes(key)) {
    return key as NicheCategory;
  }
  return NICHE_ALIASES[key];
}

/**
 * Visual codes are the heart of niche-specific realism: short, prompt-injectable
 * phrases describing the believable look of content for this niche.
 */
export const nicheVisualCodesSchema = z.object({
  settings: z.array(z.string().max(80)).max(8).default([]),
  wardrobe: z.array(z.string().max(80)).max(8).default([]),
  lighting: z.string().max(160).default(""),
  palette: z.array(z.string().max(40)).max(8).default([]),
  framing: z.array(z.string().max(80)).max(8).default([]),
});

export type NicheVisualCodes = z.infer<typeof nicheVisualCodesSchema>;

const EMPTY_VISUAL_CODES: NicheVisualCodes = {
  settings: [],
  wardrobe: [],
  lighting: "",
  palette: [],
  framing: [],
};

export const nicheProfileSchema = z.object({
  nicheCategory: z.enum(NICHE_CATEGORIES),
  subNiche: z.string().max(120).default(""),
  purpose: z.string().max(400).default(""),
  targetAudience: z.string().max(400).default(""),
  tone: z.string().max(300).default(""),
  contentPillars: z.array(z.string().max(120)).max(6).default([]),
  visualCodes: nicheVisualCodesSchema.default(EMPTY_VISUAL_CODES),
  doNots: z.array(z.string().max(120)).max(8).default([]),
});

export type NicheProfile = z.infer<typeof nicheProfileSchema>;

/**
 * Lenient parse of an LLM/DB payload into a fully-defaulted profile.
 * Returns `null` when no usable niche category can be resolved (caller may
 * fall back to the form's niche). The agent builds the profile progressively,
 * so partial payloads are expected and tolerated.
 */
export function parseNicheProfile(
  raw: unknown,
  fallbackCategory?: NicheCategory
): NicheProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fallbackCategory
      ? nicheProfileSchema.parse({ nicheCategory: fallbackCategory })
      : null;
  }

  const obj = { ...(raw as Record<string, unknown>) };
  const category = coerceNicheCategory(obj.nicheCategory) ?? fallbackCategory;
  if (!category) return null;
  obj.nicheCategory = category;

  const result = nicheProfileSchema.safeParse(obj);
  if (result.success) return result.data;

  // Salvage: keep the category, drop malformed optional fields.
  return nicheProfileSchema.parse({ nicheCategory: category });
}

/** True once the profile carries enough signal to drive niche-specific output. */
export function isNicheProfileUsable(profile: NicheProfile | null): boolean {
  if (!profile) return false;
  const vc = profile.visualCodes;
  return Boolean(
    profile.subNiche.trim() ||
      profile.contentPillars.length > 0 ||
      vc.settings.length > 0 ||
      vc.wardrobe.length > 0
  );
}
