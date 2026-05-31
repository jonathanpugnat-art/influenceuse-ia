import {
  buildNegativePrompt,
  type Gender,
} from "@/lib/prompts/image-prompts";

/** Extra negatives to keep Premium suggestive, not pornographic. */
export const PREMIUM_ANTI_EXPLICIT_NEGATIVE =
  "nude, naked, topless, nipples, areola, genitals, penis, vagina, pussy, " +
  "explicit sex, sexual act, penetration, hardcore porn, pornography, xxx, " +
  "spread legs nude, fully exposed breasts, pubic hair visible, cum, ejaculation";

export function buildPremiumNegativePrompt(
  gender: Gender = "female",
  options?: { lockFace?: boolean }
): string {
  const base = buildNegativePrompt(true, gender, options);
  return `${base}, ${PREMIUM_ANTI_EXPLICIT_NEGATIVE}`;
}
