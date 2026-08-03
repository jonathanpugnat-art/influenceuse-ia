/**
 * Pre-generation guard for the Premium lane — delegates to Aura content policy.
 * @deprecated Import from `@/lib/content-safety/aura-content-policy` directly.
 */

import {
  assertAuraImagePromptAllowed,
  AuraContentPolicyError,
  type AuraNsfwTier,
} from "@/lib/content-safety/aura-content-policy";

export { AURA_HARD_BLOCKED_TERMS as PREMIUM_BLOCKED_TERMS } from "@/lib/content-safety/aura-content-policy";

export class PremiumPromptBlockedError extends AuraContentPolicyError {
  constructor(message: string) {
    super(message);
    this.name = "PremiumPromptBlockedError";
  }
}

export interface PremiumPromptGuardFields {
  scene?: string;
  sceneDescription?: string;
  outfit?: string;
  customPrompt?: string;
  location?: string;
}

export function findBlockedPremiumTerms(text: string): string[] {
  try {
    assertAuraImagePromptAllowed(
      {
        customPrompt: text,
      },
      "suggestive"
    );
    return [];
  } catch (error) {
    if (error instanceof AuraContentPolicyError) {
      return ["blocked"];
    }
    throw error;
  }
}

export function assertPremiumPromptAllowed(
  fields: PremiumPromptGuardFields,
  nsfwLevel: AuraNsfwTier = "suggestive"
): void {
  try {
    assertAuraImagePromptAllowed(fields, nsfwLevel);
  } catch (error) {
    if (error instanceof AuraContentPolicyError) {
      throw new PremiumPromptBlockedError(error.message);
    }
    throw error;
  }
}

/** Strip risky tokens that sometimes slip through enrichment (soft sanitize). */
export function sanitizePremiumPromptFragment(text: string): string {
  let out = text;
  for (const term of ["nude", "naked", "topless", "explicit", "porn", "xxx"]) {
    out = out.replace(new RegExp(`\\b${term}\\b`, "gi"), "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}
