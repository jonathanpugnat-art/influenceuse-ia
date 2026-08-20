/** SFW base model — pure T2I (Flux 1.1 Pro), no input_image. */
export const MODEL_SFW_T2I = "black-forest-labs/flux-1.1-pro" as const;

/** SFW content with character reference (Flux Kontext Pro). */
export const MODEL_SFW_KONTEXT = "black-forest-labs/flux-kontext-pro" as const;

/** Default SFW content engine — Google Nano Banana on Replicate. */
export const MODEL_SFW_NANO = "google/nano-banana" as const;

/**
 * Upgraded SFW content engine — ByteDance Seedream 4 on Replicate.
 * Unified text-to-image + multi-reference editing (1-10 refs), up to 4K.
 * Better skin/hair/lighting realism than Nano Banana. Drives the same
 * face-referenced lane (identity pack → `image_input`).
 */
export const MODEL_SFW_SEEDREAM = "bytedance/seedream-4" as const;

/** Premium face-lock — bytedance/flux-pulid. */
export const MODEL_PREMIUM_PULID = "bytedance/flux-pulid" as const;

export const NANO_BANANA_DEFAULTS = {
  aspect_ratio: "3:4",
  output_format: "jpg",
} as const;

/**
 * Seedream 4 defaults. No `output_format` (model returns webp). `size: "2K"`
 * gives 2048px output; `aspect_ratio: "3:4"` keeps feed/portrait parity with
 * the Nano/Kontext lanes instead of matching the reference image ratio.
 */
export const SEEDREAM_DEFAULTS = {
  size: "2K",
  aspect_ratio: "3:4",
} as const;

export type SfwReferenceModel = typeof MODEL_SFW_NANO | typeof MODEL_SFW_SEEDREAM;

/**
 * Which engine drives the SFW face-referenced lane. Defaults to Seedream 4
 * (the upgraded engine). Set `SFW_IMAGE_MODEL=nano` to instantly revert to
 * Google Nano Banana without a redeploy.
 */
export function resolveSfwReferenceModel(): SfwReferenceModel {
  const raw = (process.env.SFW_IMAGE_MODEL ?? "").trim().toLowerCase();
  if (raw === "nano" || raw === "nano-banana" || raw === "nano_banana") {
    return MODEL_SFW_NANO;
  }
  return MODEL_SFW_SEEDREAM;
}
