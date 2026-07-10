import type {
  NicheCategory,
  NicheProfile,
  NicheVisualCodes,
} from "@/lib/niche-profile";

/**
 * Default believable visual codes per niche. These give every influencer a
 * niche-true look out of the box (fitness gym ≠ OF boudoir ≠ food kitchen),
 * even before the agent has refined a `NicheProfile`. When a profile exists,
 * its codes take precedence (see `resolveNicheVisuals`).
 *
 * Phrases are kept short and prompt-injectable (English, image-model friendly).
 */
export const NICHE_VISUAL_PRESETS: Record<NicheCategory, NicheVisualCodes> = {
  FITNESS: {
    settings: ["modern gym", "outdoor track at sunrise", "home workout corner"],
    wardrobe: ["sports bra and leggings", "athletic crop top and shorts"],
    lighting: "bright natural daylight, energetic",
    palette: ["neutral grey", "athletic black", "warm sunrise"],
    framing: ["dynamic full-body shot", "mirror gym selfie"],
  },
  FASHION: {
    settings: ["minimalist studio", "city street with editorial backdrop", "boutique interior"],
    wardrobe: ["curated designer outfit", "tailored statement pieces"],
    lighting: "soft editorial studio light",
    palette: ["neutral beige", "monochrome", "muted earth tones"],
    framing: ["full-body fashion pose", "three-quarter editorial shot"],
  },
  LIFESTYLE: {
    settings: ["cozy sunlit apartment", "trendy coffee shop", "rooftop terrace"],
    wardrobe: ["casual chic everyday outfit", "comfy oversized knit"],
    lighting: "warm golden-hour daylight",
    palette: ["warm cream", "soft pastel", "natural wood"],
    framing: ["candid lifestyle shot", "relaxed waist-up portrait"],
  },
  TRAVEL: {
    settings: ["scenic coastal viewpoint", "historic old town street", "luxury resort poolside"],
    wardrobe: ["light summer travel outfit", "flowy resort dress"],
    lighting: "vibrant natural sunlight, blue sky",
    palette: ["ocean blue", "sandy beige", "sunset orange"],
    framing: ["wide environmental shot", "candid exploring pose"],
  },
  TECH: {
    settings: ["clean modern desk setup", "minimalist office", "studio with LED accents"],
    wardrobe: ["smart casual outfit", "clean monochrome top"],
    lighting: "crisp diffused light with subtle tech glow",
    palette: ["cool grey", "deep blue", "accent neon"],
    framing: ["desk-level talking-head shot", "product-in-hand close-up"],
  },
  GAMING: {
    settings: ["RGB-lit gaming setup", "neon bedroom studio", "streaming corner"],
    wardrobe: ["casual streetwear", "graphic tee and hoodie"],
    lighting: "moody ambient RGB lighting",
    palette: ["neon purple", "electric blue", "dark backdrop"],
    framing: ["headset webcam framing", "setup-in-background shot"],
  },
  ADULT: {
    settings: ["intimate bedroom", "luxury hotel suite", "softly lit apartment"],
    wardrobe: ["elegant lingerie", "silk robe"],
    lighting: "warm dim cinematic lighting",
    palette: ["warm amber", "deep red", "soft shadow"],
    framing: ["intimate boudoir framing", "suggestive waist-up portrait"],
  },
  FOOD: {
    settings: ["bright modern kitchen", "rustic dining table", "cozy cafe counter"],
    wardrobe: ["casual apron over everyday outfit", "clean simple top"],
    lighting: "soft natural kitchen daylight",
    palette: ["warm white", "fresh green", "appetizing tones"],
    framing: ["over-the-shoulder cooking shot", "plating close-up with subject"],
  },
};

function pickArray(
  override: string[] | undefined,
  base: string[] | undefined
): string[] {
  if (override && override.length > 0) return override;
  return base ?? [];
}

/**
 * Merge niche defaults with the agent's refined profile. Profile codes win
 * when present; otherwise the niche preset fills the gap. Returns `undefined`
 * only when neither a niche nor a profile is available.
 */
export function resolveNicheVisuals(
  niche: NicheCategory | undefined,
  profile?: NicheProfile | null
): NicheVisualCodes | undefined {
  const base = niche ? NICHE_VISUAL_PRESETS[niche] : undefined;
  const override = profile?.visualCodes;
  if (!base && !override) return undefined;

  return {
    settings: pickArray(override?.settings, base?.settings),
    wardrobe: pickArray(override?.wardrobe, base?.wardrobe),
    lighting: override?.lighting?.trim() || base?.lighting || "",
    palette: pickArray(override?.palette, base?.palette),
    framing: pickArray(override?.framing, base?.framing),
  };
}
