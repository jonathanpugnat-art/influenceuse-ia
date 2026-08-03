import {
  BASE_PORTRAIT_AGENT_MODEL,
  BASE_PORTRAIT_AGENT_SYSTEM_PROMPT,
  buildBasePortraitRecommendUserPrompt,
  validateBasePortraitRecommend,
} from "@/lib/prompts/base-portrait-agent-prompts";
import { callAgentJsonLLM } from "@/server/services/ai-text.service";
import { inferAdultLaneFromSignals } from "@/lib/text-provider-config";

export async function recommendBasePortraitIds(input: {
  locale: "fr" | "en";
  niche: string;
  gender: string;
  brief: string;
  portraits: Array<{
    id: string;
    ethnicity: string;
    bodyType: string;
    isNsfw: boolean;
    tags: string[];
  }>;
}): Promise<{ recommendedIds: string[]; rationale?: string }> {
  if (!input.brief.trim() || input.portraits.length === 0) {
    return { recommendedIds: [] };
  }

  const contentLane = inferAdultLaneFromSignals({
    niche: input.niche,
    brief: input.brief,
  });

  const userPrompt = buildBasePortraitRecommendUserPrompt(input);

  try {
    const result = await callAgentJsonLLM({
      contentLane,
      systemPrompt: BASE_PORTRAIT_AGENT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 400,
      temperature: 0.3,
      anthropicModel: BASE_PORTRAIT_AGENT_MODEL,
      validate: validateBasePortraitRecommend,
      repairInstruction: "Return only valid JSON matching the schema.",
    });

    const validIds = new Set(input.portraits.map((p) => p.id));
    return {
      recommendedIds: result.recommendedIds
        .filter((id) => validIds.has(id))
        .slice(0, 3),
      rationale: result.rationale?.trim() || undefined,
    };
  } catch (error) {
    console.warn("[base-portrait-agent] LLM failed:", error);
    return { recommendedIds: [] };
  }
}
