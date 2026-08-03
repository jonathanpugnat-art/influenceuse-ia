import type { AppearanceTraits, AppearanceVariation, Gender } from "./types";

export function genderLabel(gender: Gender): string {
  switch (gender) {
    case "male": return "man";
    case "nonbinary": return "person";
    default: return "woman";
  }
}

/** Base portrait template — high quality for face reference (wizard only).
 *
 * Identity disambiguation note: the template intentionally leaves room for a
 * `{distinct_traits}` slot. This slot is filled at build-time by
 * `pickAppearanceVariations()` with a random combination of face shape, eye
 * shape, eye color, nose, distinctive feature, and expression. Without it,
 * two users picking the same {age, ethnicity, hairColor, hairStyle, bodyType,
 * fashionStyle} would receive the SAME prompt byte-for-byte and the same
 * Flux 1.1 Pro seed → indistinguishable influencers.
 *
 * With ~6 axes × ~6 values each we get ~6^6 = ~46k visually distinct
 * combinations BEFORE the random seed kicks in. Combined with a random seed
 * per output, the collision probability drops below 1 in millions.
 */
/** Wizard base portrait — must match feed photos (iPhone UGC), not studio/editorial. */
export const BASE_PORTRAIT_TEMPLATE =
  "candid vertical iPhone portrait photo of a {age} year old {ethnicity} {gender}, " +
  "{skin_tone}, {height}, {hair_color} {hair_style} hair, {body_type} build, {proportions}, {makeup}, {tattoos}, {fashion_style} outfit, " +
  "{distinct_traits}, " +
  "shot on iPhone front camera or friend took it with flash, harsh natural flash, " +
  "real skin with visible pores and small blemishes, slightly oily T-zone, faint under-eye circles, " +
  "asymmetrical natural face, not retouched, not airbrushed, " +
  "slightly off-center amateur framing, mild grain, apartment or street background softly blurred, " +
  "NOT studio lighting, NOT vogue editorial, NOT beauty campaign, NOT doll-like, NOT plastic skin";

/**
 * Pools of subtle but visually meaningful traits we randomly mix into the
 * portrait prompt so every influencer ends up unique even when the wizard
 * inputs are identical. Each pool has ~5-8 entries chosen to keep the look
 * realistic (we don't want "purple eyes" or other fantasy traits that would
 * break the iPhone-photo aesthetic).
 *
 * Don't reorder these arrays — `pickAppearanceVariations` uses index-based
 * indices stored in the influencer's `appearanceFingerprint`. Adding new
 * entries at the END is safe.
 */
export const APPEARANCE_VARIATIONS = {
  faceShape: [
    "oval face shape",
    "heart-shaped face",
    "round face shape",
    "square jawline",
    "diamond face shape",
    "long oval face",
  ],
  eyeShape: [
    "almond-shaped eyes",
    "round expressive eyes",
    "hooded eyes",
    "deep-set eyes",
    "wide-set eyes",
    "monolid eyes",
  ],
  eyeColor: [
    "hazel eyes",
    "deep brown eyes",
    "light brown eyes",
    "green eyes",
    "blue eyes",
    "grey-blue eyes",
    "amber eyes",
  ],
  nose: [
    "delicate nose",
    "subtle button nose",
    "refined straight nose",
    "soft Roman nose profile",
    "slightly upturned nose",
    "narrow bridged nose",
  ],
  distinctiveFeature: [
    "very subtle freckles across the nose bridge",
    "soft dimples when relaxed",
    "small beauty mark near the lip",
    "high defined cheekbones",
    "slightly fuller lips",
    "thin arched eyebrows",
    "thicker natural eyebrows",
    "small gap between front teeth",
  ],
  expression: [
    "warm gentle smile",
    "confident neutral gaze",
    "soft thoughtful expression",
    "subtle playful smirk",
    "calm serene expression",
    "natural relaxed look",
  ],
} as const;

/**
 * Pick a random set of indices into APPEARANCE_VARIATIONS — deterministic if
 * a `random` function is provided (useful for tests + reproducible mock
 * influencers). Returns the indices so the caller can persist them on the
 * Influencer row and reproduce the same look later.
 */
