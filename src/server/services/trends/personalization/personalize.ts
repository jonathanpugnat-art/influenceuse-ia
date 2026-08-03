import { mergeRecommendationWithBrief } from "@/lib/trends/trend-format-brief";
import { isVideoTrendItem } from "@/lib/trends/trend-video-items";
import { JSON_REPAIR_INSTRUCTION } from "@/lib/prompts/content-plan-prompts";
import {
  buildTrendPersonalizationPrompt,
  type TrendForPrompt,
} from "@/lib/prompts/trend-prompts";
import { softenSocialFitnessLanguage } from "@/lib/prompts/safety-soften";
import { getTrendFormatBrief } from "@/server/services/trend-media-analysis.service";
import { callTrendPersonalizationJsonLLM } from "@/server/services/ai-text.service";
import { db } from "@/server/db";
import type { Influencer, TrendItem } from "@/generated/prisma/client";
import {
  clampContentType,
  clampExpression,
  clampPlatform,
  clampPose,
  clampScene,
} from "../normalization";
import {
  ensureTrendFormatAnalyzed,
  trendPayloadFromItem,
} from "../analysis/format-analysis";
import {
  coerceLlmTrendRecommendations,
  type TrendRecommendationFields,
} from "../schemas";

/** Soften gym/fitness wording in SFW prompts so Haiku is less likely to refuse. */
function softenTrendPayloadForSfw(payload: TrendForPrompt): TrendForPrompt {
  const brief = payload.formatBrief;
  return {
    ...payload,
    title: softenSocialFitnessLanguage(payload.title),
    description: payload.description
      ? softenSocialFitnessLanguage(payload.description)
      : undefined,
    formatBrief: brief
      ? {
          ...brief,
          sceneDescription: softenSocialFitnessLanguage(brief.sceneDescription),
          outfit: softenSocialFitnessLanguage(brief.outfit),
          hook: softenSocialFitnessLanguage(brief.hook),
          mood: softenSocialFitnessLanguage(brief.mood),
          inspirationNotes: brief.inspirationNotes
            ? softenSocialFitnessLanguage(brief.inspirationNotes)
            : undefined,
          customPrompt: brief.customPrompt
            ? softenSocialFitnessLanguage(brief.customPrompt)
            : undefined,
        }
      : undefined,
  };
}

function buildPersonalizationPayload(
  items: TrendItem[],
  isNsfw: boolean
): TrendForPrompt[] {
  return items.map((t) => {
    const raw = trendPayloadFromItem(t, getTrendFormatBrief(t));
    return isNsfw ? raw : softenTrendPayloadForSfw(raw);
  });
}

export interface PersonalizationResult {
  created: number;
  recommendationIds: string[];
  llmModel: string;
}

/**
 * Generate (or refresh) LLM recommendations for an influencer over its
 * current feed. Caller is responsible for checking credits / plan.
 */
