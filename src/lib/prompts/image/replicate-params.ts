/**
 * Default Replicate generation parameters for **Flux 1.1 Pro** (legacy SFW
 * path) and **Flux Dev Uncensored** (NSFW). Used when the model accepts
 * width/height/guidance_scale/etc.
 *
 * Sprint 14 — bumped from 1024x1024 to 1024x1280 (3:4) to match Kontext +
 * Nano Banana + portrait wizard. See KONTEXT_IMAGE_PARAMS comment.
 */
export const DEFAULT_IMAGE_PARAMS = {
  width: 1024,
  height: 1280,
  num_inference_steps: 35,
  guidance_scale: 3.5,
  output_format: "jpg" as const,
  output_quality: 92,
};

/** Portrait-ratio params for close-up portraits (wizard base image — high quality) */
/** Flux fallback for wizard portrait (when Nano safety-blocks). */
export const PORTRAIT_IMAGE_PARAMS = {
  width: 1024,
  height: 1280,
  num_inference_steps: 35,
  guidance_scale: 3.2,
  output_format: "jpg" as const,
  output_quality: 88,
};

/**
 * Sprint 11 — Flux Kontext Pro inputs.
 * Schema is intentionally minimal: this model has NO negative_prompt, NO
 * guidance_scale, NO num_inference_steps. The prompt itself drives quality.
 * Safety tolerance is capped to 2 by Black Forest when input_image is sent.
 *
 * Sprint 14 — aspect ratio bumped from 1:1 to 3:4 (Grok feedback): the
 * portrait wizard ships in 3:4 (1024x1280) but content used to render in
 * 1:1 (1024x1024). The mismatch made every influencer look like "two
 * different people" between her base portrait and her feed posts. Going
 * 3:4 across the board also matches Instagram Reels / Stories / TikTok's
 * native vertical canvas — better engagement, no cropping.
 */
export const KONTEXT_IMAGE_PARAMS = {
  aspect_ratio: "3:4" as const,
  output_format: "jpg" as const,
  prompt_upsampling: false as const,
  safety_tolerance: 2 as const,
};

export const KONTEXT_PORTRAIT_PARAMS = {
  aspect_ratio: "3:4" as const,
  output_format: "jpg" as const,
  prompt_upsampling: false as const,
  safety_tolerance: 2 as const,
};
