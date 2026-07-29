import {
  falQueueSubscribe,
  isFalKeyConfigured,
} from "@/server/services/image-providers/fal-queue.client";
import { extractFalImageUrls } from "@/server/services/image-providers/fal-flux-t2i.provider";
import { resolveImageT2iProviderMode } from "@/lib/image-t2i-config";

/**
 * FAL fallback for FLUX Kontext Pro (face-locked Social lane).
 *
 * Kontext on Replicate is a SPOF for the whole face-locked pipeline
 * (Nano's own safety fallback IS Kontext). Same BFL model hosted by FAL —
 * same quality, same safety behavior — so a Replicate outage no longer
 * takes down every face-locked generation.
 */
export const DEFAULT_FAL_KONTEXT_MODEL = "fal-ai/flux-pro/kontext";

export function resolveFalKontextModel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FAL_KONTEXT_MODEL?.trim() || DEFAULT_FAL_KONTEXT_MODEL;
}

/**
 * Fallback is on as soon as FAL_KEY is present; IMAGE_T2I_PROVIDER=replicate
 * forces single-provider behavior (bench reproducibility, incident isolation).
 */
export function isFalKontextFallbackEnabled(): boolean {
  return resolveImageT2iProviderMode() !== "replicate" && isFalKeyConfigured();
}

export async function runFalKontextSingle(input: {
  prompt: string;
  imageUrl: string;
  seed?: number;
}): Promise<{ urls: string[]; model: string }> {
  const model = resolveFalKontextModel();
  const falInput: Record<string, unknown> = {
    prompt: input.prompt,
    image_url: input.imageUrl,
    // Mirror KONTEXT_IMAGE_PARAMS used on the Replicate side.
    aspect_ratio: "3:4",
    output_format: "jpeg",
    safety_tolerance: "2",
    num_images: 1,
  };
  if (input.seed != null) falInput.seed = input.seed;

  const result = await falQueueSubscribe(model, falInput, 120_000);
  const urls = extractFalImageUrls(result);
  if (urls.length === 0) {
    throw new Error("FAL Kontext returned no image URLs");
  }
  return { urls, model };
}
