import type { WizardData } from "@/hooks/use-influencer-wizard";

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
  return {
    name: data.name,
    gender: data.gender,
    bio: data.bio,
    personality: data.personality,
    brief: data.brief?.trim() || undefined,
    niche: data.niche as WizardCreateInput["niche"],
    age: data.age,
    style: {
      ethnicity: data.ethnicity || undefined,
      hairColor: data.hairColor || undefined,
      hairStyle:
        [data.hairLength, data.hairTexture].filter(Boolean).join(", ") ||
        undefined,
      bodyType: data.bodyType || undefined,
      fashionStyle: (data.fashionStyles ?? []).join(", ") || undefined,
      skinTone: data.skinTone || undefined,
      height: data.height || undefined,
      bustLevel: data.bustLevel,
      hipsLevel: data.hipsLevel,
      shouldersLevel: data.shouldersLevel,
      tattoos: data.tattoos?.length ? data.tattoos : undefined,
      makeupLevel: data.makeupLevel || undefined,
      bodyGenerationMode: data.bodyGenerationMode,
    },
    isNsfw: data.isNsfw,
    baseImageUrl: selectedImageUrl || undefined,
    avatarUrl: selectedImageUrl || undefined,
    appearanceVariations: data.appearanceVariations,
    appearanceFingerprint: data.appearanceFingerprint,
    socialAccounts: buildSocialAccounts(data),
  };
}
