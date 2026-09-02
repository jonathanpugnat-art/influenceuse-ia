import {
  APPEARANCE_MAP,
  mapAppearance,
  mapPiercings,
  mapProportionLevels,
  mapTattoos,
  mapWizardHairStyle,
} from "@/lib/prompts/appearance-map";
import {
  inferSceneContext,
  resolvePosePhrase,
} from "@/lib/photo-scene-pose";
import { genderLabel, renderAppearanceVariations } from "./appearance-variations";
import { NSFW_TEMPLATES } from "./negatives-nsfw";
import {
  EXPRESSION_TEMPLATES,
  LIGHTING_TEMPLATES,
  POSE_TEMPLATES,
  STYLE_TEMPLATES,
} from "./pose-style-catalog";
import { SCENE_ACCESSORIES, SCENE_TEMPLATES } from "./scene-catalog";
import type { Gender, PromptBuildInput } from "./types";

export function buildIdentityBlock(input: PromptBuildInput): string | null {
  if (!input.useReferenceFace) return null;
  return [
    "IDENTITY LOCK: same exact person as the reference photo,",
    "identical face shape, eyes, nose, mouth, jawline, skin tone and ethnicity,",
    "same person in a new pose and setting,",
    "not a lookalike, not a similar person,",
    "do not change age, gender, or ethnicity,",
    "do not beautify or smooth skin beyond a real iPhone photo",
  ].join(" ");
}

export function buildTechnicalBase(
  input: PromptBuildInput,
  selfieFraming: boolean
): string {
  if (selfieFraming) {
    return [
      "candid iPhone photo snapped by a friend,",
      "iPhone flash on, harsh direct frontal flash,",
      "slight flash overexposure on skin,",
      "sharp hard shadow cast behind on wall or floor,",
      "casual TikTok / Instagram story snapshot,",
      "real unposed authentic moment",
    ].join(" ");
  }

  return [
    "authentic Instagram photo taken by a friend with an iPhone,",
    "phone NOT visible in frame, NOT a mirror selfie,",
    "natural candid composition,",
    "real unposed social media photo,",
    "shot vertically in 4:5 Instagram format",
  ].join(" ");
}

export function buildSubjectBlock(input: PromptBuildInput): string {
  const gender: Gender = input.gender ?? "female";
  const genderWord = genderLabel(gender);
  const parts: string[] = [];

  const personParts: string[] = [`a ${genderWord}`];
  if (input.age) personParts.push(`${input.age} years old`);
  if (input.ethnicity?.trim()) {
    personParts.push(mapAppearance(APPEARANCE_MAP.ethnicity, input.ethnicity));
  }
  if (input.skinTone?.trim()) {
    personParts.push(
      `${mapAppearance(APPEARANCE_MAP.skinTone, input.skinTone)} skin tone`
    );
  }
  if (!input.lockBodyToReference && input.height?.trim()) {
    personParts.push(mapAppearance(APPEARANCE_MAP.height, input.height));
  }
  if (input.hairColor || input.hairStyle || input.hairCut?.trim()) {
    const colorEn = input.hairColor
      ? mapAppearance(APPEARANCE_MAP.hairColor, input.hairColor)
      : "";
    const styleEn = input.hairCut?.trim()
      ? input.hairCut.trim()
      : input.hairStyle
        ? mapWizardHairStyle(input.hairStyle)
        : "";
    const hexHint = input.hairColorHex?.trim()
      ? `color ${input.hairColorHex.trim()}`
      : "";
    personParts.push(
      `${[colorEn, styleEn, hexHint].filter(Boolean).join(" ")} hair`
    );
  }
  if (input.lockBodyToReference) {
    // Alexya principle #3: the body comes from the reference image / LoRA,
    // never from words. Re-describing "curvy build, fuller bust, wider hips"
    // here fights the reference and makes the morphology drift between posts.
    personParts.push(
      "exact same body shape, proportions, figure and curves as the reference image, keep her body unchanged"
    );
  } else {
    if (input.bodyType?.trim()) {
      personParts.push(
        `${mapAppearance(APPEARANCE_MAP.bodyType, input.bodyType)} build`
      );
    }
    const proportions = mapProportionLevels(
      {
        bustLevel: input.bustLevel,
        hipsLevel: input.hipsLevel,
        shouldersLevel: input.shouldersLevel,
      },
      { includeNeutral: false }
    );
    if (proportions) personParts.push(proportions);
    if (input.morphologyNotes?.trim()) {
      personParts.push(input.morphologyNotes.trim());
    }
  }
  if (input.fashionStyle?.trim()) {
    personParts.push(
      `${mapAppearance(APPEARANCE_MAP.fashionStyle, input.fashionStyle)} fashion style`
    );
  }
  parts.push(personParts.join(", "));

  if (input.appearanceVariations && !input.useReferenceFace) {
    parts.push(
      `facial details: ${renderAppearanceVariations(input.appearanceVariations)}`
    );
  }

  const tattooDesc = mapTattoos(input.tattoos);
  if (tattooDesc) parts.push(`with ${tattooDesc}`);

  const piercingDesc = mapPiercings(input.piercings);
  if (piercingDesc) parts.push(piercingDesc);

  const outfit = input.outfit?.trim();
  if (outfit) {
    parts.push(
      `wearing ${outfit}, outfit clearly visible,`,
      "full outfit details preserved, real fabric texture and folds"
    );
  }

  if (gender === "male") {
    parts.push("masculine man, masculine appearance, masculine clothing only");
  } else {
    parts.push("feminine woman, feminine appearance");
  }

  return parts.join(", ");
}

