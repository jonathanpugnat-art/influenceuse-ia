/** Premium (OnlyFans lane) FLUX routing — Together / self-host / Replicate fallback. */

export type PremiumImageProviderMode =
  | "auto"
  | "together"
  | "selfhost"
  | "replicate";

export type PremiumModerationMode = "auto" | "sightengine" | "off";

export const DEFAULT_TOGETHER_FLUX_MODEL = "black-forest-labs/FLUX.2-dev";

/** Replicate uncensored model for Premium lane (community FLUX — version resolved at runtime). */
export const DEFAULT_REPLICATE_PREMIUM_MODEL =
  "aisha-ai-official/flux.1dev-uncensored-msfluxnsfw-v3" as const;

export function resolveReplicatePremiumModel(
  env: Record<string, string | undefined> = process.env
): string {
  return (
    env.PREMIUM_REPLICATE_MODEL?.trim() ||
    env.PREMIUM_FLUX_MODEL?.trim() ||
    DEFAULT_REPLICATE_PREMIUM_MODEL
  );
}

export function isReplicatePremiumConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.REPLICATE_API_TOKEN?.trim());
}

/**
 * Novita InstantID — face-locked engine for the NSFW `explicit` tier.
 * Flux/PuLID is weak on explicit anatomy, so explicit runs on an uncensored
 * SDXL checkpoint + InstantID (face from a single frontal portrait). Default
 * checkpoint is a documented Novita SDXL slug; override with PREMIUM_NOVITA_MODEL
 * to pick a realistic NSFW checkpoint from Novita's model library.
 */
export const DEFAULT_NOVITA_INSTANTID_MODEL =
  "epicrealismXL_v10_247189.safetensors" as const;

export function resolveNovitaApiKey(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  return env.NOVITA_API_KEY?.trim() || undefined;
}

export function isNovitaConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(resolveNovitaApiKey(env));
}

export function resolveNovitaInstantIdModel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.PREMIUM_NOVITA_MODEL?.trim() || DEFAULT_NOVITA_INSTANTID_MODEL;
}

function resolveUnitInterval(
  raw: string | undefined,
  fallback: number
): number {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

/** InstantID identity lock strength (0–1). Higher = closer to the face. Default 0.8. */
export function resolveNovitaIdStrength(
  env: Record<string, string | undefined> = process.env
): number {
  return resolveUnitInterval(env.PREMIUM_NOVITA_ID_STRENGTH?.trim(), 0.72);
}

/** InstantID IP-Adapter strength (0–1). Higher = stronger face features. Default 0.75. */
export function resolveNovitaAdapterStrength(
  env: Record<string, string | undefined> = process.env
): number {
  return resolveUnitInterval(env.PREMIUM_NOVITA_ADAPTER_STRENGTH?.trim(), 0.75);
}

export function resolvePremiumTogetherFluxModel(
  env: Record<string, string | undefined> = process.env
): string {
  const model =
    env.PREMIUM_TOGETHER_FLUX_MODEL?.trim() || env.PREMIUM_FLUX_MODEL?.trim();
  if (!model) {
    throw new Error(
      "PREMIUM_TOGETHER_FLUX_MODEL is required for Together premium images. " +
        "Use PREMIUM_IMAGE_PROVIDER=replicate (flux-dev-uncensored) instead."
    );
  }
  return model;
}

/** Post-gen Sightengine — skip for soft/explicit tiers (Aura pre-check only). */
export function shouldPostModeratePremiumGeneration(
  nsfwLevel: string | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  const mode = resolvePremiumModerationMode(env);
  if (mode === "off") return false;
  if (mode === "sightengine") {
    return isSightengineConfigured(env);
  }
  if (!isSightengineConfigured(env)) return false;
  const tier = nsfwLevel === "explicit" || nsfwLevel === "soft" ? nsfwLevel : "suggestive";
  return tier === "suggestive";
}

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

export function resolvePremiumSelfHostModelLabel(
  env: Record<string, string | undefined> = process.env
): string {
  return env.PREMIUM_SELFHOST_MODEL_LABEL?.trim() || "selfhost/flux";
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
