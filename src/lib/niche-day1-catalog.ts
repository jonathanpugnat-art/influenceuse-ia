import type { PhotoCreatorSeed } from "@/hooks/use-photo-creator";
import type { NicheCategory } from "@/lib/niche-profile";
import { NICHE_VISUAL_PRESETS } from "@/lib/niche-visual-presets";

export type Day1NicheSeed = {
  scene: string;
  sceneDescription: string;
  outfit: string;
  pose: string;
  expression: string;
  customPrompt: string;
};

/**
 * Single source of truth for the first photo after wizard create.
 * Derived from niche visual presets — no agent chat required.
 */
export const NICHE_DAY1_SEEDS: Record<NicheCategory, Day1NicheSeed> = {
  FITNESS: {
    scene: "nature",
    sceneDescription:
      "Sunny outdoor park after a morning run, holding a water bottle beside a path, soft natural daylight, energetic confident smile, vertical Instagram photo",
    outfit:
      "fitted athletic top and athletic pants, clean sporty lifestyle look, fully clothed",
    pose: "standing",
    expression: "smile",
    customPrompt:
      "authentic fitness creator photo, friendly energy, fully clothed, no mirror selfie",
  },
  FASHION: {
    scene: "urban",
    sceneDescription:
      "City sidewalk editorial moment, soft daylight, confident fashion pose near clean architecture, vertical Instagram photo",
    outfit:
      "curated chic outfit with tailored pieces, clean fashion look, fully clothed",
    pose: "standing",
    expression: "smile",
    customPrompt: "authentic fashion creator photo, editorial but natural, fully clothed",
  },
  LIFESTYLE: {
    scene: "cafe",
    sceneDescription:
      "Bright modern cafe, sitting at a wooden table with a latte, large window daylight, casual confident smile, vertical Instagram photo",
    outfit:
      "cream knit sweater and high-waist jeans, clean lifestyle fashion look, fully clothed",
    pose: "sitting",
    expression: "smile",
    customPrompt:
      "authentic lifestyle creator photo, fully clothed, friendly energy",
  },
  TRAVEL: {
    scene: "nature",
    sceneDescription:
      "Scenic coastal viewpoint, golden daylight, exploring with a warm smile, vertical Instagram travel photo",
    outfit: "light summer travel outfit, relaxed resort chic, fully clothed",
    pose: "standing",
    expression: "smile",
    customPrompt: "authentic travel creator photo, sunny and inviting, fully clothed",
  },
  TECH: {
    scene: "cafe",
    sceneDescription:
      "Clean modern desk setup by a window, laptop open, soft daylight, approachable smile, vertical Instagram photo",
    outfit: "smart casual monochrome top, clean tech creator look, fully clothed",
    pose: "sitting",
    expression: "smile",
    customPrompt: "authentic tech creator photo, crisp and friendly, fully clothed",
  },
  GAMING: {
    scene: "bedroom",
    sceneDescription:
      "Cozy streaming corner with soft ambient light, headset nearby, candid smile to camera, vertical Instagram photo",
    outfit: "casual streetwear hoodie look, comfortable gaming creator style, fully clothed",
    pose: "sitting",
    expression: "smile",
    customPrompt: "authentic gaming creator photo, friendly streamer energy, fully clothed",
  },
  ADULT: {
    scene: "bedroom",
    sceneDescription:
      "Softly lit apartment interior, elegant and intimate mood, tasteful waist-up framing, vertical Instagram photo",
    outfit: "elegant lounge outfit, tasteful and stylish, fully clothed",
    pose: "sitting",
    expression: "playful",
    customPrompt: "tasteful premium creator photo, elegant mood, fully clothed",
  },
  FOOD: {
    scene: "cafe",
    sceneDescription:
      "Bright modern kitchen counter, plating a colorful dish, soft natural daylight, warm smile, vertical Instagram photo",
    outfit: "clean simple top with casual apron vibe, food creator look, fully clothed",
    pose: "standing",
    expression: "smile",
    customPrompt: "authentic food creator photo, appetizing and warm, fully clothed",
  },
};

export function resolveNicheCategoryKey(
  niche?: string | null
): NicheCategory {
  const key = (niche ?? "").toUpperCase();
  if (key in NICHE_DAY1_SEEDS) return key as NicheCategory;
  return "LIFESTYLE";
}

/** Build day-1 studio seed from niche catalog (+ optional freeform angle). */
export function buildCatalogDay1PhotoSeed(
  influencerId: string,
  options?: {
    niche?: string | null;
    angle?: string | null;
    isNsfw?: boolean;
  }
): PhotoCreatorSeed {
  const category = resolveNicheCategoryKey(options?.niche);
  const base = NICHE_DAY1_SEEDS[category];
  const angle = options?.angle?.trim();
  const preset = NICHE_VISUAL_PRESETS[category];

  return {
    influencerId,
    lookId: null,
    scene: base.scene,
    sceneDescription: angle
      ? `${base.sceneDescription} Angle: ${angle}.`
      : base.sceneDescription,
    outfit: base.outfit || preset.wardrobe[0] || "",
    pose: base.pose,
    expression: base.expression,
    customPrompt: angle
      ? `${base.customPrompt}. Creator angle: ${angle}.`
      : base.customPrompt,
    useFaceReference: true,
    sceneFirst: false,
    instagramShot: false,
    contentMode: options?.isNsfw ? "NSFW" : "SFW",
    nsfwLevel: options?.isNsfw ? "suggestive" : undefined,
  };
}
