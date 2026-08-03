import type { PhotoCreatorSeed } from "@/hooks/use-photo-creator";
import type { ReelParams } from "@/hooks/use-reel-creator";
import {
  briefToPromptContext,
  formatBriefToReelSeed,
  parseTrendFormatBrief,
  type TrendFormatBrief,
  type TrendPromptContext,
} from "@/lib/trends/trend-format-brief";
import type {
  ApplyToCreatorResult,
  ApplyToPhotoParamsResult,
} from "@/server/services/trends.service";

export type ViralBriefSource = "trend_apply" | "studio_agent" | "manual";

/** Unified brief carried from trends → reel studio → video generation. */
export type ReelBrief = {
  trendItemId?: string;
  recommendationId?: string;
  duration: 15 | 30 | 60;
  format: "VERTICAL" | "SQUARE";
  videoType: string;
  script: string;
  sceneDescription: string;
  outfit: string;
  music: string;
  effects: string[];
  textOverlay: string;
  hook?: string;
  hashtags?: string[];
  motionSourceVideoUrl?: string;
  fromTrend?: boolean;
  source: ViralBriefSource;
};

/** Unified brief carried from trends → studio agent → photo generation. */
export type ViralBrief = {
  trendItemId?: string;
  recommendationId?: string;
  title?: string;
  hashtags?: string[];
  hook?: string;
  scene: string;
  sceneDescription: string;
  pose: string;
  outfit: string;
  expression: string;
  customPrompt?: string;
  lookId?: string | null;
  instagramShot?: boolean;
  trendContext?: TrendPromptContext;
  source: ViralBriefSource;
};

export type TrendTopPick = {
  id: string;
  title: string;
  platform: string;
  growthScore: number | null;
  hashtags: string[];
  hook: string | null;
  sceneDescription: string | null;
  mood: string | null;
  cameraStyle: string | null;
  outfit: string | null;
  formatBrief: TrendFormatBrief | null;
};

export function viralBriefFromApplyPhoto(
  blob: ApplyToPhotoParamsResult,
  source: ViralBriefSource = "trend_apply"
): ViralBrief {
  return {
    trendItemId: blob.trendItemId,
    recommendationId: blob.recommendationId,
    title: blob.trendContext?.title,
    hashtags: blob.hashtags,
    hook: blob.hook,
    scene: blob.scene,
    sceneDescription: blob.sceneDescription,
    pose: blob.pose,
    outfit: blob.outfit,
    expression: blob.expression,
    customPrompt: blob.customPrompt || undefined,
    lookId: blob.lookId,
    instagramShot: blob.instagramShot,
    trendContext: blob.trendContext,
    source,
  };
}

export function viralBriefFromTrendPick(
  pick: TrendTopPick,
  source: ViralBriefSource = "studio_agent"
): ViralBrief {
  const brief = pick.formatBrief;
  const sceneDescription =
    brief?.sceneDescription?.trim() ||
    pick.sceneDescription?.trim() ||
    pick.title;

  return {
    trendItemId: pick.id,
    title: pick.title,
    hashtags: pick.hashtags,
    hook: pick.hook ?? brief?.hook ?? undefined,
    scene: brief ? "custom" : "custom",
    sceneDescription,
    pose: brief?.pose ?? "candid",
    outfit: brief?.outfit ?? pick.outfit ?? "",
    expression: brief?.expression ?? "natural",
    customPrompt: brief?.customPrompt || undefined,
    instagramShot: true,
    trendContext: briefToPromptContext(brief, pick.title, pick.hashtags),
    source,
  };
}

export function reelBriefFromApplyReel(
  blob: Extract<ApplyToCreatorResult, { target: "reel" }>,
  source: ViralBriefSource = "trend_apply"
): ReelBrief {
  return {
    trendItemId: blob.trendItemId,
    recommendationId: blob.recommendationId,
    duration: blob.duration,
    format: blob.format,
    videoType: blob.videoType,
    script: blob.script,
    sceneDescription: blob.sceneDescription,
    outfit: blob.outfit,
    music: blob.music,
    effects: blob.effects,
    textOverlay: blob.textOverlay,
    hook: blob.hook,
    hashtags: blob.hashtags,
    motionSourceVideoUrl: blob.motionSourceVideoUrl,
    fromTrend: blob.fromTrend,
    source,
  };
}

