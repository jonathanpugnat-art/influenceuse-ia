/**
 * NSFW Pro V1 — WaveSpeed Wan 2.2 Spicy image-to-video.
 *
 * Isolated from the SFW cascade (Kling scene I2V, Motion Control, remix).
 * Default OFF until `NSFW_ENGINE=wavespeed_spicy` is set. Free/Creator
 * never reach this engine.
 *
 * Model verified 2026-09 on wavespeed.ai:
 *   POST https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.2-spicy/image-to-video
 *   GET  https://api.wavespeed.ai/api/v3/predictions/{id}/result
 */

import { CREDIT_COSTS } from "@/lib/constants";

export const NSFW_ENGINES = ["off", "wavespeed_spicy"] as const;
export type NsfwEngine = (typeof NSFW_ENGINES)[number];

export const WAVESPEED_SPICY_ENGINE = "wavespeed_spicy" as const;

export const WAVESPEED_SPICY_DEFAULT_MODEL =
  "wavespeed-ai/wan-2.2-spicy/image-to-video";

export const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";

export const WAVESPEED_SPICY_ALLOWED_DURATIONS = [5, 8] as const;
export type WavespeedSpicyDuration =
  (typeof WAVESPEED_SPICY_ALLOWED_DURATIONS)[number];

export const WAVESPEED_SPICY_ALLOWED_RESOLUTIONS = ["480p", "720p"] as const;
export type WavespeedSpicyResolution =
  (typeof WAVESPEED_SPICY_ALLOWED_RESOLUTIONS)[number];

export const WAVESPEED_SPICY_ASPECT_RATIO = "9:16" as const;

export const WAVESPEED_SPICY_PROVIDER_USD: Record<
  WavespeedSpicyResolution,
  Record<WavespeedSpicyDuration, number>
> = {
  "480p": { 5: 0.15, 8: 0.24 },
  "720p": { 5: 0.3, 8: 0.48 },
};

const CREDIT_MATRIX: Record<
  WavespeedSpicyResolution,
  Record<WavespeedSpicyDuration, number>
> = {
  "480p": {
    5: CREDIT_COSTS.WAVESPEED_SPICY_480P_5S,
    8: CREDIT_COSTS.WAVESPEED_SPICY_480P_8S,
  },
  "720p": {
    5: CREDIT_COSTS.WAVESPEED_SPICY_720P_5S,
    8: CREDIT_COSTS.WAVESPEED_SPICY_720P_8S,
  },
};

export const NSFW_ENGINE_UNREACHABLE_MESSAGE =
  "Moteur adulte indisponible.";

export const WAVESPEED_MISSING_KEY_MESSAGE =
  "La génération adulte est indisponible : clé WaveSpeed manquante. Aucun crédit n'a été débité.";

export const NSFW_PLAN_REQUIRED_MESSAGE =
  "La génération adulte est réservée au plan Pro.";

export const NSFW_CHARACTER_REQUIRED_MESSAGE =
  "Active le contenu adulte sur ce personnage avant d'utiliser la génération WaveSpeed.";

export const NSFW_CONSENT_REQUIRED_MESSAGE =
  "Coche la case de consentement (contenu synthétique, pas de personne réelle) avant de générer.";

export const NSFW_AGE_REQUIRED_MESSAGE =
  "Le personnage doit avoir 18 ans ou plus. Génération adulte refusée.";

export const WAVESPEED_SUBMIT_FAILED_MESSAGE =
  "Impossible de lancer la génération adulte. Les crédits ont été remboursés.";

export type WavespeedSpicyGateCode =
  | "UNREACHABLE"
  | "MISSING_KEY"
  | "PLAN"
  | "NOT_NSFW"
  | "CONSENT"
  | "AGE";

export type WavespeedSpicyGate =
  | { ok: true }
  | { ok: false; code: WavespeedSpicyGateCode; message: string };

export function getNsfwEngine(
  env: Record<string, string | undefined> = process.env
): NsfwEngine {
  const raw = env.NSFW_ENGINE?.trim().toLowerCase();
  if (raw === WAVESPEED_SPICY_ENGINE) return WAVESPEED_SPICY_ENGINE;
  return "off";
}

export function isWavespeedSpicyReachable(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getNsfwEngine(env) === WAVESPEED_SPICY_ENGINE;
}

export function isWavespeedApiConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.WAVESPEED_API_KEY?.trim());
}

export function resolveWavespeedSpicyModelId(
  env: Record<string, string | undefined> = process.env
): string {
  return (
    env.WAVESPEED_SPICY_I2V_MODEL?.trim() || WAVESPEED_SPICY_DEFAULT_MODEL
  );
}

export function estimateWavespeedSpicyCredits(
  resolution: WavespeedSpicyResolution,
  durationSec: WavespeedSpicyDuration
): number {
  return CREDIT_MATRIX[resolution][durationSec];
}

export function clampWavespeedSpicyDuration(
  requested: number
): WavespeedSpicyDuration {
  if (
    WAVESPEED_SPICY_ALLOWED_DURATIONS.includes(
      requested as WavespeedSpicyDuration
    )
  ) {
    return requested as WavespeedSpicyDuration;
  }
  if (!Number.isFinite(requested) || requested <= 0) {
    return 5;
  }
  const sorted = [...WAVESPEED_SPICY_ALLOWED_DURATIONS];
  let picked: WavespeedSpicyDuration = sorted[0];
  for (const d of sorted) {
    if (d <= requested) picked = d;
  }
  return picked;
}

