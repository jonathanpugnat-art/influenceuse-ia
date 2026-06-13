import {
  buildFallbackAgentTurn,
  PHOTO_AGENT_SYSTEM_PROMPT,
  type PhotoAgentTurnInput,
  type PhotoAgentTurnOutput,
  validatePhotoAgentTurn,
  pickLooksForIntent,
} from "@/lib/photo-studio-agent";
import { getOutfitOptionsForLook } from "@/lib/photo-studio-looks";
import { callPhotoPromptJsonLLM } from "@/server/services/ai-text.service";

function buildUserPrompt(
  input: PhotoAgentTurnInput,
  outfitOptions: string[],
  influencerBrief?: string
): string {
  const lines = [
    `Locale: ${input.locale}`,
    `Gender: ${input.gender}`,
    `Content mode: ${input.contentMode ?? "SFW"}`,
    `Assistant turns so far: ${input.assistantTurnCount} (max 2 before brief)`,
    input.userMessage ? `Latest user message: ${input.userMessage}` : "",
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
        : "Set phase to looks; pick up to 3 look ids matching user intent.",
    influencerBrief?.trim()
      ? `INFLUENCER BRIEF:\n${influencerBrief.trim()}\n\nUse this brief to pick looks and outfits that match her positioning — do NOT suggest off-brand aesthetics (e.g. café aesthetic for a boudoir OF influencer).`
      : "",
  ];
  return lines.filter(Boolean).join("\n\n");
}

export async function runPhotoStudioAgentTurn(
  input: PhotoAgentTurnInput,
  influencerBrief?: string
): Promise<PhotoAgentTurnOutput> {
  const outfitOptions = input.selectedLookId
    ? getOutfitOptionsForLook(input.selectedLookId, input.gender)
    : [];

  const fallback = buildFallbackAgentTurn(input, outfitOptions);

  if (input.assistantTurnCount >= 2 || (input.selectedOutfit && input.selectedLookId)) {
    return {
      ...fallback,
      phase: "ready",
      showBrief: true,
    };
  }

  if (input.selectedLookId && !input.selectedOutfit) {
    return fallback;
  }

  if (input.selectedLookId && input.selectedOutfit) {
    return fallback;
  }

  const hasLlm =
    Boolean(process.env.ANTHROPIC_API_KEY?.trim()) ||
    Boolean(process.env.DEEPSEEK_API_KEY?.trim());

  if (!hasLlm) {
    return fallback;
  }

  try {
    const llmResult = await callPhotoPromptJsonLLM({
      systemPrompt: PHOTO_AGENT_SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input, outfitOptions, influencerBrief),
      maxTokens: 400,
      temperature: 0.55,
      validate: validatePhotoAgentTurn,
    });

    if (llmResult.phase === "looks" && llmResult.suggestedLookIds.length === 0) {
      const looks = pickLooksForIntent(
        input.userMessage ?? "",
        3,
        input.contentMode ?? "SFW"
      );
      return {
        ...llmResult,
        suggestedLookIds: looks.map((l) => l.id),
      };
    }

    if (
      llmResult.phase === "outfits" &&
      llmResult.suggestedOutfits.length === 0 &&
      outfitOptions.length
    ) {
      return {
        ...llmResult,
        suggestedOutfits: outfitOptions.slice(0, 4),
      };
    }

    return llmResult;
  } catch (error) {
    console.warn("[photo-studio-agent] LLM failed, using fallback:", error);
    return fallback;
  }
}
