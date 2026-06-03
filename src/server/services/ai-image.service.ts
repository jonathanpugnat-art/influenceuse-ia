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
import { softenPromptForEditorial } from "@/lib/prompts/safety-soften";
import {
  selectIdentityPackRefs,
  type IdentityPackRecord,
} from "@/lib/identity-pack";
import {
  buildSceneFirstComposePrompt,
  buildScenePlatePrompt,
  SCENE_FIRST_PLATE_CREDIT,
} from "@/lib/prompts/scene-first-photo";
import { enrichPhotoPromptFields } from "@/server/services/photo-prompt-enrichment.service";
import { runFluxT2iWithFallback } from "@/server/services/image-providers/flux-t2i-router";
import type { FalFluxT2iInput } from "@/server/services/image-providers/fal-flux-t2i.provider";
import { assertPremiumPromptAllowed } from "@/lib/prompts/premium-prompt-guard";
import { buildPremiumNegativePrompt } from "@/lib/prompts/premium-negative";
import { softenPremiumPrompt } from "@/lib/prompts/premium-soften";
import { runPremiumFluxWithFallback } from "@/server/services/image-providers/premium-flux-router";
import type { TogetherFluxInput } from "@/server/services/image-providers/together-flux.provider";
import {
  assertPremiumImagesModerated,
  PremiumImageModerationError,
} from "@/server/services/image-moderation.service";

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
  sceneDescription?: string;
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
  /**
   * When true, skip credit check/deduction (e.g. reel pipeline already charged REEL).
   */
  omitCreditBilling?: boolean;
  /** Reel first-frame: always Flux Kontext (Nano/Google blocks bathroom, lace, GRWM). */
  isReelSceneFrame?: boolean;
  /** Multi-angle refs from identity pack (Nano `image_input` when ready). */
  identityPack?: IdentityPackRecord | null;
  /** Studio look preset — route to Kontext-first for better one-shot IG quality. */
  instagramShot?: boolean;
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

async function runReplicateFluxT2iMultiple(
  input: FalFluxT2iInput,
  count: number
): Promise<{ urls: string[]; model: string }> {
  const replicateInput: Record<string, unknown> = {
    prompt: input.prompt,
    negative_prompt: input.negative_prompt,
    width: input.width,
    height: input.height,
    num_inference_steps: input.num_inference_steps,
    guidance_scale: input.guidance_scale,
    output_format: "jpg",
    output_quality: 92,
    safety_tolerance: 5,
  };

  const tasks: Array<() => Promise<string[]>> = [];
  for (let i = 0; i < count; i++) {
    tasks.push(() =>
      runReplicatePrediction(MODEL_SFW_T2I, {
        ...replicateInput,
        seed: input.seed ?? Math.floor(Math.random() * 2147483647),
      })
    );
  }

  const settled = await runWithConcurrency(tasks, MAX_PARALLEL_PREDICTIONS_PER_CALL);
  const urls: string[] = [];
  const errors: unknown[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") urls.push(...r.value);
    else errors.push(r.reason);
  }
  if (urls.length === 0 && errors.length > 0) {
    throw errors[0];
  }
  return { urls, model: MODEL_SFW_T2I };
}

function toFluxT2iInput(params: Record<string, unknown>): FalFluxT2iInput {
  return {
    prompt: String(params.prompt ?? ""),
    negative_prompt:
      typeof params.negative_prompt === "string" ? params.negative_prompt : undefined,
    width: typeof params.width === "number" ? params.width : undefined,
    height: typeof params.height === "number" ? params.height : undefined,
    num_inference_steps:
      typeof params.num_inference_steps === "number"
        ? params.num_inference_steps
        : undefined,
    guidance_scale:
      typeof params.guidance_scale === "number" ? params.guidance_scale : undefined,
  };
}

/**
 * Generate multiple images. Strategy depends on the model:
 *  - flux-1.1-pro: FAL first (when configured), Replicate fallback
 *  - flux-kontext-pro / flux-dev-uncensored: parallel Replicate + seeds
 *  - google/nano-banana: fan-out + prompt rotation
 */
