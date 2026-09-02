import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import {
  formatBriefToPhotoSeed,
  formatBriefToReelSeed,
  briefToPromptContext,
  mergeInspirationIntoContext,
  type TrendPromptContext,
} from "@/lib/trends/trend-format-brief";
import {
  inferStudioLookFromBrief,
  isVideoTrendItem,
  pickInspirationImageUrls,
} from "@/lib/trends/trend-video-items";
import { resolveTrendSourceVideoUrl } from "@/server/services/trend-video-storage.service";
import { applyStudioLook } from "@/lib/photo-studio-looks";
import { getTrendFormatBrief } from "@/server/services/trend-media-analysis.service";
import type { Influencer, TrendItem } from "@/generated/prisma/client";
import {
  clampContentType,
  clampExpression,
  clampPlatform,
  clampPose,
  clampScene,
} from "../normalization";
import {
  trendRecommendationFieldsSchema,
  type TrendRecommendationFields,
} from "../schemas";

export interface ApplyToPhotoParamsResult {
  type: "PHOTO" | "REEL" | "CAROUSEL";
  platform: "INSTAGRAM" | "TIKTOK" | "ONLYFANS";
  influencerId: string;
  scene: string;
  sceneDescription: string;
  pose: string;
  outfit: string;
  expression: string;
  customPrompt: string;
  hook: string;
  hashtags: string[];
  confidence: "high" | "medium" | "low";
  citations: string[];
  lookId?: string | null;
  instagramShot?: boolean;
  trendItemId: string;
  recommendationId: string;
  trendContext?: TrendPromptContext;
}

export type ApplyToCreatorResult =
  | (ApplyToPhotoParamsResult & { target: "photo" })
  | {
      target: "reel";
      influencerId: string;
      duration: 15 | 30 | 60;
      format: "VERTICAL" | "SQUARE";
      videoType: string;
      script: string;
      sceneDescription: string;
      outfit: string;
      music: string;
      effects: string[];
      textOverlay: string;
      hook: string;
      hashtags: string[];
      trendItemId: string;
      recommendationId: string;
      motionSourceVideoUrl?: string;
      fromTrend?: boolean;
    };

export function recommendationToPhotoParams(
  rec: { id: string; trendItemId: string; generatedFields: unknown },
  influencerId: string,
  hashtags: string[]
): ApplyToPhotoParamsResult {
  const parsed = trendRecommendationFieldsSchema.safeParse(rec.generatedFields);
  const fields: TrendRecommendationFields = parsed.success
    ? parsed.data
    : {
        trendId: rec.trendItemId,
        hook: "",
        concept: "",
        type: "PHOTO",
        platform: "INSTAGRAM",
        scene: "studio",
        pose: "portrait",
        expression: "natural",
        outfit: "",
        customPrompt: "",
        confidence: "low",
        citations: [],
      };

  const scene = clampScene(fields.scene);
  const sceneBase = getSceneInspirationText(scene);
  const customPrompt = fields.customPrompt?.trim() ?? "";
  const sceneDescription =
    fields.sceneDescription?.trim() || customPrompt || sceneBase;

  const trendTitle = fields.trendTitle?.trim();
  const trendHashtags =
    fields.trendHashtags && fields.trendHashtags.length > 0
      ? fields.trendHashtags
      : hashtags.length > 0
        ? hashtags
        : undefined;
  const trendContext =
    trendTitle || trendHashtags
      ? {
          title: trendTitle || undefined,
          hashtags: trendHashtags,
        }
      : undefined;

  return {
    type: clampContentType(fields.type),
    platform: clampPlatform(fields.platform),
    influencerId,
    scene,
    sceneDescription,
    pose: clampPose(fields.pose),
    outfit: fields.outfit,
    expression: clampExpression(fields.expression),
    customPrompt: fields.customPrompt,
    hook: fields.hook,
    hashtags,
    confidence: fields.confidence,
    citations: fields.citations,
    trendItemId: rec.trendItemId,
    recommendationId: rec.id,
    trendContext,
  };
}

