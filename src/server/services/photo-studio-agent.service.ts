import {
  buildFallbackAgentTurn,
  PHOTO_AGENT_SYSTEM_PROMPT,
  type PhotoAgentTurnInput,
  type PhotoAgentTurnOutput,
  validatePhotoAgentTurn,
  pickLooksForIntent,
} from "@/lib/photo-studio-agent";
import { getOutfitOptionsForLook } from "@/lib/photo-studio-looks";
import {
  viralBriefFromTrendPick,
  type TrendTopPick,
} from "@/lib/viral-brief";
import { callPhotoPromptJsonLLM } from "@/server/services/ai-text.service";
import { inferAdultLaneFromSignals } from "@/lib/text-provider-config";

export type PhotoStudioAgentTurnResult = PhotoAgentTurnOutput & {
  viralBrief?: ReturnType<typeof viralBriefFromTrendPick>;
};

function formatTrendsForPrompt(trends: TrendTopPick[]): string {
  if (!trends.length) return "";
  const lines = trends.map(
    (t, i) =>
      `${i + 1}. id=${t.id} | platform=${t.platform} | growth=${t.growthScore ?? 0} | title=${t.title} | tags=${t.hashtags.slice(0, 4).join(" ")} | scene=${t.sceneDescription ?? "n/a"} | mood=${t.mood ?? "n/a"} | camera=${t.cameraStyle ?? "n/a"}`
  );
  return ["Trending formats for this niche (suggest matching trendIds when relevant):", ...lines].join(
    "\n"
  );
}

function buildUserPrompt(
  input: PhotoAgentTurnInput,
  outfitOptions: string[],
  influencerBrief?: string,
  topTrends: TrendTopPick[] = []
): string {
  const lines = [
    `Locale: ${input.locale}`,
    `Gender: ${input.gender}`,
    `Content mode: ${input.contentMode ?? "SFW"}`,
    `Assistant turns so far: ${input.assistantTurnCount} (max 2 before brief)`,
    input.userMessage ? `Latest user message: ${input.userMessage}` : "",
    input.selectedTrendId ? `User selected trend id: ${input.selectedTrendId}` : "",
    input.selectedLookId ? `User selected look: ${input.selectedLookId}` : "",
    input.selectedOutfit ? `User selected outfit: ${input.selectedOutfit}` : "",
    outfitOptions.length
      ? `Available outfits for selected look:\n${outfitOptions.map((o) => `- ${o}`).join("\n")}`
      : "",
    input.history.length
      ? `Conversation:\n${input.history.map((m) => `${m.role}: ${m.content}`).join("\n")}`
      : "",
    input.selectedOutfit && input.selectedLookId
      ? "Set phase to ready and showBrief true."
      : input.selectedLookId
        ? "Set phase to outfits; pick 2-4 outfits from the available list."
        : input.selectedTrendId
          ? "User picked a viral format — set phase to looks; pick looks matching the trend vibe."
          : "Set phase to looks; pick up to 3 look ids matching user intent or trending formats.",
    influencerBrief?.trim()
      ? `INFLUENCER BRIEF:\n${influencerBrief.trim()}\n\nUse this brief to pick looks and outfits that match her positioning — do NOT suggest off-brand aesthetics (e.g. café aesthetic for a boudoir OF influencer).`
      : "",
    formatTrendsForPrompt(topTrends),
  ];
  return lines.filter(Boolean).join("\n\n");
}

function resolveViralBriefFromTrend(
  input: PhotoAgentTurnInput,
  topTrends: TrendTopPick[]
) {
  if (!input.selectedTrendId) return undefined;
  const pick = topTrends.find((t) => t.id === input.selectedTrendId);
  if (!pick) return undefined;
  return viralBriefFromTrendPick(pick, "studio_agent");
}

export async function runPhotoStudioAgentTurn(
  input: PhotoAgentTurnInput,
  opts?: { influencerBrief?: string; topTrends?: TrendTopPick[] }
): Promise<PhotoStudioAgentTurnResult> {
  const topTrends = opts?.topTrends ?? [];
  const outfitOptions = input.selectedLookId
    ? getOutfitOptionsForLook(input.selectedLookId, input.gender)
    : [];

  const viralBrief = resolveViralBriefFromTrend(input, topTrends);

  const fallback = buildFallbackAgentTurn(input, outfitOptions);

  if (input.selectedOutfit && input.selectedLookId) {
    return {
      ...fallback,
      phase: "ready",
      showBrief: true,
      viralBrief,
    };
  }

  if (input.selectedLookId && !input.selectedOutfit) {
    return { ...fallback, viralBrief };
  }

  if (input.selectedLookId && input.selectedOutfit) {
    return { ...fallback, viralBrief };
  }

  const hasLlm =
    Boolean(process.env.ANTHROPIC_API_KEY?.trim()) ||
    Boolean(process.env.DEEPSEEK_API_KEY?.trim());

  if (!hasLlm) {
    return { ...fallback, viralBrief };
  }

  try {
    const contentLane = inferAdultLaneFromSignals({
      contentMode: input.contentMode,
    });

    const parsed = await callPhotoPromptJsonLLM({
      contentLane,
      systemPrompt: PHOTO_AGENT_SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(
        input,
        outfitOptions,
        opts?.influencerBrief,
        topTrends
      ),
      maxTokens: 600,
      temperature: 0.45,
      validate: validatePhotoAgentTurn,
    });

    const validTrendIds = new Set(topTrends.map((t) => t.id));
    return {
      ...parsed,
      suggestedTrendIds: (parsed.suggestedTrendIds ?? []).filter((id) =>
        validTrendIds.has(id)
      ),
      viralBrief,
    };
  } catch (error) {
    console.warn("[photo-studio-agent] LLM failed, using fallback:", error);
    return { ...fallback, viralBrief };
  }
}
