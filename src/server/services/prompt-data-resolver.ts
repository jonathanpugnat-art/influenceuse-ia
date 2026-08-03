import type { AppearanceVariation } from "@/lib/prompts/image-prompts";
import type { Gender, PromptBuildInput } from "@/lib/prompts/image-prompts";
import { db } from "@/server/db";
import type { ImageGenerationInput } from "@/server/services/ai-image.service";
import { coerceNicheCategory, parseNicheProfile } from "@/lib/niche-profile";
import { resolveNicheVisuals } from "@/lib/niche-visual-presets";

export interface ResolvedPromptData extends PromptBuildInput {
  _resolved: true;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.toLowerCase() !== "aucun");
  return items.length > 0 ? items : undefined;
}

function readLevel(value: unknown): number | undefined {
  return typeof value === "number" && value >= -3 && value <= 3
    ? value
    : undefined;
}

function dedupeCustomPrompt(
  sceneDescription: string | undefined,
  customPrompt: string | undefined
): string | undefined {
  const scene = sceneDescription?.trim();
  const custom = customPrompt?.trim();
  if (!custom) return undefined;
  if (scene && custom === scene) return undefined;
  return custom;
}

/**
 * Collects every field required by `buildFullPrompt` from the influencer row
 * and the generation request — single source of truth for prompt assembly.
 */
export async function resolvePromptData(
  influencerId: string,
  input: ImageGenerationInput
): Promise<ResolvedPromptData> {
  const influencer = await db.influencer.findFirstOrThrow({
    where: { id: influencerId },
    select: {
      id: true,
      age: true,
      gender: true,
      brief: true,
      niche: true,
      nicheProfile: true,
      style: true,
      appearanceVariations: true,
      baseImageUrl: true,
      loraStatus: true,
      loraUrl: true,
    },
  });

  const style = (influencer.style as Record<string, unknown> | null) ?? {};

  const wantFaceLock = input.useReferenceFace !== false;
  const hasRefUrl = Boolean(input.baseImageUrl?.trim());
  const useIdentityPrompt = !input.isNsfw && wantFaceLock && hasRefUrl;

  // Alexya principle #3 — lock body morphology to whatever actually carries it
  // (a sent reference image, or a trained LoRA). When neither exists (pure T2I),
  // we still describe the body in words because there's nothing to inherit from.
  const hasReadyLora =
    influencer.loraStatus === "READY" && Boolean(influencer.loraUrl?.trim());
  const lockBodyToReference = useIdentityPrompt || hasReadyLora;

  const appearanceVariations =
    (influencer.appearanceVariations as AppearanceVariation | null) ??
    input.appearanceVariations ??
    undefined;

  const sceneDescription = input.sceneDescription?.trim() || undefined;
  const customPrompt = dedupeCustomPrompt(
    sceneDescription,
    input.customPrompt
  );

  const nicheCategory = coerceNicheCategory(influencer.niche);
  const nicheProfile = parseNicheProfile(influencer.nicheProfile, nicheCategory);
  const nicheVisuals = resolveNicheVisuals(nicheCategory, nicheProfile);

  return {
    _resolved: true,

    gender: (influencer.gender as Gender) ?? "female",
    age: influencer.age,
    ethnicity: readString(style.ethnicity),
    hairColor: readString(style.hairColor),
    hairStyle: readString(style.hairStyle),
    bodyType: readString(style.bodyType),
    fashionStyle: readString(style.fashionStyle),

    skinTone: readString(style.skinTone),
    height: readString(style.height),
    makeupLevel: readString(style.makeupLevel),
    bustLevel: readLevel(style.bustLevel),
    hipsLevel: readLevel(style.hipsLevel),
    shouldersLevel: readLevel(style.shouldersLevel),
    tattoos: readStringArray(style.tattoos),
    piercings: readStringArray(style.piercings),
    hairCut: readString(style.hairCut),
    hairColorHex: readString(style.hairColorHex),
    morphologyNotes: readString(style.morphologyNotes),

    appearanceVariations,

    useReferenceFace: useIdentityPrompt,
    lockBodyToReference,
    baseImageUrl: input.baseImageUrl,

    scene: input.scene,
    sceneDescription,
    pose: input.pose,
    expression: input.expression,
    style: input.style,
    lighting: input.lighting,
    outfit: input.outfit,
    location: input.location?.trim() || undefined,
    customPrompt,
    isNsfw: input.isNsfw,
    nsfwLevel: input.nsfwLevel,

    trendContext: input.trendContext,
    influencerBrief: influencer.brief?.trim() || undefined,
    nicheVisuals,
  };
}
