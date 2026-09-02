import { reelBriefFromTrendPick, trendTopPickFromItem } from "@/lib/viral-brief";
import { resolveTrendSourceVideoUrl } from "@/server/services/trend-video-storage.service";
import { db } from "@/server/db";
import { recommendationToCreatorParams } from "../apply/recommendation-params";

export type TrendReelHydration = {
  duration?: 15 | 30 | 60;
  format?: "VERTICAL" | "SQUARE";
  videoType?: string;
  script?: string;
  sceneDescription?: string;
  outfit?: string;
  music?: string;
  effects?: string[];
  textOverlay?: string;
  motionSourceVideoUrl?: string;
  fromTrend?: boolean;
};

/**
 * Rebuild trend metadata for generateReel when the client only sends ids.
 */
export async function hydrateTrendReelInput(opts: {
  influencerId: string;
  userId: string;
  trendItemId?: string;
  recommendationId?: string;
}): Promise<TrendReelHydration> {
  const { influencerId, userId, trendItemId, recommendationId } = opts;
  if (!trendItemId && !recommendationId) return {};

  if (recommendationId) {
    const rec = await db.trendRecommendation.findUnique({
      where: { id: recommendationId },
      include: {
        trendItem: {
          select: {
            id: true,
            hashtags: true,
            formatBrief: true,
            mediaKind: true,
            mediaUrls: true,
            soundName: true,
            sourceVideoUrl: true,
            thumbnailUrl: true,
            thumbnailUrlAlt: true,
            videoFrameUrls: true,
          },
        },
      },
    });
    if (!rec || rec.influencerId !== influencerId) return {};
    const influencer = await db.influencer.findFirst({
      where: { id: influencerId, userId },
      select: { isNsfw: true, gender: true },
    });
    if (!influencer) return {};

    const blob = recommendationToCreatorParams(
      {
        id: rec.id,
        trendItemId: rec.trendItemId,
        generatedFields: rec.generatedFields,
      },
      influencerId,
      rec.trendItem.hashtags,
      rec.trendItem,
      { isNsfw: influencer.isNsfw, gender: influencer.gender }
    );
    if (blob.target !== "reel") return {};
    return {
      duration: blob.duration,
      format: blob.format,
      videoType: blob.videoType,
      script: blob.script,
      sceneDescription: blob.sceneDescription,
      outfit: blob.outfit,
      music: blob.music,
      effects: blob.effects,
      textOverlay: blob.textOverlay,
      motionSourceVideoUrl: blob.motionSourceVideoUrl,
      fromTrend: blob.fromTrend,
    };
  }

  if (trendItemId) {
    const trendItem = await db.trendItem.findUnique({
      where: { id: trendItemId },
    });
    if (!trendItem) return {};
    const pick = trendTopPickFromItem(trendItem);
    const brief = reelBriefFromTrendPick(pick, influencerId, {
      soundName: trendItem.soundName,
      motionSourceVideoUrl: resolveTrendSourceVideoUrl(trendItem),
    });
    return {
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
      fromTrend: brief.fromTrend,
    };
  }

  return {};
}
