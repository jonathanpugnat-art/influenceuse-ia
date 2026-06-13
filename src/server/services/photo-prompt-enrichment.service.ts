import { z } from "zod";
import { callPhotoEnrichmentJsonLLM } from "@/server/services/ai-text.service";
import {
  extractScenePropsSuffix,
  shouldEnrichForImagePrompt,
  stripScenePropsSuffix,
} from "@/lib/photo-scene-user";

const enrichResultSchema = z.object({
  sceneDescriptionEn: z.string().min(10).max(800),
  outfitEn: z.string().max(400).optional(),
});

export type PhotoTrendContext = {
  title?: string;
  hashtags?: string[];
};

export type PhotoPromptEnrichmentInput = {
  sceneDescription?: string;
  outfit?: string;
  trendContext?: PhotoTrendContext;
};

export type PhotoPromptEnrichmentResult = {
  sceneDescription: string;
  outfit?: string;
  enriched: boolean;
};

const SYSTEM_PROMPT = `You prepare text for an AI photo generator (English prompts work best).

Given a user's scene description (any language) and optional outfit, return strict JSON:
{
  "sceneDescriptionEn": "2-4 concrete English sentences: setting, lighting, mood, atmosphere, pose energy, and any props or actions the user mentioned. Capture the aesthetic they asked for — do not substitute a different vibe.",
  "outfitEn": "faithful English translation of the outfit if provided, else omit"
}

Mood & aesthetic (critical):
- Preserve the user's intended mood and aesthetic EXACTLY as described (sexy, sensual, edgy, romantic, dark, playful, etc.).
- Do NOT sanitize, soften, or redirect suggestive intent into neutral "lifestyle" scenes.
- A "sexy bedroom" request must stay bedroom + sensual lighting/pose/atmosphere — NOT café, morning routine, or generic cozy vibes unless the user asked for those.
- Lingerie, bikini, boudoir, silk sheets, dim moody light, confident pose — keep all of that when the user implied it.

Safety boundary:
- Only remove genuinely explicit pornographic acts (graphic sex acts, nudity explicitly meant as hardcore porn).
- Suggestive / sensual / sexy SFW-adjacent content is allowed — post-generation moderation handles the rest.
- No celebrities, real people, or @handles.

Translation rules:
- If input is already good English, lightly polish only — do not change meaning.
- Do not invent unrelated locations, props, or moods the user did not imply.
- Do not describe face identity unless the user explicitly asked for mirror/selfie framing.
- If they mention an object or action, it must appear in the scene.`;

function appendPropsSuffix(enrichedCore: string, original: string): string {
  const props = extractScenePropsSuffix(original);
  if (!props) return enrichedCore.trim();
  return `${enrichedCore.trim()} ${props}`.trim();
}

function buildEnrichmentUserPrompt(opts: {
  sceneCore: string;
  rawOutfit: string;
  trendContext?: PhotoTrendContext;
}): string {
  const lines = [
    "Scene (user language, translate/expand faithfully):",
    opts.sceneCore,
  ];

  if (opts.rawOutfit) {
    lines.push("", "Outfit (translate faithfully):", opts.rawOutfit);
  }

  const title = opts.trendContext?.title?.trim();
  const hashtags = opts.trendContext?.hashtags?.filter(Boolean);
  if (title || (hashtags && hashtags.length > 0)) {
    lines.push(
      "",
      "Original trend context (for faithfulness, do not override user intent):"
    );
    if (title) lines.push(`Title: ${title}`);
    if (hashtags && hashtags.length > 0) {
      lines.push(`Hashtags: ${hashtags.join(", ")}`);
    }
  }

  return lines.join("\n");
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
  const userPrompt = buildEnrichmentUserPrompt({
    sceneCore,
    rawOutfit,
    trendContext: input.trendContext,
  });

  try {
    const parsed = await callPhotoEnrichmentJsonLLM({
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