export function clampWavespeedSpicyResolution(
  requested: string | null | undefined
): WavespeedSpicyResolution {
  const r = (requested ?? "").toLowerCase();
  if (r === "480p" || r === "720p") return r;
  return "720p";
}

export function evaluateWavespeedSpicyGate(input: {
  env?: Record<string, string | undefined>;
  planHasNsfw: boolean;
  influencerIsNsfw: boolean;
  consentAccepted: boolean;
  influencerAge: number;
}): WavespeedSpicyGate {
  const env = input.env ?? process.env;
  if (!isWavespeedSpicyReachable(env)) {
    return {
      ok: false,
      code: "UNREACHABLE",
      message: NSFW_ENGINE_UNREACHABLE_MESSAGE,
    };
  }
  if (!input.planHasNsfw) {
    return { ok: false, code: "PLAN", message: NSFW_PLAN_REQUIRED_MESSAGE };
  }
  if (!isWavespeedApiConfigured(env)) {
    return {
      ok: false,
      code: "MISSING_KEY",
      message: WAVESPEED_MISSING_KEY_MESSAGE,
    };
  }
  if (!input.influencerIsNsfw) {
    return {
      ok: false,
      code: "NOT_NSFW",
      message: NSFW_CHARACTER_REQUIRED_MESSAGE,
    };
  }
  if (!input.consentAccepted) {
    return {
      ok: false,
      code: "CONSENT",
      message: NSFW_CONSENT_REQUIRED_MESSAGE,
    };
  }
  if (!Number.isFinite(input.influencerAge) || input.influencerAge < 18) {
    return { ok: false, code: "AGE", message: NSFW_AGE_REQUIRED_MESSAGE };
  }
  return { ok: true };
}

export function trpcCodeForWavespeedGate(
  code: WavespeedSpicyGateCode
): "NOT_FOUND" | "FORBIDDEN" | "PRECONDITION_FAILED" {
  switch (code) {
    case "UNREACHABLE":
      return "NOT_FOUND";
    case "PLAN":
      return "FORBIDDEN";
    case "MISSING_KEY":
    case "NOT_NSFW":
    case "CONSENT":
    case "AGE":
      return "PRECONDITION_FAILED";
    default: {
      const _never: never = code;
      throw new Error(`Unhandled WaveSpeed gate: ${String(_never)}`);
    }
  }
}

export interface WavespeedSpicyValidationIssue {
  code:
    | "no_prompt"
    | "prompt_too_long"
    | "no_image"
    | "invalid_duration"
    | "invalid_resolution";
  message: string;
}

export function validateWavespeedSpicyRequest(input: {
  prompt: string;
  imageUrl: string;
  duration: number;
  resolution: string;
}): WavespeedSpicyValidationIssue | null {
  if (!input.prompt || input.prompt.trim().length === 0) {
    return {
      code: "no_prompt",
      message: "Décris le mouvement en une phrase avant de générer.",
    };
  }
  if (input.prompt.length > 1200) {
    return {
      code: "prompt_too_long",
      message: "Prompt trop long (max 1200 caractères).",
    };
  }
  if (!input.imageUrl.startsWith("http")) {
    return {
      code: "no_image",
      message:
        "Ce personnage n'a pas encore de portrait de référence. Termine l'assistant de création avant de générer.",
    };
  }
  if (
    !WAVESPEED_SPICY_ALLOWED_DURATIONS.includes(
      input.duration as WavespeedSpicyDuration
    )
  ) {
    return {
      code: "invalid_duration",
      message: "Durée non supportée. Choisis 5 ou 8 secondes.",
    };
  }
  const res = input.resolution.toLowerCase();
  if (res !== "480p" && res !== "720p") {
    return {
      code: "invalid_resolution",
      message: "Résolution non supportée. Choisis 480p ou 720p.",
    };
  }
  return null;
}

export interface WavespeedSpicyPricingSnapshot {
  engine: typeof WAVESPEED_SPICY_ENGINE;
  label: string;
  modelId: string;
  allowedDurations: readonly WavespeedSpicyDuration[];
  allowedResolutions: readonly WavespeedSpicyResolution[];
  defaultDurationSec: WavespeedSpicyDuration;
  defaultResolution: WavespeedSpicyResolution;
  providerUsd: typeof WAVESPEED_SPICY_PROVIDER_USD;
  matrix: Array<{
    resolution: WavespeedSpicyResolution;
    durationSec: WavespeedSpicyDuration;
    credits: number;
    providerUsd: number;
  }>;
}

export function getWavespeedSpicyPricingSnapshot(): WavespeedSpicyPricingSnapshot {
  const matrix = WAVESPEED_SPICY_ALLOWED_RESOLUTIONS.flatMap((resolution) =>
    WAVESPEED_SPICY_ALLOWED_DURATIONS.map((durationSec) => ({
      resolution,
      durationSec,
      credits: estimateWavespeedSpicyCredits(resolution, durationSec),
      providerUsd: WAVESPEED_SPICY_PROVIDER_USD[resolution][durationSec],
    }))
  );
  return {
    engine: WAVESPEED_SPICY_ENGINE,
    label: "Génération adulte (WaveSpeed)",
    modelId: WAVESPEED_SPICY_DEFAULT_MODEL,
    allowedDurations: WAVESPEED_SPICY_ALLOWED_DURATIONS,
    allowedResolutions: WAVESPEED_SPICY_ALLOWED_RESOLUTIONS,
    defaultDurationSec: 5,
    defaultResolution: "720p",
    providerUsd: WAVESPEED_SPICY_PROVIDER_USD,
    matrix,
  };
}
