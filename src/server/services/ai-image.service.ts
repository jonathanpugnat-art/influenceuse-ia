import Replicate from "replicate";
import { nanoid } from "nanoid";
import {
  buildBasePortraitPrompt,
  buildFullPrompt,
  buildNegativePrompt,
  pickAppearanceVariations,
  appearanceFingerprint,
  DEFAULT_IMAGE_PARAMS,
  PORTRAIT_IMAGE_PARAMS,
  KONTEXT_IMAGE_PARAMS,
  type PromptBuildInput,
  type Gender,
  type AppearanceVariation,
} from "@/lib/prompts/image-prompts";
import { uploadFromUrl } from "@/server/services/storage.service";
import {
  isContentSafetyFilterError,
  NSFW_USER_MESSAGE as NSFW_ERROR_MESSAGE,
} from "@/lib/generation-errors";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  withReplicateRetry,
  runWithConcurrency,
  MAX_PARALLEL_PREDICTIONS_PER_CALL,
} from "@/server/services/replicate-utils";
import {
  shouldRouteToKontext,
  getMatchedBorderlineKeywords,
  type ContentImageEngine,
} from "@/lib/prompts/nano-borderline";

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
  /**
   * Sprint 14 — shared visual DNA passed from the influencer row. We use it
   * to re-inject the same facial trait keywords in the content prompt so
   * Kontext / Nano / Flux produce a consistent face across base portrait
   * and feed posts.
   */
  appearanceVariations?: AppearanceVariation;
}

export interface ImageGenerationOutput {
  imageUrls: string[];
  promptUsed: string;
  negativePrompt: string;
  parameters: Record<string, unknown>;
  /**
   * Only populated by `generateBaseImage`. Identifies the random visual
   * variations applied to the wizard prompt + an 8-char fingerprint of
   * the full (style + variations + age) tuple. Callers should persist
   * these on the `Influencer` row so a) the wizard can be reproduced and
   * b) we can detect identity collisions across users later.
   */
  appearanceVariations?: AppearanceVariation;
  appearanceFingerprint?: string;
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

/**
 * Default SFW content engine — Google Gemini 2.5 Flash Image
 * (`google/nano-banana` on Replicate). Picked after the 2026-05-15 A/B/C
 * bench: fastest (avg 21s), best "iPhone TikTok" look, best context
 * (real gym mirrors, real cafés, real props). Used for every SFW content
 * photo where a face reference is sent — for any plan. Falls back to
 * Flux Kontext Pro for borderline scenarios (Google blocks beach/lingerie).
 */
const MODEL_SFW_NANO = "google/nano-banana" as const;

/** Default API shape for `google/nano-banana` (portrait / social). */
const NANO_BANANA_DEFAULTS = {
  aspect_ratio: "3:4",
  output_format: "jpg",
} as const;

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
 * - **google/nano-banana**: only `prompt`, `image_input`, `aspect_ratio`,
 *   `output_format` (Gemini Flash Image schema on Replicate).
 */
function sanitizeParamsForModel(
  model: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  if (model === MODEL_SFW_NANO) {
    const imgs = params.image_input;
    const image_input: string[] = Array.isArray(imgs)
      ? imgs.filter((u): u is string => typeof u === "string" && u.startsWith("http"))
      : typeof imgs === "string" && imgs.startsWith("http")
        ? [imgs]
        : [];
    const out: Record<string, unknown> = {
      prompt: String(params.prompt ?? ""),
      image_input,
    };
    if (typeof params.aspect_ratio === "string")
      out.aspect_ratio = params.aspect_ratio;
    if (typeof params.output_format === "string")
      out.output_format = params.output_format;
    return out;
  }

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
    const output = await withReplicateRetry(
      () =>
        replicate.run(
          model as `${string}/${string}` | `${string}/${string}:${string}`,
          { input: cleanInput }
        ),
      `${model}`
    );

    const urls = extractOutputUrls(output);
    if (urls.length === 0) {
      throw new Error("Replicate returned no output");
    }
    return urls;
  } catch (error) {
    if (isContentSafetyFilterError(error) && retryWithSafePrompt) {
      console.warn(
        "[ai-image] NSFW filter triggered, retrying with safe prompt prefix..."
      );
      const safeInput = {
        ...input,
        prompt: `professional portrait, fully clothed, appropriate, ${input.prompt}`,
      };
      return runReplicatePrediction(model, safeInput, false);
    }

    if (isContentSafetyFilterError(error)) {
      throw new Error(NSFW_ERROR_MESSAGE);
    }

    throw error;
  }
}

