import type { WizardData } from "@/hooks/use-influencer-wizard";
import { ensureWizardMinimumFields } from "@/lib/wizard-quick-defaults";
import type { NicheProfile } from "@/lib/niche-profile";

type WizardCreateInput = {
  name: string;
  gender: "female" | "male" | "nonbinary";
  bio: string;
  personality: string;
  brief?: string;
  niche:
    | "FASHION"
    | "FITNESS"
    | "LIFESTYLE"
    | "TRAVEL"
    | "TECH"
    | "GAMING"
    | "ADULT"
    | "FOOD";
  age: number;
  nicheProfile?: NicheProfile;
  style: {
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
    morphologyNotes?: string;
  };
  isNsfw: boolean;
  baseImageUrl?: string;
  avatarUrl?: string;
  appearanceVariations?: WizardData["appearanceVariations"];
  appearanceFingerprint?: string;
  socialAccounts?: Array<{
    platform: "INSTAGRAM" | "TIKTOK" | "ONLYFANS";
    username: string;
  }>;
};

function buildSocialAccounts(data: WizardData): WizardCreateInput["socialAccounts"] {
  const socialAccounts: NonNullable<WizardCreateInput["socialAccounts"]> = [];
  if (data.instagramEnabled && data.instagramUsername?.trim()) {
    socialAccounts.push({
      platform: "INSTAGRAM",
      username: data.instagramUsername.trim(),
    });
  }
  if (data.tiktokEnabled && data.tiktokUsername?.trim()) {
    socialAccounts.push({
      platform: "TIKTOK",
      username: data.tiktokUsername.trim(),
    });
  }
  if (data.onlyfansEnabled && data.onlyfansUsername?.trim()) {
    socialAccounts.push({
      platform: "ONLYFANS",
      username: data.onlyfansUsername.trim(),
    });
  }
  return socialAccounts.length > 0 ? socialAccounts : undefined;
}

export function buildWizardCreateInput(
  data: WizardData,
  selectedImageUrl: string | null | undefined
): WizardCreateInput {
  const filled = ensureWizardMinimumFields(data);
  return {
    name: filled.name,
    gender: filled.gender,
    bio: filled.bio,
    personality: filled.personality,
    brief: filled.brief?.trim() || undefined,
    niche: filled.niche as WizardCreateInput["niche"],
    age: filled.age,
    nicheProfile: filled.nicheProfile,
    style: {
      ethnicity: filled.ethnicity || undefined,
      hairColor: filled.hairColor || undefined,
      hairStyle:
        [filled.hairLength, filled.hairTexture].filter(Boolean).join(", ") ||
        undefined,
      bodyType: filled.bodyType || undefined,
      fashionStyle: (filled.fashionStyles ?? []).join(", ") || undefined,
      skinTone: filled.skinTone || undefined,
      height: filled.height || undefined,
      bustLevel: filled.bustLevel,
      hipsLevel: filled.hipsLevel,
      shouldersLevel: filled.shouldersLevel,
      tattoos: filled.tattoos?.length ? filled.tattoos : undefined,
      makeupLevel: filled.makeupLevel || undefined,
      bodyGenerationMode: filled.bodyGenerationMode,
      morphologyNotes: filled.morphologyNotes?.trim() || undefined,
    },
    isNsfw: filled.isNsfw,
    baseImageUrl: selectedImageUrl || undefined,
    avatarUrl: selectedImageUrl || undefined,
    appearanceVariations: filled.appearanceVariations,
    appearanceFingerprint: filled.appearanceFingerprint,
    socialAccounts: buildSocialAccounts(filled),
  };
}