export function recommendationToCreatorParams(
  rec: { id: string; trendItemId: string; generatedFields: unknown },
  influencerId: string,
  hashtags: string[],
  trendItem: Pick<
    TrendItem,
    | "formatBrief"
    | "mediaKind"
    | "sourceVideoUrl"
    | "mediaUrls"
    | "soundName"
    | "thumbnailUrl"
    | "thumbnailUrlAlt"
    | "videoFrameUrls"
  >,
  influencer: Pick<Influencer, "isNsfw" | "gender">
): ApplyToCreatorResult {
  const photoBlob = recommendationToPhotoParams(
    rec,
    influencerId,
    hashtags
  );
  const brief = getTrendFormatBrief(trendItem);
  const parsed = trendRecommendationFieldsSchema.safeParse(rec.generatedFields);
  const type = parsed.success ? parsed.data.type : photoBlob.type;
  const videoTrend = isVideoTrendItem(trendItem.mediaKind);
  const influencerIsNsfw = influencer.isNsfw;

  const applyAsReel =
    brief?.contentType === "REEL" ||
    (type === "REEL" && (brief !== null || videoTrend));

  if (applyAsReel) {
    const motionSourceVideoUrl =
      resolveTrendSourceVideoUrl(trendItem) ?? undefined;
    if (brief) {
      const reel = formatBriefToReelSeed(brief, influencerId, hashtags, {
        soundName: trendItem.soundName ?? undefined,
        motionSourceVideoUrl,
      });
      return {
        target: "reel",
        influencerId,
        duration: reel.duration,
        format: reel.format,
        videoType: reel.videoType,
        script: reel.script,
        sceneDescription: reel.sceneDescription,
        outfit: reel.outfit,
        music: reel.music,
        effects: reel.effects,
        textOverlay: reel.textOverlay,
        hook: photoBlob.hook,
        hashtags,
        trendItemId: rec.trendItemId,
        recommendationId: rec.id,
        motionSourceVideoUrl: reel.motionSourceVideoUrl,
        fromTrend: reel.fromTrend,
      };
    }
    return {
      target: "reel",
      influencerId,
      duration: 15,
      format: "VERTICAL",
      videoType: "talking_head",
      script: photoBlob.hook || photoBlob.sceneDescription,
      sceneDescription: photoBlob.sceneDescription,
      outfit: photoBlob.outfit,
      music: trendItem.soundName ?? "",
      effects: [],
      textOverlay: "",
      hook: photoBlob.hook,
      hashtags,
      trendItemId: rec.trendItemId,
      recommendationId: rec.id,
      motionSourceVideoUrl,
      fromTrend: Boolean(motionSourceVideoUrl),
    };
  }

  if (brief) {
    const premium = formatBriefToPhotoSeed(
      brief,
      influencerId,
      hashtags,
      influencerIsNsfw
    );
    const lookId = inferStudioLookFromBrief(brief);
    const gender =
      (influencer.gender as "female" | "male" | "nonbinary") ?? "female";
    const lookParams = lookId ? applyStudioLook(lookId, gender) : {};
    return {
      target: "photo",
      type: brief.contentType === "CAROUSEL" ? "CAROUSEL" : "PHOTO",
      platform: photoBlob.platform,
      influencerId,
      scene: lookParams.scene ?? premium.scene ?? photoBlob.scene,
      sceneDescription:
        premium.sceneDescription ?? photoBlob.sceneDescription,
      pose: premium.pose ?? lookParams.pose ?? photoBlob.pose,
      outfit: premium.outfit || lookParams.outfit || photoBlob.outfit,
      expression: premium.expression ?? lookParams.expression ?? photoBlob.expression,
      customPrompt: premium.customPrompt ?? photoBlob.customPrompt,
      hook: photoBlob.hook || brief.hook,
      hashtags,
      confidence: photoBlob.confidence,
      citations: photoBlob.citations,
      lookId: lookId ?? null,
      instagramShot: !influencerIsNsfw,
      trendItemId: rec.trendItemId,
      recommendationId: rec.id,
      trendContext: mergeInspirationIntoContext(
        briefToPromptContext(
          brief,
          photoBlob.trendContext?.title,
          photoBlob.trendContext?.hashtags ?? hashtags
        ),
        pickInspirationImageUrls(trendItem)
      ),
    };
  }

  return {
    target: "photo",
    ...photoBlob,
    instagramShot: videoTrend && !influencerIsNsfw,
    trendContext: mergeInspirationIntoContext(
      photoBlob.trendContext,
      pickInspirationImageUrls(trendItem)
    ),
  };
}