export function pickAppearanceVariations(
  random: () => number = Math.random
): AppearanceVariation {
  const pickIdx = (len: number) => Math.floor(random() * len);
  return {
    faceShape: pickIdx(APPEARANCE_VARIATIONS.faceShape.length),
    eyeShape: pickIdx(APPEARANCE_VARIATIONS.eyeShape.length),
    eyeColor: pickIdx(APPEARANCE_VARIATIONS.eyeColor.length),
    nose: pickIdx(APPEARANCE_VARIATIONS.nose.length),
    distinctiveFeature: pickIdx(APPEARANCE_VARIATIONS.distinctiveFeature.length),
    expression: pickIdx(APPEARANCE_VARIATIONS.expression.length),
  };
}

/** Render the indices back into the comma-separated string the prompt expects. */
export function renderAppearanceVariations(v: AppearanceVariation): string {
  return [
    APPEARANCE_VARIATIONS.faceShape[v.faceShape],
    APPEARANCE_VARIATIONS.eyeShape[v.eyeShape],
    APPEARANCE_VARIATIONS.eyeColor[v.eyeColor],
    APPEARANCE_VARIATIONS.nose[v.nose],
    APPEARANCE_VARIATIONS.distinctiveFeature[v.distinctiveFeature],
    APPEARANCE_VARIATIONS.expression[v.expression],
  ].join(", ");
}

/**
 * Sprint 14 — UI-friendly breakdown of an AppearanceVariation. Returns each
 * trait individually so the wizard can render a labelled grid like:
 *   Visage   · oval face shape
 *   Yeux     · hazel eyes
 *   …
 * Used by `wizard-step-appearance.tsx` to surface the random traits to the
 * user (previously hidden) and let them re-roll a subset if they don't like.
 */
export function explodeAppearanceVariations(
  v: AppearanceVariation
): AppearanceTraits {
  return {
    faceShape: APPEARANCE_VARIATIONS.faceShape[v.faceShape] ?? "",
    eyeShape: APPEARANCE_VARIATIONS.eyeShape[v.eyeShape] ?? "",
    eyeColor: APPEARANCE_VARIATIONS.eyeColor[v.eyeColor] ?? "",
    nose: APPEARANCE_VARIATIONS.nose[v.nose] ?? "",
    distinctiveFeature:
      APPEARANCE_VARIATIONS.distinctiveFeature[v.distinctiveFeature] ?? "",
    expression: APPEARANCE_VARIATIONS.expression[v.expression] ?? "",
  };
}

/**
 * Stable fingerprint of an influencer's visual identity — combines the
 * deterministic style fields with the random variations. Two influencers
 * sharing the same fingerprint will look almost identical (modulo seed).
 * We use a short SHA-256 prefix to keep the column small and human-scanable.
 */
export function appearanceFingerprint(
  style: {
    gender?: string;
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
    bodyGenerationMode?: string;
  },
  age: number,
  variations: AppearanceVariation
): string {
  const payload = [
    age,
    style.gender ?? "female",
    style.ethnicity ?? "caucasian",
    style.skinTone ?? "medium",
    style.height ?? "average",
    style.hairColor ?? "brown",
    style.hairStyle ?? "long straight",
    style.bodyType ?? "average",
    style.bustLevel ?? 0,
    style.hipsLevel ?? 0,
    style.shouldersLevel ?? 0,
    (style.tattoos ?? []).join("+"),
    style.makeupLevel ?? "natural",
    style.bodyGenerationMode ?? "standard",
    style.fashionStyle ?? "casual",
    variations.faceShape,
    variations.eyeShape,
    variations.eyeColor,
    variations.nose,
    variations.distinctiveFeature,
    variations.expression,
  ].join("|");
  // Inline FNV-1a 32-bit — keeps us dependency-free (no crypto import for
  // such a low-stakes fingerprint). Returns 8 hex chars, e.g. "a3f1d20c".
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
