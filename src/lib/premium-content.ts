/**
 * OnlyFans / Premium lane — suggestive & soft boudoir only (no explicit porn).
 * Scoped for a single-influencer workflow; multi-tenant rules can extend later.
 */

import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import { pickDefaultPoseForScene } from "@/lib/photo-scene-pose";

export type ContentLane = "social" | "premium";

/** Allowed backend nsfwLevel values for the Premium lane. */
export const PREMIUM_NSFW_LEVELS = ["suggestive", "soft"] as const;
export type PremiumNsfwLevel = (typeof PREMIUM_NSFW_LEVELS)[number];

export function clampPremiumNsfwLevel(level: string | undefined): PremiumNsfwLevel {
  if (level === "soft") return "soft";
  return "suggestive";
}

export const PREMIUM_SCENE_DESCRIPTION =
  "intimate bedroom setting, soft warm lamp light, silk sheets, boudoir atmosphere, tasteful lingerie shoot, fully clothed in lingerie, not nude, not explicit";

export const PREMIUM_OUTFIT_SUGGESTIONS = [
  "Lingerie dentelle rouge",
  "Body noir satin",
  "Ensemble boudoir crème",
  "Robe de chambre soie ouverte",
  "Brassière et shorty assortis",
] as const;

export function laneFromContentMode(contentMode: "SFW" | "NSFW"): ContentLane {
  return contentMode === "NSFW" ? "premium" : "social";
}

/** Defaults when switching to OnlyFans / Premium (hot, non-explicit). */
export function getPremiumPhotoDefaults(currentPose?: string) {
  const scene = "bedroom";
  const sceneDescription = PREMIUM_SCENE_DESCRIPTION;
  return {
    contentMode: "NSFW" as const,
    nsfwLevel: "suggestive" as PremiumNsfwLevel,
    scene,
    sceneDescription,
    pose: pickDefaultPoseForScene({ scene, sceneDescription }, currentPose),
    expression: "seductive",
    photoStyle: "natural",
    timeOfDay: "natural",
    useFaceReference: false,
  };
}

/** Defaults when switching back to Instagram / TikTok. */
export function getSocialPhotoDefaults(currentPose?: string) {
  const scene = "studio";
  const sceneDescription = getSceneInspirationText(scene);
  return {
    contentMode: "SFW" as const,
    nsfwLevel: "suggestive",
    scene,
    sceneDescription,
    pose: pickDefaultPoseForScene({ scene, sceneDescription }, currentPose),
    expression: "smile",
    photoStyle: "natural",
    timeOfDay: "natural",
    useFaceReference: true,
  };
}
