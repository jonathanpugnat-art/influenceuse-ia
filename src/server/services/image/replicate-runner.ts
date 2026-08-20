import Replicate from "replicate";
import {
  isContentSafetyFilterError,
  throwPremiumGenerationError,
  throwSocialSafetyError,
} from "@/lib/generation-errors";
import {
  withReplicateRetry,
  runWithConcurrency,
  MAX_PARALLEL_PREDICTIONS_PER_CALL,
} from "@/server/services/replicate-utils";
import { runFluxT2iWithFallback } from "@/server/services/image-providers/flux-t2i-router";
import type { FalFluxT2iInput } from "@/server/services/image-providers/fal-flux-t2i.provider";
import {
  isFalKontextFallbackEnabled,
  runFalKontextSingle,
} from "@/server/services/image-providers/fal-kontext.provider";
import {
  buildPremiumReplicateInput,
  isPremiumUncensoredReplicateModel,
  isPulidReplicateModel,
  resolveReplicatePremiumModelRef,
  sanitizePremiumReplicateInput,
  sanitizePulidReplicateInput,
} from "@/server/services/image-providers/replicate-premium.provider";
import type { TogetherFluxInput } from "@/server/services/image-providers/together-flux.provider";
import {
  MODEL_SFW_KONTEXT,
  MODEL_SFW_NANO,
  MODEL_SFW_SEEDREAM,
  MODEL_SFW_T2I,
} from "./model-constants";

let _replicate: Replicate | null = null;

export function getReplicate(): Replicate {
  if (!_replicate) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error(
        "REPLICATE_API_TOKEN is not configured. Set it in your .env file."
      );
    }
    _replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN.replace(/^"|"$/g, ""),
    });
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

  if (model === MODEL_SFW_SEEDREAM) {
    const imgs = params.image_input;
    const image_input: string[] = Array.isArray(imgs)
      ? imgs
          .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
          .slice(0, 10)
      : typeof imgs === "string" && imgs.startsWith("http")
        ? [imgs]
        : [];
    const out: Record<string, unknown> = {
      prompt: String(params.prompt ?? ""),
      image_input,
    };
    if (typeof params.size === "string") out.size = params.size;
    if (typeof params.aspect_ratio === "string")
      out.aspect_ratio = params.aspect_ratio;
    if (typeof params.sequential_image_generation === "string")
      out.sequential_image_generation = params.sequential_image_generation;
    if (typeof params.max_images === "number") out.max_images = params.max_images;
    return out;
  }

  if (isPulidReplicateModel(model)) {
    return sanitizePulidReplicateInput(params);
  }

  if (isPremiumUncensoredReplicateModel(model)) {
    return sanitizePremiumReplicateInput(model, params);
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
    const { image, ...clean } = rest;
    if (image && !clean.input_image) {
      clean.input_image = image;
    }
    return clean;
  }

  return params;
}

export async function runReplicatePrediction(
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
    if (
      isContentSafetyFilterError(error) &&
      retryWithSafePrompt &&
      !isPremiumUncensoredReplicateModel(model)
    ) {
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
      if (isPremiumUncensoredReplicateModel(model)) {
        throwPremiumGenerationError(
          error instanceof Error ? error.message : String(error)
        );
      }
      throwSocialSafetyError();
    }

    throw error;
  }
}

export async function runReplicateFluxT2iMultiple(
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

export async function runMultiplePredictions(
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

  const tasks: Array<() => Promise<string[]>> = [];
  if (model === MODEL_SFW_NANO || model === MODEL_SFW_SEEDREAM) {
    // Neither model exposes a seed on Replicate — vary the prompt per call so
    // multi-image runs return distinct framings instead of near-duplicates.
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
  } else if (model === MODEL_SFW_KONTEXT) {
    // Kontext is the Social-lane workhorse and was a Replicate-only SPOF.
    // On NON-safety failures (5xx, rate-limit exhausted, network) mirror the
    // edit on FAL Kontext. Safety errors keep propagating so the soften
    // cascade in content-photo-generation stays in charge.
    for (let i = 0; i < count; i++) {
      tasks.push(async () => {
        const params: Record<string, unknown> = {
          ...input,
          seed: Math.floor(Math.random() * 2147483647),
        };
        try {
          return await runReplicatePrediction(model, params);
        } catch (err) {
          const imageUrl =
            typeof params.input_image === "string" &&
            params.input_image.startsWith("http")
              ? params.input_image
              : undefined;
          if (
            isContentSafetyFilterError(err) ||
            !imageUrl ||
            !isFalKontextFallbackEnabled()
          ) {
            throw err;
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[ai-image] Kontext Replicate failed (${msg.slice(0, 120)}), falling back to FAL Kontext…`
          );
          const fal = await runFalKontextSingle({
            prompt: String(params.prompt ?? ""),
            imageUrl,
          });
          return fal.urls;
        }
      });
    }
  } else {
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

export async function runReplicatePremiumFluxMultiple(
  input: TogetherFluxInput,
  count: number
): Promise<{ urls: string[]; model: string }> {
  const modelRef = await resolveReplicatePremiumModelRef();
  const slug = modelRef.split(":")[0] ?? modelRef;

  const tasks: Array<() => Promise<string[]>> = [];
  for (let i = 0; i < count; i++) {
    tasks.push(() =>
      runReplicatePrediction(
        modelRef,
        buildPremiumReplicateInput(modelRef, {
          ...input,
          seed:
            input.seed != null
              ? input.seed + i
              : Math.floor(Math.random() * 2147483647),
        }),
        false
      )
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
  return { urls, model: slug };
}