export async function personalizeFeedForInfluencer(
  influencer: Pick<
    Influencer,
    | "id"
    | "name"
    | "gender"
    | "niche"
    | "personality"
    | "bio"
    | "isNsfw"
  >,
  trendItems: TrendItem[],
  language: "fr" | "en"
): Promise<PersonalizationResult> {
  if (trendItems.length === 0) {
    return { created: 0, recommendationIds: [], llmModel: "skipped" };
  }

  const batch = trendItems.slice(0, 12);

  const payload: TrendForPrompt[] = buildPersonalizationPayload(
    batch,
    influencer.isNsfw
  );

  const { systemPrompt, userPrompt } = buildTrendPersonalizationPrompt(
    {
      influencerName: influencer.name,
      influencerGender:
        (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
      niche: influencer.niche,
      personality: influencer.personality,
      bio: influencer.bio,
      isNsfw: influencer.isNsfw,
      language,
    },
    payload
  );

  const { result: recs, llmModel } =
    await callTrendPersonalizationJsonLLM<TrendRecommendationFields[]>({
      isNsfw: influencer.isNsfw,
      systemPrompt,
      userPrompt,
      maxTokens: 3500,
      temperature: 0.55,
      repairInstruction: JSON_REPAIR_INSTRUCTION,
      validate: coerceLlmTrendRecommendations,
    });

  const byId = new Map(batch.map((t) => [t.id, t]));
  const ids: string[] = [];

  for (const rec of recs) {
    const trend = byId.get(rec.trendId);
    if (!trend) continue;

    const brief = getTrendFormatBrief(trend);
    let cleaned: TrendRecommendationFields = {
      ...rec,
      scene: clampScene(rec.scene),
      pose: clampPose(rec.pose),
      expression: clampExpression(rec.expression),
      type: clampContentType(rec.type),
      platform: clampPlatform(rec.platform),
      ...(influencer.isNsfw
        ? {}
        : {
            expression:
              rec.expression === "seductive"
                ? "playful"
                : clampExpression(rec.expression),
          }),
    };
    cleaned = mergeRecommendationWithBrief(cleaned, brief);
    if (brief?.sceneDescription) {
      cleaned.sceneDescription = brief.sceneDescription;
    }
    cleaned.trendTitle = trend.title;
    cleaned.trendHashtags = trend.hashtags;

    const upserted = await db.trendRecommendation.upsert({
      where: {
        influencerId_trendItemId: {
          influencerId: influencer.id,
          trendItemId: trend.id,
        },
      },
      create: {
        influencerId: influencer.id,
        trendItemId: trend.id,
        generatedHook: cleaned.hook,
        generatedFields: cleaned as unknown as object,
        llmModel,
      },
      update: {
        generatedHook: cleaned.hook,
        generatedFields: cleaned as unknown as object,
        llmModel,
        userDismissed: false,
      },
      select: { id: true },
    });
    ids.push(upserted.id);
  }

  return { created: ids.length, recommendationIds: ids, llmModel };
}

/**
 * Generate a recommendation for a SINGLE trend item.
 */
export async function personalizeSingleTrendForInfluencer(
  influencer: Pick<
    Influencer,
    "id" | "name" | "gender" | "niche" | "personality" | "bio" | "isNsfw"
  >,
  trendItem: TrendItem,
  language: "fr" | "en",
  options?: { skipFormatAnalysis?: boolean }
): Promise<{ recommendationId: string; llmModel: string }> {
  let item = trendItem;
  if (!options?.skipFormatAnalysis && !item.formatBrief) {
    try {
      await ensureTrendFormatAnalyzed(item.id);
      const refreshed = await db.trendItem.findUnique({
        where: { id: item.id },
      });
      if (refreshed) item = refreshed;
    } catch (e) {
      console.warn("[trends] format analysis skipped:", e);
    }
  }

  const brief = getTrendFormatBrief(item);
  const payload: TrendForPrompt[] = buildPersonalizationPayload(
    [item],
    influencer.isNsfw
  );

  const { systemPrompt, userPrompt } = buildTrendPersonalizationPrompt(
    {
      influencerName: influencer.name,
      influencerGender:
        (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
      niche: influencer.niche,
      personality: influencer.personality,
      bio: influencer.bio,
      isNsfw: influencer.isNsfw,
      language,
    },
    payload
  );

  const { result: recs, llmModel } =
    await callTrendPersonalizationJsonLLM<TrendRecommendationFields[]>({
      isNsfw: influencer.isNsfw,
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
      temperature: 0.55,
      repairInstruction: JSON_REPAIR_INSTRUCTION,
      validate: coerceLlmTrendRecommendations,
    });

  const rec = recs[0];
  if (!rec) {
    throw new Error("LLM returned no recommendation for the trend");
  }

  let cleaned: TrendRecommendationFields = {
    ...rec,
    trendId: trendItem.id,
    scene: clampScene(rec.scene),
    pose: clampPose(rec.pose),
    expression: influencer.isNsfw
      ? clampExpression(rec.expression)
      : rec.expression === "seductive"
        ? "playful"
        : clampExpression(rec.expression),
    type: clampContentType(rec.type),
    platform: clampPlatform(rec.platform),
  };
  cleaned = mergeRecommendationWithBrief(cleaned, brief);
  if (brief?.sceneDescription) {
    cleaned.sceneDescription = brief.sceneDescription;
  }
  cleaned.trendTitle = item.title;
  cleaned.trendHashtags = item.hashtags;
  if (brief?.contentType === "REEL") {
    cleaned.type = "REEL";
  } else if (isVideoTrendItem(item.mediaKind) && cleaned.type !== "PHOTO") {
    cleaned.type = "REEL";
  }

  const upserted = await db.trendRecommendation.upsert({
    where: {
      influencerId_trendItemId: {
        influencerId: influencer.id,
        trendItemId: trendItem.id,
      },
    },
    create: {
      influencerId: influencer.id,
      trendItemId: trendItem.id,
      generatedHook: cleaned.hook,
      generatedFields: cleaned as unknown as object,
      llmModel,
    },
    update: {
      generatedHook: cleaned.hook,
      generatedFields: cleaned as unknown as object,
      llmModel,
      userDismissed: false,
    },
    select: { id: true },
  });

  return { recommendationId: upserted.id, llmModel };
}
