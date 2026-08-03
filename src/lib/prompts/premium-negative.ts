import {
  buildNegativePrompt,
  type Gender,
} from "@/lib/prompts/image-prompts";
import type { PremiumNsfwLevel } from "@/lib/premium-content";

/** Extra negatives to keep Premium suggestive/soft, not pornographic. */
export const PREMIUM_ANTI_EXPLICIT_NEGATIVE =
  "nude, naked, topless, bare breasts, exposed breasts, no bra, bra removed, " +
  "nipples, areola, genitals, penis, vagina, pussy, " +
  "explicit sex, sexual act, penetration, hardcore porn, pornography, xxx, " +
  "spread legs nude, fully exposed breasts, pubic hair visible, cum, ejaculation";

/** Stronger anti-AI look for explicit tier (no anti-nude — that fights the prompt). */
export const EXPLICIT_ANTI_PLASTIC_NEGATIVE =
  "plastic skin, waxy skin, rubber skin, doll face, mannequin, CGI, 3d render, " +
  "over-smoothed, airbrushed, beauty filter, uncanny valley, fake breasts, " +
  "malformed anatomy, oversaturated, ai generated look, rendered, lowres";

export const PREMIUM_REALISM_PREFIX =
  "RAW photo, candid smartphone mirror selfie, natural skin texture with visible pores, " +
  "slight skin imperfections, realistic soft indoor lighting, not retouched, not airbrushed, " +
  "not plastic skin, not doll-like, ";

/** Keeps every tier out of the dark/greasy-flash failure mode. */
export const PREMIUM_SKIN_EXPOSURE_NEGATIVE =
  "oily skin, greasy skin, sweaty skin, glossy skin, shiny forehead, " +
  "over-smoothed, airbrushed, beauty filter, harsh on-camera flash, " +
  "blown highlights, specular highlights, underexposed, too dark, murky, " +
  "muddy shadows, washed out, overexposed, hard shadow line, split lighting, " +
  "sunbeam, light stripe, harsh contrast";

/** Forces a body/scene framing instead of a tight face portrait. */
export const PREMIUM_FRAMING_NEGATIVE =
  "extreme close-up, face close-up, tight headshot, cropped at neck, " +
  "only face visible, passport photo, portrait crop";

export function buildPremiumNegativePrompt(
  gender: Gender = "female",
  options?: { lockFace?: boolean }
): string {
  return buildPremiumNegativePromptForTier("suggestive", gender, options);
}

export function buildPremiumNegativePromptForTier(
  tier: PremiumNsfwLevel,
  gender: Gender = "female",
  options?: { lockFace?: boolean }
): string {
  const base = buildNegativePrompt(true, gender, options);
  if (tier === "explicit") {
    return `${base}, ${EXPLICIT_ANTI_PLASTIC_NEGATIVE}, ${PREMIUM_SKIN_EXPOSURE_NEGATIVE}, ${PREMIUM_FRAMING_NEGATIVE}`;
  }
  return `${base}, ${PREMIUM_ANTI_EXPLICIT_NEGATIVE}, ${EXPLICIT_ANTI_PLASTIC_NEGATIVE}, ${PREMIUM_SKIN_EXPOSURE_NEGATIVE}, ${PREMIUM_FRAMING_NEGATIVE}`;
}

/** Prepends realism cues so premium engines avoid the waxy AI look. */
export function enrichPremiumPhotoPrompt(
  prompt: string,
  tier: PremiumNsfwLevel
): string {
  const trimmed = prompt.trim();
  if (!trimmed) return PREMIUM_REALISM_PREFIX.trim();
  if (tier === "explicit") {
    return `${PREMIUM_REALISM_PREFIX}${trimmed}`;
  }
  return `photorealistic RAW photo, natural skin texture, not plastic, ${trimmed}`;
}
