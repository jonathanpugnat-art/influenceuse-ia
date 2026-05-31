import type { ReelStylePreset } from "@/lib/prompts/video-prompts";

export type VideoI2vProviderMode = "auto" | "fal" | "replicate";

export const DEFAULT_FAL_KLING_I2V_MODEL =
  "fal-ai/kling-video/v3/standard/image-to-video";

/** Presets that use image→video with a start frame (eligible for FAL Kling). */
export const FAL_KLING_ELIGIBLE_PRESETS: ReelStylePreset[] = [
  "stable_face",
  "natural_motion",
  "classic_motion",
  "lip_sync",
];

export function resolveVideoI2vProviderMode(
  env: Record<string, string | undefined> = process.env
): VideoI2vProviderMode {
  const raw = env.VIDEO_I2V_PROVIDER?.trim().toLowerCase();
  if (raw === "fal") return "fal";
  if (raw === "replicate") return "replicate";
  return "auto";
}

export function isFalVideoConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.FAL_KEY?.trim());
}

export function resolveFalKlingI2vModel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FAL_KLING_I2V_MODEL?.trim() || DEFAULT_FAL_KLING_I2V_MODEL;
}

export function shouldRoutePresetToFalKling(preset: ReelStylePreset): boolean {
  return FAL_KLING_ELIGIBLE_PRESETS.includes(preset);
}

export function shouldTryFalKlingI2v(opts: {
  preset: ReelStylePreset;
  hasStartFrame: boolean;
  env?: Record<string, string | undefined>;
}): boolean {
  const env = opts.env ?? process.env;
  if (!opts.hasStartFrame) return false;
  if (!shouldRoutePresetToFalKling(opts.preset)) return false;

  const mode = resolveVideoI2vProviderMode(env);
  if (mode === "replicate") return false;
  if (mode === "fal") return isFalVideoConfigured(env);
  return isFalVideoConfigured(env);
}
