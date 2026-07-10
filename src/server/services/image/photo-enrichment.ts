import { enrichPhotoPromptFields } from "@/server/services/photo-prompt-enrichment.service";
import type { ImageGenerationInput } from "./types";

async function resolveEnrichedSceneAndOutfit(input: {
  sceneDescription?: string;
  outfit?: string;
  trendContext?: ImageGenerationInput["trendContext"];
  isNsfw?: boolean;
  nsfwLevel?: string;
}): Promise<{ sceneDescription?: string; outfit?: string }> {
  const enriched = await enrichPhotoPromptFields(input);
  return {
    sceneDescription: enriched.sceneDescription || input.sceneDescription,
    outfit: enriched.outfit ?? input.outfit,
  };
}

export async function applyPhotoPromptEnrichment(
  input: ImageGenerationInput
): Promise<ImageGenerationInput> {
  const { sceneDescription, outfit } = await resolveEnrichedSceneAndOutfit({
    sceneDescription: input.sceneDescription,
    outfit: input.outfit,
    trendContext: input.trendContext,
    isNsfw: input.isNsfw,
    nsfwLevel: input.nsfwLevel,
  });
  return {
    ...input,
    sceneDescription,
    outfit: outfit ?? input.outfit,
  };
}

export { resolveEnrichedSceneAndOutfit };
