/** SFW base model — pure T2I (Flux 1.1 Pro), no input_image. */
export const MODEL_SFW_T2I = "black-forest-labs/flux-1.1-pro" as const;

/** SFW content with character reference (Flux Kontext Pro). */
export const MODEL_SFW_KONTEXT = "black-forest-labs/flux-kontext-pro" as const;

/** Default SFW content engine — Google Nano Banana on Replicate. */
export const MODEL_SFW_NANO = "google/nano-banana" as const;

/** Premium face-lock — bytedance/flux-pulid. */
export const MODEL_PREMIUM_PULID = "bytedance/flux-pulid" as const;

export const NANO_BANANA_DEFAULTS = {
  aspect_ratio: "3:4",
  output_format: "jpg",
} as const;