async function runMultiplePredictions(
  model: string,
  input: Record<string, unknown>,
  count: number
): Promise<string[]> {
  if (model === MODEL_SFW_T2I) {
    const routed = await runFluxT2iWithFallback(
      toFluxT2iInput(input),
      count,
      runReplicateFluxT2iMultiple
    );
    return routed.urls;
  }

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

async function runReplicatePremiumFluxMultiple(
  input: TogetherFluxInput,
  count: number
): Promise<{ urls: string[]; model: string }> {
  const replicateInput: Record<string, unknown> = {
    prompt: input.prompt,
    negative_prompt: input.negative_prompt,
    width: input.width ?? DEFAULT_IMAGE_PARAMS.width,
    height: input.height ?? DEFAULT_IMAGE_PARAMS.height,
    num_inference_steps: input.num_inference_steps ?? DEFAULT_IMAGE_PARAMS.num_inference_steps,
    guidance_scale: input.guidance_scale ?? DEFAULT_IMAGE_PARAMS.guidance_scale,
    output_format: "jpg",
    output_quality: 92,
    safety_tolerance: 6,
  };

  const tasks: Array<() => Promise<string[]>> = [];
  for (let i = 0; i < count; i++) {
    tasks.push(() =>
      runReplicatePrediction(MODEL_NSFW, {
        ...replicateInput,
        seed: input.seed ?? Math.floor(Math.random() * 2147483647),
      })
    );
  }

  const settled = await runWithConcurrency(tasks, MAX_PARALLEL_PREDICTIONS_PER_CALL);
  const urls: string[] = [];
  const errors: unknown[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") urls.push(...r.value);
    else errors.push(r.reason);
  }
  if (urls.length === 0 && errors.length > 0) {
    throw errors[0];
  }
  return { urls, model: MODEL_NSFW };
}

function toPremiumFluxInput(
  prompt: string,
  negativePrompt: string
): TogetherFluxInput {
  return {
    prompt,
    negative_prompt: negativePrompt,
    width: DEFAULT_IMAGE_PARAMS.width,
    height: DEFAULT_IMAGE_PARAMS.height,
    steps: DEFAULT_IMAGE_PARAMS.num_inference_steps,
    num_inference_steps: DEFAULT_IMAGE_PARAMS.num_inference_steps,
    guidance_scale: DEFAULT_IMAGE_PARAMS.guidance_scale,
  };
}

async function generatePremiumImagesWithModeration(
  prompt: string,
  negativePrompt: string,
  numImages: number
): Promise<{
  urls: string[];
  promptUsed: string;
  provider: string;
  model: string;
}> {
  const fluxInput = toPremiumFluxInput(prompt, negativePrompt);
  const routed = await runPremiumFluxWithFallback(
    fluxInput,
    numImages,
    runReplicatePremiumFluxMultiple
  );

  try {
    await assertPremiumImagesModerated(routed.urls);
    return {
      urls: routed.urls,
      promptUsed: prompt,
      provider: routed.provider,
      model: routed.model,
    };
  } catch (err) {
    if (!(err instanceof PremiumImageModerationError)) throw err;
    console.warn(
      "[ai-image] Premium image moderation failed, retrying with softened prompt…"
    );
    const softPrompt = softenPremiumPrompt(prompt);
    const retryInput = toPremiumFluxInput(softPrompt, negativePrompt);
    const retry = await runPremiumFluxWithFallback(
      retryInput,
      numImages,
      runReplicatePremiumFluxMultiple
    );
    await assertPremiumImagesModerated(retry.urls);
    return {
      urls: retry.urls,
      promptUsed: softPrompt,
      provider: retry.provider,
      model: retry.model,
    };
  }
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
  const numVariants = 4;

  // Wizard portrait: Nano Banana first (same iPhone-realism as feed photos).
  // Flux 1.1 Pro only when Google safety blocks the prompt.
  let outputUrls: string[];
  let usedParams: Record<string, unknown>;
  let usedModel: string = MODEL_SFW_NANO;

  const nanoParams: Record<string, unknown> = {
    ...NANO_BANANA_DEFAULTS,
    aspect_ratio: "3:4",
    prompt,
    image_input: [] as string[],
  };

  try {
    console.log(
      `[ai-image] Generating base portrait (nano-banana, fingerprint=${fingerprint})…`
    );
    outputUrls = await runMultiplePredictions(
      MODEL_SFW_NANO,
      nanoParams,
      numVariants
    );
    usedParams = nanoParams;
  } catch (err) {
    if (!isContentSafetyFilterError(err)) throw err;
    console.warn(
      "[ai-image] Nano blocked wizard portrait, falling back to flux-1.1-pro…"
    );
    usedModel = MODEL_SFW_T2I;
    usedParams = {
      ...PORTRAIT_IMAGE_PARAMS,
      prompt,
      negative_prompt: negativePrompt,
      safety_tolerance: 5,
    };
    outputUrls = await runMultiplePredictions(
      MODEL_SFW_T2I,
      usedParams,
      numVariants
    );
  }

  try {
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
      parameters: { ...usedParams, replicateModel: usedModel },
      appearanceVariations: variations,
      appearanceFingerprint: fingerprint,
    };
  } catch (error) {
    console.error("[ai-image] generateBaseImage error:", error);
    throw error;
  }
}

