import {
  trendTopPickFromItem,
  viralBriefFromTrendPick,
} from "@/lib/viral-brief";
import type { TrendPromptContext } from "@/lib/trends/trend-format-brief";
import { db } from "@/server/db";
import { recommendationToCreatorParams } from "../apply/recommendation-params";

export type TrendPhotoHydration = {
  trendContext?: TrendPromptContext;
  scene?: string;
  sceneDescription?: string;
  pose?: string;
  outfit?: string;
  expression?: string;
  customPrompt?: string;
  lookId?: string | null;
  instagramShot?: boolean;
};

/**
 * Rebuild trend metadata for generatePhoto when the client only sends ids.
 */
export async function hydrateTrendPhotoInput(opts: {
  influencerId: string;
  userId: string;
  trendItemId?: string;
  recommendationId?: string;
}): Promise<TrendPhotoHydration> {
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
    if (blob.target !== "photo") return {};
    return {
      trendContext: blob.trendContext,
      scene: blob.scene,
      sceneDescription: blob.sceneDescription,
      pose: blob.pose,
      outfit: blob.outfit,
      expression: blob.expression,
      customPrompt: blob.customPrompt,
      lookId: blob.lookId,
      instagramShot: blob.instagramShot,
    };
  }

  if (trendItemId) {
    const trendItem = await db.trendItem.findUnique({
      where: { id: trendItemId },
    });
    if (!trendItem) return {};
    const pick = trendTopPickFromItem(trendItem);
    const viral = viralBriefFromTrendPick(pick, "trend_apply");
    return {
      trendContext: viral.trendContext,
      scene: viral.scene,
      sceneDescription: viral.sceneDescription,
      pose: viral.pose,
      outfit: viral.outfit,
      expression: viral.expression,
      customPrompt: viral.customPrompt,
      instagramShot: viral.instagramShot,
    };
  }

  return {};
}
