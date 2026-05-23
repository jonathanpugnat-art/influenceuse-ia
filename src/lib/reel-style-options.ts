import type { ReelStylePreset } from "@/lib/prompts/video-prompts";

export type ReelStyleOption = {
  key: ReelStylePreset;
  titleKey:
    | "reelStyleNatural"
    | "reelStyleClassic"
    | "reelStyleStable"
    | "reelStyleTalking"
    | "reelStyleCreative";
  descKey:
    | "reelStyleNaturalDesc"
    | "reelStyleClassicDesc"
    | "reelStyleStableDesc"
    | "reelStyleTalkingDesc"
    | "reelStyleCreativeDesc";
  recommended?: boolean;
};

/** Order tuned for IG creators: natural first, talking head grouped, creative last. */
export const REEL_STYLE_OPTIONS: ReelStyleOption[] = [
  {
    key: "natural_motion",
    titleKey: "reelStyleNatural",
    descKey: "reelStyleNaturalDesc",
    recommended: true,
  },
  {
    key: "lip_sync",
    titleKey: "reelStyleTalking",
    descKey: "reelStyleTalkingDesc",
  },
  {
    key: "stable_face",
    titleKey: "reelStyleStable",
    descKey: "reelStyleStableDesc",
  },
  {
    key: "classic_motion",
    titleKey: "reelStyleClassic",
    descKey: "reelStyleClassicDesc",
  },
  {
    key: "creative",
    titleKey: "reelStyleCreative",
    descKey: "reelStyleCreativeDesc",
  },
];

export function reelStyleSelectSideEffects(
  key: ReelStylePreset
): Partial<{
  videoType: string;
  generateSceneFrame: boolean;
  audioUrl: string;
}> {
  if (key === "lip_sync") {
    return { videoType: "talking_head", generateSceneFrame: true };
  }
  return {};
}
