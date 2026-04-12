import Replicate from "replicate";
import { nanoid } from "nanoid";
import {
  buildBasePortraitPrompt,
  buildFullPrompt,
  buildNegativePrompt,
  DEFAULT_IMAGE_PARAMS,
  PORTRAIT_IMAGE_PARAMS,
  type PromptBuildInput,
} from "@/lib/prompts/image-prompts";
import { uploadFromUrl } from "@/server/services/storage.service";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface InfluencerStyle {
  ethnicity?: string;
  hairColor?: string;
  hairStyle?: string;
  bodyType?: string;
  fashionStyle?: string;
}

export interface ImageGenerationInput {
  influencerId: string;
  baseImageUrl?: string;
  scene: string;
  pose: string;
  outfit: string;
  expression: string;
  style: string;
  lighting: string;
  isNsfw: boolean;
  nsfwLevel?: string;
  customPrompt?: string;
  numberOfImages: number;
}

export interface ImageGenerationOutput {
  imageUrls: string[];
  promptUsed: string;
  negativePrompt: string;
  parameters: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Replicate SDK
// ──────────────────────────────────────────────

const MODEL_SFW = "black-forest-labs/flux-1.1-pro" as const;
const MODEL_NSFW = "lucataco/flux-dev-uncensored" as const;

const NSFW_ERROR_MESSAGE =
  "La génération a été bloquée par le filtre de sécurité. Essaie avec des paramètres différents (style, tenue).";

let _replicate: Replicate | null = null;

function getReplicate(): Replicate {
  if (!_replicate) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error(
        "REPLICATE_API_TOKEN is not configured. Set it in your .env file."
      );
    }
    _replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return _replicate;
}

function isNsfwFilterError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.toLowerCase().includes("nsfw") ||
    msg.toLowerCase().includes("safety") ||
    msg.toLowerCase().includes("content filtered")
  );
}

function extractUrl(item: unknown): string {
  const str = String(item);
  if (str.startsWith("http")) return str;
  if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    if (typeof obj.url === "function") {
      const u = String((obj.url as () => unknown)());
      if (u.startsWith("http")) return u;
    }
    if (typeof obj.url === "string" && obj.url.startsWith("http"))
      return obj.url;
    if (typeof obj.href === "string" && obj.href.startsWith("http"))
      return obj.href;
  }
  throw new Error(
    `Cannot extract URL from Replicate output: ${str.slice(0, 200)}`
  );
}

function extractOutputUrls(output: unknown): string[] {
  if (Array.isArray(output)) {
    return output.map(extractUrl);
  }
  return [extractUrl(output)];
}

/**
 * Sanitize params per model. NSFW models (flux-dev-uncensored) only accept:
 * prompt, width, height, num_inference_steps, guidance_scale, seed,
 * output_format, output_quality, go_fast, megapixels.
 */
function sanitizeParamsForModel(
  model: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  if (model === MODEL_NSFW) {
    const {
      safety_tolerance: _st,
      negative_prompt: _np,
      num_outputs: _no,
      image: _img,
      ip_adapter_scale: _ip,
      ...clean
    } = params;
    return clean;
  }
  return params;
}

async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>,
  retryWithSafePrompt = true
): Promise<string[]> {
  const replicate = getReplicate();
  const cleanInput = sanitizeParamsForModel(model, input);

  try {
    const output = await replicate.run(
      model as `${string}/${string}` | `${string}/${string}:${string}`,
      { input: cleanInput }
    );

    const urls = extractOutputUrls(output);
    if (urls.length === 0) {
      throw new Error("Replicate returned no output");
    }
    return urls;
  } catch (error) {
    if (isNsfwFilterError(error) && retryWithSafePrompt) {
      console.warn(
        "[ai-image] NSFW filter triggered, retrying with safe prompt prefix..."
      );
      const safeInput = {
        ...input,
        prompt: `professional portrait, fully clothed, appropriate, ${input.prompt}`,
      };
      return runReplicatePrediction(model, safeInput, false);
    }

    if (isNsfwFilterError(error)) {
      throw new Error(NSFW_ERROR_MESSAGE);
    }

    throw error;
  }
}

/**
 * Generate multiple images sequentially for models that don't support num_outputs.
 */
