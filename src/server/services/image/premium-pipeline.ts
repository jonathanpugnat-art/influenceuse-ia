import { DEFAULT_IMAGE_PARAMS } from "@/lib/prompts/image-prompts";
import { softenPremiumPrompt } from "@/lib/prompts/premium-soften";
import { runPremiumFluxWithFallback } from "@/server/services/image-providers/premium-flux-router";
import type { TogetherFluxInput } from "@/server/services/image-providers/together-flux.provider";
import { shouldPostModeratePremiumGeneration } from "@/lib/premium-image-config";
import { resolveReplicatePulidModelRef } from "@/server/services/image-providers/replicate-premium.provider";
import {
  assertPremiumImagesModerated,
  PremiumImageModerationError,
} from "@/server/services/image-moderation.service";
import { runReplicatePrediction, runReplicatePremiumFluxMultiple } from "./replicate-runner";
import type { ImageGenerationInput } from "./types";

export function toPremiumFluxInput(
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

export function selectPremiumFaceRef(input: ImageGenerationInput): string | undefined {
  const resolved = input.premiumFaceRefUrl?.trim();
  if (resolved?.startsWith("http")) return resolved;
  const fromPack = input.identityPack?.shots
    ?.find((s) => s.id === "portrait_front")
    ?.url?.trim();
  if (fromPack?.startsWith("http")) return fromPack;
  const base = input.baseImageUrl?.trim();
  return base?.startsWith("http") ? base : undefined;
}

export async function generatePremiumPulidImages(
  faceUrl: string,
  prompt: string,
  negativePrompt: string,
  numImages: number
): Promise<{ urls: string[]; model: string }> {
  const modelRef = await resolveReplicatePulidModelRef();
  const params: Record<string, unknown> = {
    main_face_image: faceUrl,
    prompt,
    negative_prompt: negativePrompt,
    id_weight: 0.65,
    start_step: 3,
    num_outputs: Math.min(Math.max(1, numImages), 4),
    width: DEFAULT_IMAGE_PARAMS.width,
    height: DEFAULT_IMAGE_PARAMS.height,
    guidance_scale: 3,
    true_cfg: 3,
    num_steps: 20,
    output_format: "webp",
    output_quality: 90,
    seed: Math.floor(Math.random() * 2147483647),
  };
  const urls = await runReplicatePrediction(modelRef, params, false);
  return { urls, model: modelRef };
}

export async function generatePremiumImagesWithModeration(
  prompt: string,
  negativePrompt: string,
  numImages: number,
  opts?: { nsfwLevel?: string }
): Promise<{
  urls: string[];
  promptUsed: string;
  provider: string;
  model: string;
}> {
  const fluxInput = toPremiumFluxInput(prompt, negativePrompt);
  const postModerate = shouldPostModeratePremiumGeneration(opts?.nsfwLevel);

  const routed = await runPremiumFluxWithFallback(
    fluxInput,
    numImages,
    runReplicatePremiumFluxMultiple
  );

  if (!postModerate) {
    return {
      urls: routed.urls,
      promptUsed: prompt,
      provider: routed.provider,
      model: routed.model,
    };
  }

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
