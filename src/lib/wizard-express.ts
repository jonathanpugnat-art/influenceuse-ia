import { pickRandomInfluencerName } from "@/lib/influencer-name-suggestions";
import {
  fingerprintFromWizard,
  randomAppearanceVariation,
} from "@/lib/prompts/appearance-variation-ui";
import {
  diversifyTemplate,
  INFLUENCER_TEMPLATES,
  type InfluencerTemplate,
} from "@/lib/templates/influencer-templates";
import type { WizardData } from "@/hooks/use-influencer-wizard";

/** Default persona for express creation (~30s). */
export const EXPRESS_TEMPLATE_ID = "fitness_girl";

export function getExpressTemplate(): InfluencerTemplate {
  const tpl =
    INFLUENCER_TEMPLATES.find((t) => t.id === EXPRESS_TEMPLATE_ID) ??
    INFLUENCER_TEMPLATES[0]!;
  return tpl;
}

/** Build wizard store patch for express mode (template + random name + traits). */
export function buildExpressWizardPatch(
  random: () => number = Math.random
): Partial<WizardData> {
  const tpl = getExpressTemplate();
  const diversified = diversifyTemplate(tpl, random, 0.4);
  const name = pickRandomInfluencerName();
  const age = diversified.defaults.age ?? 24;
  const appearanceVariations = randomAppearanceVariation();
  const partial: Partial<WizardData> = {
    ...diversified.defaults,
    name,
    niche: diversified.defaults.niche ?? tpl.niche,
    instagramEnabled: true,
    tiktokEnabled: false,
    onlyfansEnabled: false,
    onlyfansUsername: "",
    appearanceVariations,
  };

  const fingerprint = fingerprintFromWizard(
    age,
    { ...partial, gender: partial.gender ?? "female" } as WizardData,
    appearanceVariations
  );

  return {
    ...partial,
    appearanceFingerprint: fingerprint,
  };
}