export function buildSceneBlock(input: PromptBuildInput): string {
  const parts: string[] = [];
  const gender: Gender = input.gender ?? "female";

  if (input.location?.trim()) {
    parts.push(
      `at ${input.location.trim()},`,
      "famous landmark visible in background,",
      "real recognizable location"
    );
  }

  const customScene = input.sceneDescription?.trim();
  if (customScene) {
    parts.push(`Scene: ${customScene}`);
  } else if (input.scene) {
    const scene = SCENE_TEMPLATES[input.scene] ?? input.scene;
    parts.push(scene);
    const accessoriesSet = SCENE_ACCESSORIES[input.scene];
    if (accessoriesSet) parts.push(accessoriesSet[gender]);
  }

  if (input.lighting) {
    const light = LIGHTING_TEMPLATES[input.lighting] ?? input.lighting;
    parts.push(`Lighting: ${light}`);
  }

  if (input.trendContext?.title || input.trendContext?.hashtags?.length) {
    const ctx = [
      input.trendContext.title,
      input.trendContext.hashtags?.slice(0, 3).join(" "),
    ]
      .filter(Boolean)
      .join(" — ");
    if (ctx) parts.push(`inspired by trending content: ${ctx}`);
  }

  const trendBrief = input.trendContext?.brief;
  if (trendBrief?.lighting) parts.push(`trend lighting: ${trendBrief.lighting}`);
  if (trendBrief?.cameraStyle) {
    parts.push(`trend camera: ${trendBrief.cameraStyle}`);
  }
  if (trendBrief?.mood?.trim()) {
    parts.push(`mood: ${trendBrief.mood.trim()}`);
  }
  if (trendBrief?.inspirationNotes?.trim()) {
    parts.push(
      `viral format inspiration: ${trendBrief.inspirationNotes.trim()}`
    );
  }
  if ((input.trendContext?.inspirationImageUrls?.length ?? 0) > 0) {
    parts.push(
      "COMPOSITION REFERENCE: extra images show a viral post that already worked. Recreate the same framing, lighting, pose energy and setting with the identity-reference person only. Never copy the other face, body, tattoos or clothing logos."
    );
  }

  appendNicheVisuals(parts, input);

  return parts.join(", ");
}

/**
 * Inject niche-specific realism as gated fallbacks: explicit scene, location,
 * lighting and outfit always win; the niche codes only fill what the request
 * left unspecified, plus low-weight framing/palette flavor.
 */
function appendNicheVisuals(parts: string[], input: PromptBuildInput): void {
  const nv = input.nicheVisuals;
  if (!nv) return;

  const hasExplicitScene = Boolean(
    input.sceneDescription?.trim() || input.scene || input.location?.trim()
  );
  if (!hasExplicitScene && nv.settings.length > 0) {
    parts.push(`niche setting: ${nv.settings.slice(0, 2).join(" or ")}`);
  }
  if (!input.lighting && nv.lighting.trim()) {
    parts.push(`Lighting: ${nv.lighting.trim()}`);
  }
  if (!input.outfit?.trim() && nv.wardrobe.length > 0) {
    parts.push(`typical wardrobe: ${nv.wardrobe.slice(0, 2).join(" or ")}`);
  }
  if (nv.framing.length > 0) parts.push(`niche framing: ${nv.framing[0]}`);
  if (nv.palette.length > 0) {
    parts.push(`color palette: ${nv.palette.slice(0, 3).join(", ")}`);
  }
}

