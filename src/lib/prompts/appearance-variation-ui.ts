/**
 * Wizard "mode expert" — French chip labels + helpers for APPEARANCE_VARIATIONS.
 *
 * The English prompt strings live in `image-prompts.ts` (Replicate). This file
 * only maps pool indices → short French labels for the UI.
 *
 * Future — scraper bridge: `scraper-appearance-bridge.ts` can suggest chip
 * presets from Apify / Instagram trends; merge here via `applyScrapedHints()`.
 */

import {
  APPEARANCE_VARIATIONS,
  appearanceFingerprint,
  pickAppearanceVariations,
  type AppearanceVariation,
} from "@/lib/prompts/image-prompts";

export type AppearanceTraitKey = keyof typeof APPEARANCE_VARIATIONS;

export type AppearanceTraitSection = {
  key: AppearanceTraitKey;
  labelKey: string;
  options: Array<{ index: number; label: string }>;
};

/** French chip labels per pool index (order must match APPEARANCE_VARIATIONS). */
const FACE_SHAPE_FR = [
  "Ovale",
  "Cœur",
  "Rond",
  "Mâchoire carrée",
  "Diamant",
  "Ovale allongé",
];
const EYE_SHAPE_FR = [
  "Amande",
  "Ronds",
  "Paupières tombantes",
  "Enfoncés",
  "Écartés",
  "Monolid",
];
const EYE_COLOR_FR = [
  "Noisette",
  "Brun foncé",
  "Brun clair",
  "Vert",
  "Bleu",
  "Bleu-gris",
  "Ambre",
];
const NOSE_FR = [
  "Fin",
  "Petit retroussé",
  "Droit",
  "Romain doux",
  "Légèrement retroussé",
  "Pont fin",
];
const DISTINCTIVE_FR = [
  "Taches de rousseur",
  "Fossettes",
  "Grain de beauté",
  "Pommettes marquées",
  "Lèvres pulpeuses",
  "Sourcils fins",
  "Sourcils épais",
  "Diastème léger",
];
const EXPRESSION_FR = [
  "Sourire doux",
  "Regard neutre confiant",
  "Pensif",
  "Sourire en coin",
  "Serein",
  "Naturel détendu",
];

function optionsFor(
  key: AppearanceTraitKey,
  labels: readonly string[]
): AppearanceTraitSection["options"] {
  const len = APPEARANCE_VARIATIONS[key].length;
  return labels.slice(0, len).map((label, index) => ({ index, label }));
}

export const APPEARANCE_EXPERT_SECTIONS: AppearanceTraitSection[] = [
  { key: "faceShape", labelKey: "traitFace", options: optionsFor("faceShape", FACE_SHAPE_FR) },
  { key: "eyeShape", labelKey: "traitEyes", options: optionsFor("eyeShape", EYE_SHAPE_FR) },
  { key: "eyeColor", labelKey: "traitEyeColor", options: optionsFor("eyeColor", EYE_COLOR_FR) },
  { key: "distinctiveFeature", labelKey: "traitSignature", options: optionsFor("distinctiveFeature", DISTINCTIVE_FR) },
  { key: "expression", labelKey: "traitExpression", options: optionsFor("expression", EXPRESSION_FR) },
  // Nose last — less visible to users, keeps the panel scannable
  { key: "nose", labelKey: "traitNose", options: optionsFor("nose", NOSE_FR) },
];

/** Clamp indices to valid pool bounds (defensive for persisted JSON). */
export function normalizeAppearanceVariation(
  raw: Partial<AppearanceVariation> | null | undefined
): AppearanceVariation {
  const base = pickAppearanceVariations(() => 0);
  if (!raw) return base;
  const clamp = (key: AppearanceTraitKey, value: unknown) => {
    const max = APPEARANCE_VARIATIONS[key].length;
    const n = typeof value === "number" && Number.isInteger(value) ? value : 0;
    return Math.min(Math.max(0, n), max - 1);
  };
  return {
    faceShape: clamp("faceShape", raw.faceShape),
    eyeShape: clamp("eyeShape", raw.eyeShape),
    eyeColor: clamp("eyeColor", raw.eyeColor),
    nose: clamp("nose", raw.nose),
    distinctiveFeature: clamp("distinctiveFeature", raw.distinctiveFeature),
    expression: clamp("expression", raw.expression),
  };
}

export function randomAppearanceVariation(): AppearanceVariation {
  return pickAppearanceVariations();
}

export type WizardStyleForFingerprint = {
  gender?: string;
  ethnicity?: string;
  hairColor?: string;
  hairLength?: string;
  hairTexture?: string;
  bodyType?: string;
  fashionStyles?: string[];
};

/** Recompute fingerprint when expert chips change (matches server on generate). */
export function fingerprintFromWizard(
  age: number,
  style: WizardStyleForFingerprint,
  variations: AppearanceVariation
): string {
  const hairStyle =
    [style.hairLength, style.hairTexture].filter(Boolean).join(", ") ||
    (style.gender === "male" ? "short" : "long straight");
  return appearanceFingerprint(
    {
      gender: style.gender ?? "female",
      ethnicity: style.ethnicity || "caucasian",
      hairColor: style.hairColor || "brown",
      hairStyle,
      bodyType: style.bodyType || "average",
      fashionStyle: style.fashionStyles?.length
        ? style.fashionStyles.join(", ")
        : "casual",
    },
    age,
    variations
  );
}
