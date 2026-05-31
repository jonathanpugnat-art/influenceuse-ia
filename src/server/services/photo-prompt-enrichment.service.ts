import { z } from "zod";
import { callJsonLLM } from "@/server/services/ai-text.service";
import {
  extractScenePropsSuffix,
  shouldEnrichForImagePrompt,
  stripScenePropsSuffix,
} from "@/lib/photo-scene-user";

const enrichResultSchema = z.object({
  sceneDescriptionEn: z.string().min(10).max(800),
  outfitEn: z.string().max(400).optional(),
});

export type PhotoPromptEnrichmentInput = {
  sceneDescription?: string;
  outfit?: string;
};

export type PhotoPromptEnrichmentResult = {
  sceneDescription: string;
  outfit?: string;
  enriched: boolean;
};

const SYSTEM_PROMPT = `You prepare text for an AI photo generator (English prompts work best).

Given a user's scene description (any language) and optional outfit, return strict JSON:
{
  "sceneDescriptionEn": "2-4 concrete English sentences: the setting (location, light, mood) AND any props or actions the user mentioned (candy, drinks, flowers, holding something, eating). If they mention an object, it must appear in the scene. Do not describe face, outfit, or camera type unless the user explicitly asked for mirror/selfie.",
  "outfitEn": "faithful English translation of the outfit if provided, else omit"
}

Rules:
- Preserve the user's intent exactly; do not invent unrelated locations or props.
- Keep suggestive / sexy / bikini / lingerie context if the user wrote it (SFW suggestive is OK). Only strip explicit pornographic acts.
- If input is already good English, lightly polish only — do not change meaning.
- No celebrities, real people, or @handles.`;

function appendPropsSuffix(enrichedCore: string, original: string): string {
  const props = extractScenePropsSuffix(original);
  if (!props) return enrichedCore.trim();
  return `${enrichedCore.trim()} ${props}`.trim();
}

/**
 * Translates / expands user scene (and outfit when needed) for image models.
 * Falls back to the original text if the LLM is unavailable.
 */
export async function enrichPhotoPromptFields(
  input: PhotoPromptEnrichmentInput
): Promise<PhotoPromptEnrichmentResult> {
  const rawScene = input.sceneDescription?.trim() ?? "";
  const rawOutfit = input.outfit?.trim() ?? "";

  if (!rawScene) {
    return { sceneDescription: "", outfit: rawOutfit || undefined, enriched: false };
  }

  if (!shouldEnrichForImagePrompt(rawScene, rawOutfit)) {
    return {
      sceneDescription: rawScene,
      outfit: rawOutfit || undefined,
      enriched: false,
    };
  }

  const sceneCore = stripScenePropsSuffix(rawScene);
  const userPrompt = [
    `Scene (user language, translate/expand faithfully):`,
    sceneCore,
    rawOutfit ? `\nOutfit (translate faithfully):\n${rawOutfit}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const parsed = await callJsonLLM({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 500,
      temperature: 0.25,
      validate: (raw) => enrichResultSchema.parse(raw),
      repairInstruction: "Return only valid JSON with sceneDescriptionEn string.",
    });

    const sceneDescription = appendPropsSuffix(parsed.sceneDescriptionEn, rawScene);
    const outfit =
      rawOutfit && parsed.outfitEn?.trim()
        ? parsed.outfitEn.trim()
        : rawOutfit || undefined;

    return { sceneDescription, outfit, enriched: true };
  } catch (error) {
    console.warn("[photo-prompt-enrichment] LLM failed, using raw text:", error);
    return {
      sceneDescription: rawScene,
      outfit: rawOutfit || undefined,
      enriched: false,
    };
  }
}