/**
 * Generate multiple images. Strategy depends on the model:
 *  - flux-1.1-pro: native `num_outputs` support — but we still fan out into
 *    N parallel calls with distinct random seeds, otherwise two users with
 *    identical wizard inputs would receive the SAME 4 portraits (Flux is
 *    deterministic for a given prompt+seed pair). The extra seed per call
 *    guarantees ~2^31 visually distinct outputs even on identical prompts.
 *  - flux-kontext-pro / flux-dev-uncensored: no num_outputs → fan out in
 *    parallel with different seeds.
 *  - google/nano-banana: same fan-out + a prompt rotation suffix because
 *    Nano respects identical prompts more strictly than Flux.
 */
async function runMultiplePredictions(
  model: string,
  input: Record<string, unknown>,
  count: number
): Promise<string[]> {

  // Build the per-image task list depending on the model branch.
  const tasks: Array<() => Promise<string[]>> = [];
  if (model === MODEL_SFW_NANO) {
    // Nano Banana returns one image per prediction — fan out like Kontext,
    // but rotate the prompt slightly so we don't get 4 near-identical
    // outputs (Nano respects identical prompts more strictly than Flux).
    for (let i = 0; i < count; i++) {
      tasks.push(() =>
        runReplicatePrediction(model, {
          ...input,
          prompt:
            count > 1
              ? `${String(input.prompt ?? "")}, distinct variation ${i + 1} of ${count}, different framing`
              : input.prompt,
        })
      );
    }
  } else {
    // Flux 1.1 Pro / Kontext / NSFW: different random seeds give different
    // photos. We always pass an explicit seed (even on Flux 1.1 Pro which
    // accepts num_outputs natively) so two users with identical wizard
    // inputs cannot collide on the same default seed.
    for (let i = 0; i < count; i++) {
      tasks.push(() =>
        runReplicatePrediction(model, {
          ...input,
          seed: Math.floor(Math.random() * 2147483647),
        })
      );
    }
  }

  const settled = await runWithConcurrency(
    tasks,
    MAX_PARALLEL_PREDICTIONS_PER_CALL
  );
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
  style: InfluencerStyle,
  /** When set (wizard expert mode), use these indices instead of random. */
  presetVariations?: AppearanceVariation
): Promise<ImageGenerationOutput> {
  const cost = CREDIT_COSTS.BASE_IMAGE;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
    );
  }

  // Pick a random set of subtle distinctive traits (face shape, eye color,
  // expression, etc.) so two users with identical wizard inputs produce
  // visually different influencers. See `pickAppearanceVariations` in
  // image-prompts.ts for the full picker logic.
  const variations = presetVariations ?? pickAppearanceVariations();
  const fingerprint = appearanceFingerprint(style, influencerAge, variations);

  const prompt = buildBasePortraitPrompt({
    age: influencerAge,
    gender: style.gender,
    ethnicity: style.ethnicity ?? "caucasian",
    hairColor: style.hairColor ?? "brown",
    hairStyle: style.hairStyle ?? (style.gender === "male" ? "short" : "long straight"),
    bodyType: style.bodyType ?? "average",
    fashionStyle: style.fashionStyle ?? "casual",
    variations,
  });

  const negativePrompt = buildNegativePrompt(false, style.gender ?? "female");

  // Wizard portrait: Flux 1.1 Pro on every plan. Bench (2026-05-15) showed
  // T2I-without-reference is where Flux beats Nano (cleaner identity over 4
  // variations, no Google safety blocks on edgy aesthetics).
  // Note: we no longer rely on `num_outputs` here — runMultiplePredictions
  // fans out into 4 parallel calls with distinct random seeds so two users
  // with identical wizard inputs cannot collide on the default Flux seed.
  const params: Record<string, unknown> = {
    ...PORTRAIT_IMAGE_PARAMS,
    prompt,
    negative_prompt: negativePrompt,
    safety_tolerance: 5,
  };

  try {
    console.log(
      `[ai-image] Generating base image (flux-1.1-pro, fingerprint=${fingerprint})…`
    );
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
      appearanceVariations: variations,
      appearanceFingerprint: fingerprint,
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

  const borderlineFields = {
    scene: input.scene,
    outfit: input.outfit,
    location: input.location,
    customPrompt: input.customPrompt,
    pose: input.pose,
    expression: input.expression,
  };
  const borderline = !input.isNsfw && shouldRouteToKontext(borderlineFields);
  const matchedKeywords = borderline
    ? getMatchedBorderlineKeywords(borderlineFields)
    : [];

  const buildPromptForEngine = (engine: ContentImageEngine) =>
    buildFullPrompt({
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
      appearanceVariations: input.appearanceVariations,
      contentEngine: engine,
    });

  const primaryEngine: ContentImageEngine = borderline ? "kontext" : "nano";
  let usedEngine: ContentImageEngine = primaryEngine;
  let prompt = buildPromptForEngine(primaryEngine);
  const negativePrompt = buildNegativePrompt(input.isNsfw, influencerStyle.gender ?? "female", {
    lockFace: useIdentityPrompt,
  });

  // ── Model routing (bench 2026-05-15 + nano-borderline.ts) ────────────────

  type ModelPlan = {
    model: string;
    params: Record<string, unknown>;
    /** When the engine has a safety filter that may refuse, this is what we retry with. */
    fallback?: { model: string; params: Record<string, unknown> };
  };

  const refs =
    sendsRefImage && input.baseImageUrl?.trim()
      ? [input.baseImageUrl.trim()]
      : [];

  const kontextPlan: ModelPlan = {
    model: MODEL_SFW_KONTEXT,
    params: {
      ...KONTEXT_IMAGE_PARAMS,
      prompt,
      input_image: input.baseImageUrl,
    },
  };

  const nanoPlan: ModelPlan = {
    model: MODEL_SFW_NANO,
    params: {
      ...NANO_BANANA_DEFAULTS,
      prompt,
      image_input: refs,
    },
    fallback: sendsRefImage && input.baseImageUrl ? kontextPlan : undefined,
  };

  let plan: ModelPlan;
  if (input.isNsfw) {
    plan = {
      model: MODEL_NSFW,
      params: {
        ...DEFAULT_IMAGE_PARAMS,
        prompt,
        negative_prompt: negativePrompt,
        num_outputs: numImages,
        safety_tolerance: 6,
      },
    };
  } else if (sendsRefImage && input.baseImageUrl) {
    plan = borderline ? kontextPlan : nanoPlan;
  } else {
    plan = {
      model: MODEL_SFW_T2I,
      params: {
        ...DEFAULT_IMAGE_PARAMS,
        prompt,
        negative_prompt: negativePrompt,
        num_outputs: numImages,
        safety_tolerance: 5,
      },
    };
  }

  try {
    console.log(
      "[ai-image] Generating content image with",
      plan.model,
      sendsRefImage ? "(face-locked)" : "(no reference)",
      borderline ? `(borderline → kontext, keywords: ${matchedKeywords.join(", ") || "n/a"})` : "(nano-first)"
    );

    let outputUrls: string[];
    let usedParams = plan.params;
    try {
      outputUrls = await runMultiplePredictions(
        plan.model,
        plan.params,
        numImages
      );
    } catch (err) {
      // Google Nano Banana sometimes returns a safety/content error on a
      // shot that BORDERLINE_KEYWORDS didn't catch. Fall back to Kontext
      // automatically so the user gets a photo instead of a hard failure.
      if (plan.fallback && isContentSafetyFilterError(err)) {
        console.warn(
          `[ai-image] ${plan.model} blocked by safety filter, falling back to ${plan.fallback.model}…`
        );
        const kontextPrompt = buildPromptForEngine("kontext");
        outputUrls = await runMultiplePredictions(plan.fallback.model, {
          ...plan.fallback.params,
          prompt: kontextPrompt,
        }, numImages);
        usedParams = { ...plan.fallback.params, prompt: kontextPrompt };
        prompt = kontextPrompt;
        usedEngine = "kontext";
      } else {
        throw err;
      }
    }

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
      parameters: {
        ...usedParams,
        contentEngine: usedEngine,
        borderlineKeywords: matchedKeywords,
      },
    };
  } catch (error) {
    console.error("[ai-image] generateContentImage error:", error);
    throw error;
  }
}