/**
 * Scene-first photo cost: one shared plate + one credit per final image.
 */
export function sceneFirstPhotoCreditCost(numberOfImages: number): number {
  const n = Math.min(Math.max(1, numberOfImages), 4);
  return SCENE_FIRST_PLATE_CREDIT + CREDIT_COSTS.PHOTO * n;
}

async function resolveEnrichedSceneAndOutfit(input: {
  sceneDescription?: string;
  outfit?: string;
}): Promise<{ sceneDescription?: string; outfit?: string }> {
  const enriched = await enrichPhotoPromptFields(input);
  return {
    sceneDescription: enriched.sceneDescription || input.sceneDescription,
    outfit: enriched.outfit ?? input.outfit,
  };
}

async function applyPhotoPromptEnrichment(input: ImageGenerationInput): Promise<ImageGenerationInput> {
  const { sceneDescription, outfit } = await resolveEnrichedSceneAndOutfit({
    sceneDescription: input.sceneDescription,
    outfit: input.outfit,
  });
  return {
    ...input,
    sceneDescription,
    outfit: outfit ?? input.outfit,
  };
}

/** Step 1 — empty environment plate (user validates before compose). */
export async function generateScenePlateImage(
  userId: string,
  input: Pick<
    ImageGenerationInput,
    "influencerId" | "scene" | "sceneDescription" | "lighting" | "location"
  >,
  options?: { omitCreditBilling?: boolean }
): Promise<{ scenePlateUrl: string; platePrompt: string }> {
  if (!options?.omitCreditBilling) {
    const hasCredits = await checkCredits(userId, SCENE_FIRST_PLATE_CREDIT);
    if (!hasCredits) {
      throw new Error(
        `Crédits insuffisants. Coût décor : ${SCENE_FIRST_PLATE_CREDIT} crédit.`
      );
    }
  }

  const { sceneDescription: enrichedScene } = await resolveEnrichedSceneAndOutfit({
    sceneDescription: input.sceneDescription,
  });

  const platePrompt = buildScenePlatePrompt({
    sceneDescription: enrichedScene ?? "",
    scene: input.scene,
    lighting: input.lighting,
    location: input.location,
  });
  const plateNegative =
    "people, person, face, portrait, mannequin, crowd, selfie, influencer, human, body, hands, legs";

  console.log("[ai-image] Photo scene plate (flux T2I — FAL → Replicate fallback)…");
  const plateUrls = await runMultiplePredictions(
    MODEL_SFW_T2I,
    {
      ...DEFAULT_IMAGE_PARAMS,
      prompt: platePrompt,
      negative_prompt: plateNegative,
      num_outputs: 1,
      safety_tolerance: 5,
    },
    1
  );
  const plateRemote = plateUrls[0];
  if (!plateRemote) {
    throw new Error(
      "Impossible de générer le décor. Précise le lieu dans la description de scène."
    );
  }
  const scenePlateUrl = await uploadFromUrl(
    plateRemote,
    `scene-plate-${input.influencerId}-${nanoid(6)}.jpg`
  );

  if (!options?.omitCreditBilling) {
    await deductCredits(userId, SCENE_FIRST_PLATE_CREDIT);
  }

  return { scenePlateUrl, platePrompt };
}

