import {
  buildBasePortraitPrompt,
  type Gender,
  type AppearanceVariation,
} from "@/lib/prompts/image-prompts";
import type { IdentityPackRecord } from "@/lib/identity-pack";

export interface InfluencerStyle {
  gender?: Gender;
  ethnicity?: string;
  hairColor?: string;
  hairStyle?: string;
  bodyType?: string;
  fashionStyle?: string;
  skinTone?: string;
  height?: string;
  bustLevel?: number;
  hipsLevel?: number;
  shouldersLevel?: number;
  tattoos?: string[];
  makeupLevel?: string;
  bodyGenerationMode?: "standard" | "extended";
}

export interface ImageGenerationInput {
  influencerId: string;
  baseImageUrl?: string;
  useReferenceFace?: boolean;
  scene: string;
  sceneDescription?: string;
  pose: string;
  outfit: string;
  expression: string;
  style: string;
  lighting: string;
  location?: string;
  isNsfw: boolean;
  nsfwLevel?: string;
  customPrompt?: string;
  numberOfImages: number;
  appearanceVariations?: AppearanceVariation;
  omitCreditBilling?: boolean;
  isReelSceneFrame?: boolean;
  identityPack?: IdentityPackRecord | null;
  premiumFaceRefUrl?: string;
  /**
   * Pro/Agency trained LoRA weights URL. When present alongside
   * `loraTriggerWord`, the default face-lock path uses FLUX LoRA + wizard
   * portrait img2img instead of PuLID (max fidelity upgrade).
   */
  loraUrl?: string;
  loraTriggerWord?: string;
  instagramShot?: boolean;
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
}

export interface ImageGenerationOutput {
  imageUrls: string[];
  promptUsed: string;
  negativePrompt: string;
  promptWasSoftened?: boolean;
  parameters: Record<string, unknown>;
  appearanceVariations?: AppearanceVariation;
  appearanceFingerprint?: string;
}

export function buildPortraitPromptFromStyle(
  influencerAge: number,
  style: InfluencerStyle,
  variations?: AppearanceVariation
): string {
  return buildBasePortraitPrompt({
    age: influencerAge,
    gender: style.gender,
    ethnicity: style.ethnicity ?? "caucasian",
    hairColor: style.hairColor ?? "brown",
    hairStyle:
      style.hairStyle ?? (style.gender === "male" ? "short" : "long straight"),
    bodyType: style.bodyType ?? "average",
    fashionStyle: style.fashionStyle ?? "casual",
    skinTone: style.skinTone,
    height: style.height,
    bustLevel: style.bustLevel,
    hipsLevel: style.hipsLevel,
    shouldersLevel: style.shouldersLevel,
    tattoos: style.tattoos,
    makeupLevel: style.makeupLevel,
    variations,
  });
}