export function reelBriefFromTrendPick(
  pick: TrendTopPick,
  influencerId: string,
  opts?: {
    soundName?: string | null;
    motionSourceVideoUrl?: string | null;
  },
  source: ViralBriefSource = "trend_apply"
): ReelBrief {
  const brief = pick.formatBrief;
  if (brief) {
    const seed = formatBriefToReelSeed(brief, influencerId, pick.hashtags, {
      soundName: opts?.soundName ?? undefined,
      motionSourceVideoUrl: opts?.motionSourceVideoUrl ?? undefined,
    });
    return {
      trendItemId: pick.id,
      duration: seed.duration,
      format: seed.format,
      videoType: seed.videoType,
      script: seed.script,
      sceneDescription: seed.sceneDescription,
      outfit: seed.outfit,
      music: seed.music,
      effects: seed.effects,
      textOverlay: seed.textOverlay,
      hook: brief.hook || pick.hook || pick.title,
      hashtags: pick.hashtags,
      motionSourceVideoUrl: seed.motionSourceVideoUrl,
      fromTrend: seed.fromTrend,
      source,
    };
  }

  const sceneDescription =
    pick.sceneDescription?.trim() || pick.title;
  return {
    trendItemId: pick.id,
    duration: 15,
    format: "VERTICAL",
    videoType: "talking_head",
    script: pick.hook || pick.title,
    sceneDescription,
    outfit: pick.outfit ?? "",
    music: opts?.soundName?.trim() || "",
    effects: [],
    textOverlay: "",
    hook: pick.hook ?? undefined,
    hashtags: pick.hashtags,
    motionSourceVideoUrl: opts?.motionSourceVideoUrl ?? undefined,
    fromTrend: Boolean(opts?.motionSourceVideoUrl),
    source,
  };
}

export function reelBriefToReelCreatorParams(
  brief: ReelBrief,
  influencerId: string
): Partial<ReelParams> & { influencerId: string } {
  return {
    influencerId,
    duration: brief.duration,
    format: brief.format,
    videoType: brief.videoType,
    script: brief.script,
    sceneDescription: brief.sceneDescription,
    outfit: brief.outfit,
    music: brief.music,
    effects: brief.effects,
    textOverlay: brief.textOverlay,
    motionSourceVideoUrl: brief.motionSourceVideoUrl,
    fromTrend: brief.fromTrend ?? Boolean(brief.motionSourceVideoUrl),
    generateSceneFrame: true,
  };
}

export function viralBriefToPhotoCreatorSeed(
  brief: ViralBrief,
  influencerId: string
): PhotoCreatorSeed {
  return {
    influencerId,
    lookId: brief.lookId,
    instagramShot: brief.instagramShot ?? Boolean(brief.trendContext),
    scene: brief.scene,
    sceneDescription: brief.sceneDescription,
    pose: brief.pose,
    outfit: brief.outfit,
    expression: brief.expression,
    customPrompt: brief.customPrompt,
    caption: brief.hook,
    hashtags: brief.hashtags,
    trendContext: brief.trendContext,
    trendItemId: brief.trendItemId,
    recommendationId: brief.recommendationId,
    useFaceReference: true,
    sceneFirst: false,
  };
}

export function trendTopPickFromItem(item: {
  id: string;
  title: string;
  platform: string;
  growthScore: number | null;
  hashtags: string[];
  formatBrief: unknown;
}): TrendTopPick {
  const brief = parseTrendFormatBrief(item.formatBrief);
  return {
    id: item.id,
    title: item.title,
    platform: item.platform,
    growthScore: item.growthScore,
    hashtags: item.hashtags,
    hook: brief?.hook ?? null,
    sceneDescription: brief?.sceneDescription ?? null,
    mood: brief?.mood ?? null,
    cameraStyle: brief?.cameraStyle ?? null,
    outfit: brief?.outfit ?? null,
    formatBrief: brief,
  };
}
