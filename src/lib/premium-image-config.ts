/** Premium (OnlyFans lane) FLUX routing — Together / self-host / Replicate fallback. */

export type PremiumImageProviderMode =
  | "auto"
  | "together"
  | "selfhost"
  | "replicate";

export type PremiumModerationMode = "auto" | "sightengine" | "off";

export const DEFAULT_TOGETHER_FLUX_MODEL = "black-forest-labs/FLUX.2-dev";

/** Replicate fallback when Together/self-host unavailable. */
export const DEFAULT_REPLICATE_PREMIUM_MODEL =
  "lucataco/flux-dev-uncensored" as const;

export function resolvePremiumImageProviderMode(
  env: Record<string, string | undefined> = process.env
): PremiumImageProviderMode {
  const raw = env.PREMIUM_IMAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "together") return "together";
  if (raw === "selfhost") return "selfhost";
  if (raw === "replicate") return "replicate";
  return "auto";
}

export function isTogetherConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.TOGETHER_API_KEY?.trim());
}

export function isPremiumSelfHostConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.PREMIUM_SELFHOST_URL?.trim());
}

export function resolveTogetherFluxModel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.TOGETHER_FLUX_MODEL?.trim() || DEFAULT_TOGETHER_FLUX_MODEL;
}

export function resolvePremiumSelfHostUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  const url = env.PREMIUM_SELFHOST_URL?.trim();
  return url || null;
}

export function resolvePremiumModerationMode(
  env: Record<string, string | undefined> = process.env
): PremiumModerationMode {
  const raw = env.PREMIUM_IMAGE_MODERATION?.trim().toLowerCase();
  if (raw === "sightengine") return "sightengine";
  if (raw === "off") return "off";
  return "auto";
}

export function isSightengineConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(
    env.SIGHTENGINE_API_USER?.trim() && env.SIGHTENGINE_API_SECRET?.trim()
  );
}

/** Reject image when raw nudity score >= this (0–1). Default 0.55. */
export function resolvePremiumModerationRawThreshold(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.PREMIUM_MODERATION_RAW_THRESHOLD?.trim();
  const n = raw ? Number(raw) : 0.55;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.55;
}

/** Reject when partial nudity score >= this (0–1). Default 0.82. */
export function resolvePremiumModerationPartialThreshold(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.PREMIUM_MODERATION_PARTIAL_THRESHOLD?.trim();
  const n = raw ? Number(raw) : 0.82;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.82;
}

export function shouldUsePremiumModeration(
  env: Record<string, string | undefined> = process.env
): boolean {
  const mode = resolvePremiumModerationMode(env);
  if (mode === "off") return false;
  if (mode === "sightengine") {
    if (!isSightengineConfigured(env)) {
      throw new Error(
        "PREMIUM_IMAGE_MODERATION=sightengine but SIGHTENGINE_API_USER/SECRET are missing."
      );
    }
    return true;
  }
  return isSightengineConfigured(env);
}
