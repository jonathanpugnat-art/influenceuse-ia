import type { ReelParams } from "@/hooks/use-reel-creator";
import {
  PREMIUM_PHOTO_SCENES,
  SUGGESTIVE_PHOTO_TERMS,
} from "@/lib/photo-intent-validation";
import { clampPremiumNsfwLevel } from "@/lib/premium-content";

export type ReelPromptComposeInput = {
  prompt: string;
  influencerIsNsfw: boolean;
  hasNsfwPlan: boolean;
};

export function inferReelContentModeFromPrompt(
  prompt: string,
  opts: Pick<ReelPromptComposeInput, "influencerIsNsfw" | "hasNsfwPlan">
): "SFW" | "NSFW" {
  const text = prompt.trim();
  if (!opts.hasNsfwPlan) return "SFW";
  if (opts.influencerIsNsfw) return "NSFW";
  if (SUGGESTIVE_PHOTO_TERMS.test(text) || PREMIUM_PHOTO_SCENES.test(text)) {
    return "NSFW";
  }
  return "SFW";
}

function inferVideoType(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b(grwm|get ready|prépare|maquillage|makeup)\b/.test(lower)) return "grwm";
  if (/\b(ootd|outfit|tenue|look du jour)\b/.test(lower)) return "ootd";
  if (/\b(gym|sport|workout|muscu|fitness)\b/.test(lower)) return "workout";
  if (/\b(transition|cover lens|cover the lens)\b/.test(lower)) return "transition";
  if (/\b(coffee|café|matin|routine|day in)\b/.test(lower)) return "day_in_life";
  if (/\b(talking|parle|face cam|facecam)\b/.test(lower)) return "talking_head";
  if (/\b(mirror|miroir|selfie)\b/.test(lower)) return "grwm";
  return "talking_head";
}

function inferNsfwLevel(prompt: string): ReelParams["nsfwLevel"] {
  if (/\b(explicit|explicite|nude|nu\b)\b/i.test(prompt)) return "explicit";
  if (/\b(soft|provocat|sensuel|sexy)\b/i.test(prompt)) return "soft";
  return "suggestive";
}

function inferDefaultOutfit(prompt: string, contentMode: "SFW" | "NSFW"): string {
  if (contentMode === "NSFW") {
    if (/lingerie|dentelle|lace/i.test(prompt)) return "lingerie dentelle";
    if (/body|satin/i.test(prompt)) return "body satin noir";
    return "lingerie boudoir tasteful";
  }
  if (/gym|sport|workout/i.test(prompt)) return "legging et brassière sport";
  if (/café|coffee|matin/i.test(prompt)) return "pull oversized beige";
  if (/plage|beach/i.test(prompt)) return "robe de plage fluide";
  return "tenue casual influencer";
}

/** Turn one prompt into reel generation params. */
export function composeReelParamsFromPrompt(
  input: ReelPromptComposeInput
): Partial<ReelParams> {
  const prompt = input.prompt.trim();
  const contentMode = inferReelContentModeFromPrompt(prompt, input);
  const videoType = inferVideoType(prompt);

  return {
    contentMode,
    nsfwLevel:
      contentMode === "NSFW"
        ? clampPremiumNsfwLevel(inferNsfwLevel(prompt))
        : "suggestive",
    videoType,
    script: prompt,
    sceneDescription: prompt,
    outfit: inferDefaultOutfit(prompt, contentMode),
    duration: 15,
    format: "VERTICAL",
    generateSceneFrame: true,
    reelStylePreset: "natural_motion",
    music: "none",
    effects: [],
    textOverlay: "",
    audioUrl: "",
  };
}
