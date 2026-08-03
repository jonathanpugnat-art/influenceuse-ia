import { LORA_DEFAULT_SCALE } from "@/lib/lora";
import { falQueueSubscribe, isFalKeyConfigured } from "@/server/services/image-providers/fal-queue.client";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import Replicate from "replicate";
import { withReplicateRetry } from "@/server/services/replicate-utils";

const FAL_FLUX_LORA_MODEL =
  process.env.FAL_FLUX_LORA_MODEL?.trim() || "fal-ai/flux-lora";
const REPLICATE_FLUX_LORA_MODEL =
  process.env.REPLICATE_FLUX_LORA_MODEL?.trim() ||
  "black-forest-labs/flux-dev-lora";

let _replicate: Replicate | null = null;

function getReplicate(): Replicate | null {
  if (!process.env.REPLICATE_API_TOKEN) return null;
  if (!_replicate) {
    _replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return _replicate;
}

function extractImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;

  const images = data.images;
  if (Array.isArray(images)) {
    return images
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const url = (item as Record<string, unknown>).url;
          return typeof url === "string" ? url : null;
        }
        return null;
      })
      .filter((u): u is string => Boolean(u?.startsWith("http")));
  }

  if (typeof data.image === "object" && data.image) {
    const url = (data.image as Record<string, unknown>).url;
    if (typeof url === "string" && url.startsWith("http")) return [url];
  }

  return [];
}

export type FluxLoraGenerateInput = {
  loraUrl: string;
  triggerWord: string;
  prompt: string;
  negativePrompt: string;
  /** Hybrid face-lock — optional reference for img2img strength. */
  referenceImageUrl?: string;
  numImages: number;
  loraScale?: number;
  /** Hybrid reference img2img strength (default 0.82). */
  img2imgStrength?: number;
};

export async function runFluxLoraBatch(
  input: FluxLoraGenerateInput
): Promise<{ urls: string[]; model: string; provider: "fal" | "replicate" }> {
  const scale = input.loraScale ?? LORA_DEFAULT_SCALE;
  const img2imgStrength = input.img2imgStrength ?? 0.82;
  const loraPublic = await resolvePublicMediaUrl(input.loraUrl.trim());
  if (!loraPublic) {
    throw new Error("LoRA weights URL inaccessible.");
  }

  const prompt = `${input.triggerWord.trim()}, ${input.prompt.trim()}`.trim();
  const numImages = Math.min(Math.max(input.numImages, 1), 4);

  if (isFalKeyConfigured()) {
    try {
      const falInput: Record<string, unknown> = {
        prompt,
        loras: [{ path: loraPublic, scale }],
        num_images: numImages,
        image_size: "portrait_4_3",
        enable_safety_checker: false,
      };
      if (input.negativePrompt.trim()) {
        falInput.negative_prompt = input.negativePrompt.trim();
      }
      const ref = input.referenceImageUrl?.trim();
      if (ref) {
        const refPublic = await resolvePublicMediaUrl(ref);
        if (refPublic) {
          falInput.image_url = refPublic;
          falInput.strength = img2imgStrength;
        }
      }

      const result = await falQueueSubscribe(FAL_FLUX_LORA_MODEL, falInput, 180_000);
      const urls = extractImageUrls(result);
      if (urls.length > 0) {
        return { urls: urls.slice(0, numImages), model: FAL_FLUX_LORA_MODEL, provider: "fal" };
      }
    } catch (err) {
      const replicate = getReplicate();
      if (!replicate) throw err;
      console.warn("[flux-lora] FAL failed, trying Replicate:", err);
    }
  }

  const replicate = getReplicate();
  if (!replicate) {
    throw new Error("Flux LoRA generation requires FAL_KEY or REPLICATE_API_TOKEN.");
  }

  const repInput: Record<string, unknown> = {
    prompt,
    negative_prompt: input.negativePrompt,
    num_outputs: numImages,
    lora_weights: loraPublic,
    lora_scale: scale,
    guidance: 3.5,
    num_inference_steps: 28,
  };
  const ref = input.referenceImageUrl?.trim();
  if (ref) {
    const refPublic = await resolvePublicMediaUrl(ref);
    if (refPublic) {
      repInput.image = refPublic;
      repInput.prompt_strength = img2imgStrength;
    }
  }

  const output = await withReplicateRetry(
    () =>
      replicate.run(REPLICATE_FLUX_LORA_MODEL as `${string}/${string}`, {
        input: repInput,
      }),
    REPLICATE_FLUX_LORA_MODEL
  );

  const urls = Array.isArray(output)
    ? output.map((u) => String(u)).filter((u) => u.startsWith("http"))
    : [String(output)].filter((u) => u.startsWith("http"));

  if (urls.length === 0) {
    throw new Error("Flux LoRA Replicate returned no images.");
  }

  return {
    urls: urls.slice(0, numImages),
    model: REPLICATE_FLUX_LORA_MODEL,
    provider: "replicate",
  };
}
