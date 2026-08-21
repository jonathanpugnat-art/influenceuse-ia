/**
 * Default-path face-lock — real biometric identity lock on the wizard
 * portrait, applied on every plan that can generate (Free/Creator, Pro, Agency).
 *
 * Priority:
 *   1. Pro/Agency trained LoRA (max fidelity) — FLUX LoRA + wizard portrait
 *      passed as img2img reference for the hybrid path.
 *   2. PuLID face-lock on Replicate (bytedance/flux-pulid) — biometric lock
 *      from a single frontal portrait, no training required.
 *
 * The pipeline deliberately has NO silent T2I fallback: if the face-lock
 * provider refuses the render, the caller must surface a retry/error rather
 * than generating another person. This matches the NSFW lane behaviour and
 * closes the "wizard portrait vs feed post look like two different people"
 * regression flagged in the product audit.
 */
import { LORA_DEFAULT_SCALE } from "@/lib/lora";
import { runFluxLoraBatch } from "@/server/services/image-providers/flux-lora.provider";
import {
  DEFAULT_REPLICATE_PULID_MODEL,
} from "@/server/services/image-providers/replicate-premium.provider";
import { generatePremiumPulidImages } from "./premium-pipeline";

export type FaceLockEngine = "lora" | "pulid";
export type FaceLockProvider = "replicate" | "fal";

export type FaceLockOptions = {
  /** Wizard portrait URL (must be a public http(s) URL). */
  faceUrl: string;
  prompt: string;
  negativePrompt: string;
  numImages: number;
  /** Optional Pro/Agency trained LoRA — takes priority over PuLID when set. */
  lora?: {
    loraUrl: string;
    triggerWord: string;
    scale?: number;
  };
};

export type FaceLockResult = {
  urls: string[];
  engine: FaceLockEngine;
  provider: FaceLockProvider;
  model: string;
};

export function hasReadyLora(
  input: { loraUrl?: string | null; loraTriggerWord?: string | null } | null | undefined
): input is { loraUrl: string; loraTriggerWord: string } {
  if (!input) return false;
  return Boolean(input.loraUrl?.trim() && input.loraTriggerWord?.trim());
}

/**
 * Generate `numImages` face-locked images from a single portrait URL. Throws
 * on any provider failure — callers must never silently fall back to plain
 * T2I because that would generate another person.
 */
export async function generateFaceLockedImages(
  opts: FaceLockOptions
): Promise<FaceLockResult> {
  const face = opts.faceUrl?.trim();
  if (!face || !/^https?:\/\//i.test(face)) {
    throw new Error(
      "[face-lock] MISSING_FACE_REF — face URL is not a public http(s) reference"
    );
  }

  if (opts.lora?.loraUrl?.trim() && opts.lora?.triggerWord?.trim()) {
    const scale = opts.lora.scale ?? LORA_DEFAULT_SCALE;
    console.log(
      `[face-lock] Using trained LoRA (${opts.lora.triggerWord}, scale=${scale}) with portrait img2img`
    );
    const { urls, model, provider } = await runFluxLoraBatch({
      loraUrl: opts.lora.loraUrl,
      triggerWord: opts.lora.triggerWord,
      prompt: opts.prompt,
      negativePrompt: opts.negativePrompt,
      referenceImageUrl: face,
      numImages: opts.numImages,
      loraScale: scale,
    });
    if (urls.length === 0) {
      throw new Error("[face-lock] LoRA returned no images");
    }
    return { urls, engine: "lora", provider, model };
  }

  console.log(
    `[face-lock] Using PuLID face-lock (${DEFAULT_REPLICATE_PULID_MODEL}) on wizard portrait`
  );
  const { urls, model } = await generatePremiumPulidImages(
    face,
    opts.prompt,
    opts.negativePrompt,
    opts.numImages
  );
  if (urls.length === 0) {
    throw new Error("[face-lock] PuLID returned no images");
  }
  return { urls, engine: "pulid", provider: "replicate", model };
}
