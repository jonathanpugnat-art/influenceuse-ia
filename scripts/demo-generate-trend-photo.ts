/**
 * Génère 1 photo de contenu pour la démo trends (même pipeline que generatePhoto).
 */

import {
  briefToPromptContext,
  formatBriefToPhotoSeed,
  parseTrendFormatBrief,
  type TrendFormatBrief,
} from "../src/lib/trends/trend-format-brief";
import { parseIdentityPack } from "../src/lib/identity-pack";
import type { AppearanceVariation } from "../src/lib/prompts/image-prompts";
import { resolvePublicMediaUrl } from "../src/server/lib/resolve-public-media-url";
import {
  generateContentImage,
  type InfluencerStyle,
} from "../src/server/services/ai-image.service";
import { softenSfwFitnessFields } from "../src/lib/prompts/safety-soften";
import type { ApplyToCreatorResult } from "../src/server/services/trends/apply/recommendation-params";
import type { Influencer, TrendItem } from "../src/generated/prisma/client";

export type DemoPhotoResult = {
  imageUrl: string;
  promptUsed: string;
  trendTitle: string;
  hook: string;
  /** True when Replicate blocked and we reused an existing Content row. */
  fromExisting?: boolean;
};

export async function generateDemoTrendPhoto(opts: {
  influencer: Pick<
    Influencer,
    | "id"
    | "userId"
    | "age"
    | "gender"
    | "style"
    | "baseImageUrl"
    | "avatarUrl"
    | "appearanceVariations"
    | "identityPack"
    | "isNsfw"
  >;
  trend: Pick<TrendItem, "title" | "hashtags" | "formatBrief">;
  personalizedHook: string;
  apply: ApplyToCreatorResult | null;
  skipBilling?: boolean;
}): Promise<DemoPhotoResult> {
  const brief = parseTrendFormatBrief(opts.trend.formatBrief);
  if (!brief) {
    throw new Error("formatBrief requis pour générer la photo démo");
  }

  const seed = formatBriefToPhotoSeed(
    brief,
    opts.influencer.id,
    opts.trend.hashtags,
    opts.influencer.isNsfw
  );

  const softened = softenSfwFitnessFields({
    sceneDescription: resolveSceneDescription(brief, opts.apply),
    outfit: resolveOutfit(brief, opts.apply),
    customPrompt: [
      opts.apply?.target === "photo"
        ? opts.apply.customPrompt
        : seed.customPrompt,
      `Hook overlay vibe: ${opts.personalizedHook}`,
    ]
      .filter(Boolean)
      .join(". "),
  });
  const sceneDescription = softened.sceneDescription ?? "";
  const outfit = softened.outfit ?? "";
  const customPrompt = softened.customPrompt ?? "";
  const pose = opts.apply?.target === "photo" ? opts.apply.pose : seed.pose;
  const expression =
    opts.apply?.target === "photo" ? opts.apply.expression : seed.expression;

  const rawRef =
    opts.influencer.baseImageUrl?.trim() ||
    opts.influencer.avatarUrl?.trim() ||
    undefined;
  const baseImageUrl = rawRef ? await resolvePublicMediaUrl(rawRef) : undefined;
  if (!baseImageUrl) {
    throw new Error(
      "Portrait de référence inaccessible — vérifie R2_PUBLIC_URL sur l'influenceuse"
    );
  }

  const styleJson = opts.influencer.style as Record<string, string> | null;
  const influencerStyle: InfluencerStyle = {
    gender: (opts.influencer.gender as "female" | "male" | "nonbinary") ?? "female",
    ethnicity: styleJson?.ethnicity,
    hairColor: styleJson?.hairColor,
    hairStyle: styleJson?.hairStyle,
    bodyType: styleJson?.bodyType,
    fashionStyle: styleJson?.fashionStyle,
  };

  const appearanceVariations =
    (opts.influencer.appearanceVariations as AppearanceVariation | null) ??
    undefined;
  const identityPack = parseIdentityPack(opts.influencer.identityPack);

  const result = await generateContentImage(
    opts.influencer.userId,
    opts.influencer.age,
    influencerStyle,
    {
      influencerId: opts.influencer.id,
      baseImageUrl,
      useReferenceFace: true,
      scene: seed.scene,
      sceneDescription,
      pose,
      outfit,
      expression,
      style: seed.photoStyle,
      lighting: seed.timeOfDay,
      isNsfw: false,
      customPrompt,
      numberOfImages: 1,
      appearanceVariations,
      identityPack,
      instagramShot: false,
      trendContext: briefToPromptContext(
        brief,
        opts.trend.title,
        opts.trend.hashtags
      ),
      omitCreditBilling: opts.skipBilling === true,
    }
  );

  const imageUrl = result.imageUrls[0];
  if (!imageUrl) {
    throw new Error("generateContentImage n'a retourné aucune image");
  }

  return {
    imageUrl,
    promptUsed: result.promptUsed,
    trendTitle: opts.trend.title,
    hook: opts.personalizedHook,
  };
}

function resolveSceneDescription(
  brief: TrendFormatBrief,
  apply: ApplyToCreatorResult | null
): string {
  if (apply?.target === "photo" && apply.sceneDescription?.trim()) {
    return apply.sceneDescription;
  }
  if (apply?.target === "reel" && apply.sceneDescription?.trim()) {
    return apply.sceneDescription;
  }
  return brief.sceneDescription;
}

function resolveOutfit(
  brief: TrendFormatBrief,
  apply: ApplyToCreatorResult | null
): string {
  if (apply?.target === "photo" && apply.outfit?.trim()) return apply.outfit;
  if (apply?.target === "reel" && apply.outfit?.trim()) return apply.outfit;
  return brief.outfit;
}
