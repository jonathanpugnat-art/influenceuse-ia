import type { ContentImageEngine } from "@/lib/prompts/nano-borderline";
import type { NicheVisualCodes } from "@/lib/niche-profile";

export type Gender = "female" | "male" | "nonbinary";
export type GenderedTemplate = {
  female: string;
  male: string;
  nonbinary: string;
};

export type AppearanceVariation = {
  faceShape: number;
  eyeShape: number;
  eyeColor: number;
  nose: number;
  distinctiveFeature: number;
  expression: number;
};

export interface AppearanceTraits {
  faceShape: string;
  eyeShape: string;
  eyeColor: string;
  nose: string;
  distinctiveFeature: string;
  expression: string;
}

export interface PromptBuildInput {
  gender?: Gender;
  age?: number;
  ethnicity?: string;
  hairColor?: string;
  hairStyle?: string;
  bodyType?: string;
  fashionStyle?: string;
  scene?: string;
  /** User-written environment; when set, replaces SCENE_TEMPLATES + accessories. */
  sceneDescription?: string;
  pose?: string;
  expression?: string;
  style?: string;
  lighting?: string;
  outfit?: string;
  location?: string;
  /** Reinforce same facial identity when a reference image is sent to the model (SFW path). */
  useReferenceFace?: boolean;
  isNsfw?: boolean;
  nsfwLevel?: string;
  customPrompt?: string;
  /**
   * Sprint 14 — shared visual DNA between the portrait wizard and the
   * content pipeline. When the influencer row has appearanceVariations
   * persisted (from Sprint 13), we re-inject them here so Kontext / Nano /
   * Flux all reproduce the same eyes, nose, freckles, cheekbones etc.
   * Without this, the base portrait and the feed posts can look like
   * "two different people" — Grok flagged this in the 2026-05-18 audit.
   */
  appearanceVariations?: AppearanceVariation;
  /**
   * When Kontext is chosen (borderline guard or Nano E005 fallback), we add
   * light framing hints so the feed stays cohesive without forcing wide shots.
   */
  contentEngine?: ContentImageEngine;
  /** Reference portrait URL (used upstream for face lock; not injected in text). */
  baseImageUrl?: string;

  // Style v2 (extended wizard JSON)
  skinTone?: string;
  height?: string;
  makeupLevel?: string;
  bustLevel?: number;
  hipsLevel?: number;
  shouldersLevel?: number;
  tattoos?: string[];
  piercings?: string[];
  hairCut?: string;
  hairColorHex?: string;
  /** Free-text morphology direction from the wizard ("toned abs, small bust..."). */
  morphologyNotes?: string;
  /**
   * Alexya principle #3 — when a reference image (face-lock) or a trained LoRA
   * carries the body, the morphology MUST come from it, never from words.
   * When true, the subject block stops re-describing body shape (which fights
   * the reference and drifts post-to-post) and anchors it to the reference.
   */
  lockBodyToReference?: boolean;

  trendContext?: {
    title?: string;
    hashtags?: string[];
    brief?: {
      cameraStyle?: string;
      lighting?: string;
      mood?: string;
      inspirationNotes?: string;
    };
    inspirationImageUrls?: string[];
  };

  /** Creative director brief from influencer row. */
  influencerBrief?: string;

  /**
   * Niche-specific visual codes (settings / wardrobe / lighting / palette /
   * framing) resolved from the niche preset + agent profile. Injected as
   * gated fallbacks so explicit scene/outfit/lighting always win.
   */
  nicheVisuals?: NicheVisualCodes;
}

export type NegativePromptOptions = { lockFace?: boolean };
