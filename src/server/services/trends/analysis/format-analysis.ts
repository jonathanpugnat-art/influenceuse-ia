import {
  analyzeTrendItemFormat,
  getTrendFormatBrief,
} from "@/server/services/trend-media-analysis.service";
import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import type { TrendItem } from "@/generated/prisma/client";
import type { TrendForPrompt } from "@/lib/prompts/trend-prompts";
import { TREND_FEED_TTL_HOURS } from "../constants";

export function trendPayloadFromItem(
  item: TrendItem,
  brief: ReturnType<typeof getTrendFormatBrief>
): TrendForPrompt {
  return {
    trendId: item.id,
    platform: item.platform,
    title: item.title,
    description: item.description ?? undefined,
    hashtags: item.hashtags,
    soundName: item.soundName ?? undefined,
    growthScore: item.growthScore ?? undefined,
    formatBrief: brief
      ? {
          contentType: brief.contentType,
          sceneDescription: brief.sceneDescription,
          pose: brief.pose,
          expression: brief.expression,
          outfit: brief.outfit,
          mood: brief.mood,
          hook: brief.hook,
          lighting: brief.lighting,
          cameraStyle: brief.cameraStyle,
          inspirationNotes: brief.inspirationNotes,
          customPrompt: brief.customPrompt,
          videoType: brief.videoType,
          reelStoryboard: brief.reelStoryboard,
          confidence: brief.confidence,
          analyzedFrom: brief.analyzedFrom,
        }
      : undefined,
  };
}

/** Run vision/text format analysis (idempotent unless force). */
export async function ensureTrendFormatAnalyzed(
  trendItemId: string,
  options?: { force?: boolean }
) {
  return analyzeTrendItemFormat(trendItemId, options);
}

/**
 * Analyze the visual format of the top unanalyzed trends (by growthScore).
 * Sequential + try/catch per item so one failure never aborts the batch.
 */
export async function analyzeTopTrendsFormat(limit: number): Promise<number> {
  if (limit <= 0) return 0;
  const freshSince = new Date(
    Date.now() - TREND_FEED_TTL_HOURS * 3600 * 1000
  );

  const visionCandidates = await db.trendItem.findMany({
    where: {
      formatBrief: { equals: Prisma.DbNull },
      fetchedAt: { gte: freshSince },
      thumbnailUrl: { not: null },
    },
    orderBy: [
      { likesCount: { sort: "desc", nulls: "last" } },
      { viewCount: { sort: "desc", nulls: "last" } },
      { growthScore: "desc" },
      { fetchedAt: "desc" },
    ],
    take: limit,
    select: { id: true },
  });

  let candidates = visionCandidates;
  if (candidates.length < limit) {
    const textOnly = await db.trendItem.findMany({
      where: {
        formatBrief: { equals: Prisma.DbNull },
        fetchedAt: { gte: freshSince },
        thumbnailUrl: null,
        id: { notIn: candidates.map((c) => c.id) },
      },
      orderBy: [
        { likesCount: { sort: "desc", nulls: "last" } },
        { viewCount: { sort: "desc", nulls: "last" } },
        { growthScore: "desc" },
        { fetchedAt: "desc" },
      ],
      take: limit - candidates.length,
      select: { id: true },
    });
    candidates = [...candidates, ...textOnly];
  }

  let analyzed = 0;
  for (const { id } of candidates) {
    try {
      await ensureTrendFormatAnalyzed(id);
      analyzed += 1;
    } catch (err) {
      console.warn(`[trends] format analysis failed for ${id}:`, err);
    }
  }
  return analyzed;
}
