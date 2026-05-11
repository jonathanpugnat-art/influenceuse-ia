import Replicate from "replicate";
import { nanoid } from "nanoid";
import {
  buildBasePortraitPrompt,
  buildFullPrompt,
  buildNegativePrompt,
  DEFAULT_IMAGE_PARAMS,
  PORTRAIT_IMAGE_PARAMS,
  KONTEXT_IMAGE_PARAMS,
  type PromptBuildInput,
  type Gender,
} from "@/lib/prompts/image-prompts";
import { uploadFromUrl } from "@/server/services/storage.service";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface InfluencerStyle {
  gender?: Gender;
  ethnicity?: string;
  hairColor?: string;
  hairStyle?: string;
  bodyType?: string;
  fashionStyle?: string;
}

export interface ImageGenerationInput {
  influencerId: string;
  baseImageUrl?: string;
  /** When true (default), use reference image + identity prompts when a URL is present. */
  useReferenceFace?: boolean;
  scene: string;
  pose: string;
  outfit: string;
  expression: string;
  style: string;
  lighting: string;
  location?: string;
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

/**
 * SFW base model — used when the wizard generates the very first portrait of
 * a new influencer. This is a pure T2I model (no input_image), Flux 1.1 Pro.
 */
const MODEL_SFW_T2I = "black-forest-labs/flux-1.1-pro" as const;

/**
 * SFW content model with character reference (Sprint 11). Flux Kontext Pro
 * accepts an `input_image` URL and preserves identity across generations.
 * Used for every content photo when a baseImageUrl exists. Schema:
 *   prompt (req), input_image (req), aspect_ratio, prompt_upsampling,
 *   safety_tolerance (max 2 with input_image), output_format, seed.
 */
const MODEL_SFW_KONTEXT = "black-forest-labs/flux-kontext-pro" as const;

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
 * Sanitize params per model.
 *
 * - **flux-dev-uncensored** (NSFW): no safety_tolerance, no negative_prompt,
 *   no num_outputs, no image, no ip_adapter_scale.
 * - **flux-kontext-pro** (SFW with reference): no width/height (use
 *   `aspect_ratio` instead), no num_inference_steps, no guidance_scale, no
 *   negative_prompt, no num_outputs, no output_quality, no ip_adapter_scale.
 *   Sends `input_image` (renamed from `image`).
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

  if (model === MODEL_SFW_KONTEXT) {
    const {
      width: _w,
      height: _h,
      num_inference_steps: _steps,
      guidance_scale: _g,
      negative_prompt: _neg,
      num_outputs: _no,
      output_quality: _oq,
      ip_adapter_scale: _ip,
      ...rest
    } = params;
    // Rename `image` → `input_image` to match Flux Kontext Pro schema.
    const { image, ...clean } = rest;
    if (image && !clean.input_image) {
      clean.input_image = image;
    }
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
 * Generate multiple images. Strategy depends on the model:
 *  - flux-1.1-pro: native `num_outputs` support, single API call.
 *  - flux-kontext-pro / flux-dev-uncensored: no num_outputs → fan out in
 *    parallel with different seeds.
 */
async function runMultiplePredictions(
  model: string,
  input: Record<string, unknown>,
  count: number
): Promise<string[]> {
  if (model === MODEL_SFW_T2I) {
    return runReplicatePrediction(model, { ...input, num_outputs: count });
  }

  // Parallel fan-out for Kontext / NSFW. Different seeds = different photos.
  const tasks = Array.from({ length: count }, () =>
    runReplicatePrediction(model, {
      ...input,
      seed: Math.floor(Math.random() * 2147483647),
    })
  );
  const settled = await Promise.allSettled(tasks);
  const results: string[] = [];
  const errors: unknown[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") results.push(...r.value);
    else errors.push(r.reason);
  }
  if (results.length === 0 && errors.length > 0) {
    throw errors[0];
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
    gender: style.gender,
    ethnicity: style.ethnicity ?? "caucasian",
    hairColor: style.hairColor ?? "brown",
    hairStyle: style.hairStyle ?? (style.gender === "male" ? "short" : "long straight"),
    bodyType: style.bodyType ?? "average",
    fashionStyle: style.fashionStyle ?? "casual",
  });

  const negativePrompt = buildNegativePrompt(false, style.gender ?? "female");

  const params: Record<string, unknown> = {
    ...PORTRAIT_IMAGE_PARAMS,
    prompt,
    negative_prompt: negativePrompt,
    num_outputs: 4,
    safety_tolerance: 5,
  };

  try {
    console.log("[ai-image] Generating base image...");

    const outputUrls = await runMultiplePredictions(MODEL_SFW_T2I, params, 4);

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

  const wantFaceLock = input.useReferenceFace !== false;
  const hasRefUrl = Boolean(input.baseImageUrl?.trim());
  /** Identity reference is only honored on the SFW path (NSFW model has no input_image). */
  const sendsRefImage = !input.isNsfw && wantFaceLock && hasRefUrl;
  const useIdentityPrompt = sendsRefImage;

  const promptInput: PromptBuildInput = {
    gender: influencerStyle.gender,
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
    location: input.location,
    outfit: input.outfit,
    useReferenceFace: useIdentityPrompt,
    isNsfw: input.isNsfw,
    nsfwLevel: input.nsfwLevel,
    customPrompt: input.customPrompt,
  };

  const prompt = buildFullPrompt(promptInput);
  const negativePrompt = buildNegativePrompt(input.isNsfw, influencerStyle.gender ?? "female", {
    lockFace: useIdentityPrompt,
  });

  // ── Model routing (Sprint 11) ───────────────────────────────────────────
  // SFW + reference image  → Flux Kontext Pro (true character reference)
  // SFW without reference   → Flux 1.1 Pro    (T2I)
  // NSFW                    → Flux Dev Uncensored
  let model: string;
  let params: Record<string, unknown>;
  if (input.isNsfw) {
    model = MODEL_NSFW;
    params = {
      ...DEFAULT_IMAGE_PARAMS,
      prompt,
      negative_prompt: negativePrompt,
      num_outputs: numImages,
      safety_tolerance: 6,
    };
  } else if (sendsRefImage && input.baseImageUrl) {
    model = MODEL_SFW_KONTEXT;
    params = {
      ...KONTEXT_IMAGE_PARAMS,
      prompt,
      input_image: input.baseImageUrl,
    };
  } else {
    model = MODEL_SFW_T2I;
    params = {
      ...DEFAULT_IMAGE_PARAMS,
      prompt,
      negative_prompt: negativePrompt,
      num_outputs: numImages,
      safety_tolerance: 5,
    };
  }

  try {
    console.log("[ai-image] Generating content image with", model, sendsRefImage ? "(face-locked)" : "(no reference)");

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