async function runMultiplePredictions(
  model: string,
  input: Record<string, unknown>,
  count: number
): Promise<string[]> {
  if (model === MODEL_SFW) {
    return runReplicatePrediction(model, { ...input, num_outputs: count });
  }

  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const urls = await runReplicatePrediction(model, {
      ...input,
      seed: Math.floor(Math.random() * 2147483647),
    });
    results.push(...urls);
  }
  return results;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate the initial base portrait images (4 variations) for a new influencer.
 */
export async function generateBaseImage(
  userId: string,
  influencerAge: number,
  style: InfluencerStyle
): Promise<ImageGenerationOutput> {
  const cost = CREDIT_COSTS.BASE_IMAGE;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
    );
  }

  const prompt = buildBasePortraitPrompt({
    age: influencerAge,
    ethnicity: style.ethnicity ?? "caucasian",
    hairColor: style.hairColor ?? "brown",
    hairStyle: style.hairStyle ?? "long straight",
    bodyType: style.bodyType ?? "average",
    fashionStyle: style.fashionStyle ?? "casual",
  });

  const negativePrompt = buildNegativePrompt(false);

  const params: Record<string, unknown> = {
    ...PORTRAIT_IMAGE_PARAMS,
    prompt,
    negative_prompt: negativePrompt,
    num_outputs: 4,
    safety_tolerance: 5,
  };

  try {
    console.log("[ai-image] Generating base image...");

    const outputUrls = await runMultiplePredictions(MODEL_SFW, params, 4);

    const storedUrls = await Promise.all(
      outputUrls.map(async (url, i) => {
        const filename = `base-${nanoid(6)}-${i}.jpg`;
        return uploadFromUrl(url, filename);
      })
    );

    await deductCredits(userId, cost);

    return {
      imageUrls: storedUrls,
      promptUsed: prompt,
      negativePrompt,
      parameters: params,
    };
  } catch (error) {
    console.error("[ai-image] generateBaseImage error:", error);
    throw error;
  }
}

/**
 * Generate a content image for posting.
 */
export async function generateContentImage(
  userId: string,
  influencerAge: number,
  influencerStyle: InfluencerStyle,
  input: ImageGenerationInput
): Promise<ImageGenerationOutput> {
  const numImages = Math.min(input.numberOfImages, 4);
  const cost = CREDIT_COSTS.PHOTO * numImages;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
    );
  }

  const promptInput: PromptBuildInput = {
    age: influencerAge,
    ethnicity: influencerStyle.ethnicity,
    hairColor: influencerStyle.hairColor,
    hairStyle: influencerStyle.hairStyle,
    bodyType: influencerStyle.bodyType,
    fashionStyle: influencerStyle.fashionStyle,
    scene: input.scene,
    pose: input.pose,
    expression: input.expression,
    style: input.style,
    lighting: input.lighting,
    outfit: input.outfit,
    isNsfw: input.isNsfw,
    nsfwLevel: input.nsfwLevel,
    customPrompt: input.customPrompt,
  };

  const prompt = buildFullPrompt(promptInput);
  const negativePrompt = buildNegativePrompt(input.isNsfw);
  const model = input.isNsfw ? MODEL_NSFW : MODEL_SFW;

  const params: Record<string, unknown> = {
    ...DEFAULT_IMAGE_PARAMS,
    prompt,
    negative_prompt: negativePrompt,
    num_outputs: numImages,
    safety_tolerance: input.isNsfw ? 6 : 5,
  };

  if (input.baseImageUrl) {
    params.image = input.baseImageUrl;
    params.ip_adapter_scale = 0.6;
  }

  try {
    console.log("[ai-image] Generating content image...");
    console.log("[ai-image] Model:", model);

    const outputUrls = await runMultiplePredictions(model, params, numImages);

    const storedUrls = await Promise.all(
      outputUrls.map(async (url, i) => {
        const filename = `content-${input.influencerId}-${nanoid(6)}-${i}.jpg`;
        return uploadFromUrl(url, filename);
      })
    );

    await deductCredits(userId, cost);

    return {
      imageUrls: storedUrls,
      promptUsed: prompt,
      negativePrompt,
      parameters: params,
    };
  } catch (error) {
    console.error("[ai-image] generateContentImage error:", error);
    throw error;
  }
}
