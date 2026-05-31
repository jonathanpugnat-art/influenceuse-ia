/** FLUX T2I routing — shared config (safe for tests without server secrets). */

export type ImageT2iProviderMode = "auto" | "fal" | "replicate";

export const DEFAULT_FAL_FLUX_T2I_MODEL = "fal-ai/flux-pro/v1.1";

export function resolveImageT2iProviderMode(
  env: Record<string, string | undefined> = process.env
): ImageT2iProviderMode {
  const raw = env.IMAGE_T2I_PROVIDER?.trim().toLowerCase();
  if (raw === "fal") return "fal";
  if (raw === "replicate") return "replicate";
  return "auto";
}

export function isFalImageConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.FAL_KEY?.trim());
}

export function resolveFalFluxT2iModel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FAL_FLUX_T2I_MODEL?.trim() || DEFAULT_FAL_FLUX_T2I_MODEL;
}

/** Map Flux width/height to FAL `image_size` presets. */
export function mapDimensionsToFalImageSize(
  width?: number,
  height?: number
): string {
  if (width === 1024 && height === 1280) return "portrait_4_3";
  if (width === 1280 && height === 1024) return "landscape_4_3";
  if (width === 1024 && height === 1024) return "square_hd";
  return "portrait_4_3";
}