export function buildActionBlock(input: PromptBuildInput): string | null {
  const gender: Gender = input.gender ?? "female";
  const sceneContext = inferSceneContext({
    scene: input.scene,
    sceneDescription: input.sceneDescription,
  });
  const parts: string[] = [];

  if (input.expression) {
    const exprSet = EXPRESSION_TEMPLATES[input.expression];
    parts.push(exprSet ? exprSet[gender] : input.expression);
  }

  if (input.pose) {
    parts.push(
      resolvePosePhrase(input.pose, gender, sceneContext, POSE_TEMPLATES)
    );
  }

  if (input.style) {
    const entry = STYLE_TEMPLATES[input.style];
    parts.push(entry ? entry[gender] : input.style);
  }

  const customPrompt = input.customPrompt?.trim();
  const sceneDescription = input.sceneDescription?.trim();
  if (customPrompt && customPrompt !== sceneDescription) {
    parts.push(customPrompt);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildMoodBlock(
  input: PromptBuildInput,
  selfieFraming: boolean
): string {
  const parts: string[] = [];

  if (input.makeupLevel?.trim()) {
    const makeupKey = input.makeupLevel.trim().toLowerCase();
    if (makeupKey !== "naturel" && makeupKey !== "natural") {
      const makeupEn =
        APPEARANCE_MAP.makeupLevel[
          makeupKey as keyof typeof APPEARANCE_MAP.makeupLevel
        ] ?? input.makeupLevel;
      parts.push(makeupEn);
    }
  }

  if (input.influencerBrief?.trim()) {
    const briefKeywords = input.influencerBrief
      .slice(0, 200)
      .replace(/[^a-zA-ZÀ-ÿ\s,.-]/g, "")
      .trim();
    if (briefKeywords) {
      parts.push(`aesthetic direction: ${briefKeywords}`);
    }
  }

  if (selfieFraming) {
    parts.push(
      "real skin with visible pores and small blemishes,",
      "slightly oily T-zone shine, faint under-eye shadow,",
      "asymmetrical natural face, slight motion blur from handheld iPhone,",
      "mild grain, amateur framing not perfectly centered,",
      "candid not posed,",
      "looks like a real photo a friend just snapped for Instagram stories"
    );
  } else if (input.isNsfw) {
    parts.push(
      "intimate candid energy,",
      "real skin texture with visible pores and small imperfections,",
      "subtle uneven skin tone, no beauty filter,",
      "slight handheld tilt, mild grain,",
      "authentic amateur bedroom / lifestyle photo energy"
    );
  } else {
    parts.push(
      "natural Instagram aesthetic,",
      "real skin texture with pores and small imperfections,",
      "warm authentic mood, aspirational but attainable,",
      "candid social media framing,",
      "subject matches the described scene naturally"
    );
  }

  return parts.join(" ");
}

export function buildNsfwBlock(input: PromptBuildInput): string | null {
  if (!input.isNsfw || !input.nsfwLevel) return null;

  const outfit = input.outfit?.trim();
  if (outfit) {
    return [
      "sensual suggestive mood, tasteful,",
      "natural amateur photo energy,",
      "not glossy studio boudoir campaign",
    ].join(" ");
  }

  return NSFW_TEMPLATES[input.nsfwLevel] ?? null;
}

export function buildNegativeBlock(
  input: PromptBuildInput,
  selfieFraming: boolean
): string {
  const base = [
    "no studio lighting",
    "no professional photography setup",
    "no beauty retouching",
    "no airbrushing",
    "no plastic skin",
    "no doll face",
    "no AI glow",
    "no CGI look",
    "no waxy skin",
    "no magazine editorial",
    "no watermark",
    "no text overlay",
    "no multiple people in frame",
    "no morphed features",
    "no body horror",
  ];

  if (selfieFraming) {
    base.push(
      "not AI-perfect",
      "not smooth",
      "not glossy",
      "not magazine quality"
    );
  }

  if (input.isNsfw) {
    base.push(
      "not professional boudoir studio",
      "not glossy magazine retouch",
      "not plastic waxy skin",
      "not CGI render"
    );
  }

  if (!selfieFraming) {
    base.push(
      "not a mirror selfie",
      "not arm-length selfie",
      "not a passport photo",
      "not AI-perfect glamour"
    );
  }

  return base.join(", ");
}

export function buildEngineBlock(input: PromptBuildInput): string | null {
  if (input.contentEngine !== "kontext") return null;
  return [
    "medium shot from mid-torso up,",
    "face clearly visible and recognizable,",
    "natural candid Instagram story framing,",
    "subject fills most of the vertical frame,",
    "consistent skin tone with the reference person,",
    "real iPhone snapshot energy",
  ].join(" ");
}