/** Step 2 — place influencer on an approved scene plate (Nano multi-ref). */
export async function composeImageOnScenePlate(
  userId: string,
  influencerAge: number,
  influencerStyle: InfluencerStyle,
  input: ImageGenerationInput & { scenePlateUrl: string }
): Promise<ImageGenerationOutput> {
  const numImages = Math.min(input.numberOfImages, 4);
  const cost = CREDIT_COSTS.PHOTO * numImages;
  if (!input.omitCreditBilling) {
    const hasCredits = await checkCredits(userId, cost);
    if (!hasCredits) {
      throw new Error(`Crédits insuffisants. Coût : ${cost} crédits.`);
    }
  }

  const baseUrl = input.baseImageUrl?.trim();
  if (!baseUrl?.startsWith("http")) {
    throw new Error(
      "Portrait de référence requis. Regénère l'image de base de l'influenceuse."
    );
  }
  const plateUrl = input.scenePlateUrl.trim();
  if (!plateUrl.startsWith("http")) {
    throw new Error("Image de décor invalide. Regénère le décor.");
  }

  const enrichedInput = await applyPhotoPromptEnrichment(input);

  const identityRefs = selectIdentityPackRefs(baseUrl, enrichedInput.identityPack, {
    pose: enrichedInput.pose,
    sceneDescription: enrichedInput.sceneDescription,
    maxTotal: 3,
  });
  const imageInput = [...identityRefs, plateUrl].slice(0, 4);

  const composePrompt = buildSceneFirstComposePrompt({
    gender: influencerStyle.gender,
    age: influencerAge,
    ethnicity: influencerStyle.ethnicity,
    hairColor: influencerStyle.hairColor,
    hairStyle: influencerStyle.hairStyle,
    bodyType: influencerStyle.bodyType,
    sceneDescription: enrichedInput.sceneDescription,
    pose: enrichedInput.pose,
    expression: enrichedInput.expression,
    outfit: enrichedInput.outfit,
    customPrompt: enrichedInput.customPrompt,
    useReferenceFace: true,
  });

  const negativePrompt = buildNegativePrompt(false, influencerStyle.gender ?? "female", {
    lockFace: true,
  });

  const nanoParams: Record<string, unknown> = {
    ...NANO_BANANA_DEFAULTS,
    prompt: composePrompt,
    image_input: imageInput,
  };

  let outputUrls: string[];
  let usedParams = nanoParams;
  let promptUsed = composePrompt;
  try {
    outputUrls = await runMultiplePredictions(MODEL_SFW_NANO, nanoParams, numImages);
  } catch (err) {
    if (isContentSafetyFilterError(err)) {
      const soft = softenPromptForEditorial(composePrompt);
      outputUrls = await runMultiplePredictions(
        MODEL_SFW_NANO,
        { ...nanoParams, prompt: soft },
        numImages
      );
      usedParams = { ...nanoParams, prompt: soft };
      promptUsed = soft;
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

  if (!input.omitCreditBilling) {
    await deductCredits(userId, cost);
  }

  return {
    imageUrls: storedUrls,
    promptUsed,
    negativePrompt,
    parameters: {
      ...usedParams,
      contentEngine: "nano",
      scenePlateUrl: plateUrl,
      imageInputCount: imageInput.length,
      photoPhase: "final",
    },
  };
}

export async function generateContentImage(
  userId: string,
  influencerAge: number,
  influencerStyle: InfluencerStyle,
  input: ImageGenerationInput
): Promise<ImageGenerationOutput> {
  const enrichedInput = await applyPhotoPromptEnrichment(input);
  const numImages = Math.min(enrichedInput.numberOfImages, 4);
  const cost = CREDIT_COSTS.PHOTO * numImages;
  if (!input.omitCreditBilling) {
    const hasCredits = await checkCredits(userId, cost);
    if (!hasCredits) {
      throw new Error(
        `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
      );
    }
  }

  const wantFaceLock = input.useReferenceFace !== false;
  const hasRefUrl = Boolean(input.baseImageUrl?.trim());
  /** Identity reference is only honored on the SFW path (NSFW model has no input_image). */
  const sendsRefImage = !input.isNsfw && wantFaceLock && hasRefUrl;
  const useIdentityPrompt = sendsRefImage;

  const borderlineFields = {
    scene: enrichedInput.scene,
    sceneDescription: enrichedInput.sceneDescription,
    outfit: enrichedInput.outfit,
    location: enrichedInput.location,
    customPrompt: enrichedInput.customPrompt,
    pose: enrichedInput.pose,
    expression: enrichedInput.expression,
  };
  const borderline =
    !enrichedInput.isNsfw &&
    (enrichedInput.isReelSceneFrame || shouldRouteToKontext(borderlineFields));
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
      scene: enrichedInput.scene,
      sceneDescription: enrichedInput.sceneDescription,
      pose: enrichedInput.pose,
      expression: enrichedInput.expression,
      style: enrichedInput.style,
      lighting: enrichedInput.lighting,
      location: enrichedInput.location,
      outfit: enrichedInput.outfit,
      useReferenceFace: useIdentityPrompt,
      isNsfw: enrichedInput.isNsfw,
      nsfwLevel: enrichedInput.nsfwLevel,
      customPrompt: enrichedInput.customPrompt,
      appearanceVariations: enrichedInput.appearanceVariations,
      contentEngine: engine,
    });

  const primaryEngine: ContentImageEngine =
    enrichedInput.isReelSceneFrame && !enrichedInput.isNsfw
      ? "kontext"
      : borderline || enrichedInput.instagramShot
        ? "kontext"
        : "nano";
  let usedEngine: ContentImageEngine = primaryEngine;
  let prompt = buildPromptForEngine(primaryEngine);
  const gender = influencerStyle.gender ?? "female";
  const negativePrompt = input.isNsfw
    ? buildPremiumNegativePrompt(gender, { lockFace: false })
    : buildNegativePrompt(false, gender, { lockFace: useIdentityPrompt });

  // ── Premium lane (Together / self-host / Replicate + post-moderation) ───
  if (input.isNsfw) {
    assertPremiumPromptAllowed({
      scene: enrichedInput.scene,
      sceneDescription: enrichedInput.sceneDescription,
      outfit: enrichedInput.outfit,
      customPrompt: enrichedInput.customPrompt,
      location: enrichedInput.location,
    });

    try {
      console.log("[ai-image] Premium photo — Together/self-host router");
      const premium = await generatePremiumImagesWithModeration(
        prompt,
        negativePrompt,
        numImages
      );

      const storedUrls = await Promise.all(
        premium.urls.map(async (url, i) => {
          const filename = `content-${input.influencerId}-${nanoid(6)}-${i}.jpg`;
          return uploadFromUrl(url, filename);
        })
      );

      if (!input.omitCreditBilling) {
        await deductCredits(userId, cost);
      }

      return {
        imageUrls: storedUrls,
        promptUsed: premium.promptUsed,
        negativePrompt,
        parameters: {
          ...toPremiumFluxInput(premium.promptUsed, negativePrompt),
          contentEngine: "premium",
          premiumProvider: premium.provider,
          premiumModel: premium.model,
          nsfwLevel: enrichedInput.nsfwLevel,
        },
      };
    } catch (error) {
      console.error("[ai-image] generateContentImage premium error:", error);
      throw error;
    }
  }

  // ── Model routing (bench 2026-05-15 + nano-borderline.ts) ────────────────

  type ModelPlan = {
    model: string;
    params: Record<string, unknown>;
    /** When the engine has a safety filter that may refuse, this is what we retry with. */
    fallback?: { model: string; params: Record<string, unknown> };
  };

  const refs =
    sendsRefImage && enrichedInput.baseImageUrl?.trim()
      ? selectIdentityPackRefs(enrichedInput.baseImageUrl.trim(), enrichedInput.identityPack, {
          pose: enrichedInput.pose,
          sceneDescription: enrichedInput.sceneDescription,
        })
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
  if (sendsRefImage && input.baseImageUrl) {
    plan =
      borderline || enrichedInput.instagramShot ? kontextPlan : nanoPlan;
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
      borderline ? `(borderline → kontext, keywords: ${matchedKeywords.join(", ") || "n/a"})` : enrichedInput.instagramShot ? "(instagram-shot → kontext)" : "(nano-first)",
      refs.length > 1 ? `(${refs.length} identity refs)` : ""
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
      } else if (
        isContentSafetyFilterError(err) &&
        plan.model === MODEL_SFW_KONTEXT
      ) {
        console.warn(
          "[ai-image] Kontext blocked by safety filter, retrying with editorial-softened prompt…"
        );
        const softPrompt = softenPromptForEditorial(
          buildPromptForEngine("kontext")
        );
        outputUrls = await runMultiplePredictions(
          MODEL_SFW_KONTEXT,
          { ...kontextPlan.params, prompt: softPrompt },
          numImages
        );
        usedParams = { ...kontextPlan.params, prompt: softPrompt };
        prompt = softPrompt;
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

    if (!input.omitCreditBilling) {
      await deductCredits(userId, cost);
    }

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
