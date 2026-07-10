import type { WizardData } from "@/hooks/use-influencer-wizard";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";
import { applyStudioLook } from "@/lib/photo-studio-looks";
import type { PhotoCreatorSeed } from "@/hooks/use-photo-creator";

/** Derive a social handle from the influencer name (Instagram / OnlyFans style). */
export function deriveSocialUsername(name: string): string {
  const slug = (name || "creator")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "creator";
}

/** True when the wizard is primarily an OnlyFans / Premium creator flow. */
export function isOfPrimaryWizard(data: Pick<WizardData, "isNsfw" | "onlyfansEnabled">): boolean {
  return data.isNsfw || data.onlyfansEnabled;
}

/** Defaults applied when adult content is enabled in step 1. */
export function getNsfwWizardDefaults(
  data: Pick<WizardData, "name" | "niche" | "onlyfansUsername">
): Partial<WizardData> {
  const handle = data.onlyfansUsername?.trim() || deriveSocialUsername(data.name);
  return {
    isNsfw: true,
    niche: data.niche === "ADULT" || !data.niche?.trim() ? "ADULT" : data.niche,
    bodyGenerationMode: "extended",
    onlyfansEnabled: true,
    onlyfansUsername: handle,
    fashionStyles: ["Glamour"],
  };
}

/** Clear OF-specific fields when adult content is disabled. */
export function clearNsfwWizardDefaults(): Partial<WizardData> {
  return {
    isNsfw: false,
    onlyfansEnabled: false,
    onlyfansUsername: "",
    bodyGenerationMode: "standard",
  };
}

/** Ensure OF social defaults without overwriting an explicit username. */
export function ensureOfSocialDefaults(
  data: Pick<
    WizardData,
    "name" | "isNsfw" | "onlyfansEnabled" | "onlyfansUsername" | "niche"
  >
): Partial<WizardData> | null {
  if (!data.isNsfw) return null;

  const patch: Partial<WizardData> = {
    onlyfansEnabled: true,
    bodyGenerationMode: "extended",
  };

  if (!data.onlyfansUsername?.trim()) {
    patch.onlyfansUsername = deriveSocialUsername(data.name);
  }

  if (data.niche !== "ADULT" && !data.niche?.trim()) {
    patch.niche = "ADULT";
  }

  return patch;
}

/** Photo studio seed after wizard create for Premium influencers. */
export function buildWizardPremiumPhotoSeed(
  influencerId: string,
  gender: InfluencerGender
): PhotoCreatorSeed {
  return {
    influencerId,
    sceneFirst: false,
    ...applyStudioLook("boudoir-bedroom", gender, undefined, "NSFW"),
  };
}

/** Photo studio seed after wizard create for social influencers. */
export function buildWizardSocialPhotoSeed(
  influencerId: string,
  gender: InfluencerGender
): PhotoCreatorSeed {
  return {
    influencerId,
    sceneFirst: false,
    ...applyStudioLook("cafe-aesthetic", gender),
  };
}
