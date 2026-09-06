/**
 * Seedance scene-video V1 — bytedance/seedance-2.5 via fal.ai.
 *
 * This is the "scene 10-30s, locked face, native audio" engine. It does
 * NOT replace:
 *   - Kling remix (V2V motion-swap ≤ 15s, see `remix-config.ts`), or
 *   - Hedra talking-head (locked character reads a script, see
 *     `talking-head.ts`).
 *
 * The identity pack (frontal + up to 3 alt angles) is passed as
 * `image_urls` and referenced from the prompt as @Image1 / @Image2 / …
 * When the character only has a single still we fall back to the
 * `image-to-video` endpoint (documented on the same page).
 *
 * Credit rates come from `CREDIT_COSTS.SEEDANCE_*_PER_SEC` (constants.ts)
 * and are calibrated for a ≥ 3× margin against the fal list price
 * assuming 1 Aura credit ≈ $0.04 USD.
 */

import { CREDIT_COSTS } from "@/lib/constants";

// ──────────────────────────────────────────────
// Enums / constants
// ──────────────────────────────────────────────

export const SEEDANCE_ALLOWED_DURATIONS = [10, 15, 30] as const;
export type SeedanceDuration = (typeof SEEDANCE_ALLOWED_DURATIONS)[number];

export const SEEDANCE_ALLOWED_RESOLUTIONS = ["480p", "720p"] as const;
export type SeedanceResolution = (typeof SEEDANCE_ALLOWED_RESOLUTIONS)[number];

export const SEEDANCE_MODES = [
  "reference_to_video",
  "image_to_video",
] as const;
export type SeedanceMode = (typeof SEEDANCE_MODES)[number];

/** V1 is 9:16-only (mobile-first). */
export const SEEDANCE_ASPECT_RATIO = "9:16" as const;

/** Hard cap that maps to `SEEDANCE_ALLOWED_DURATIONS[max]`. */
export const SEEDANCE_MAX_DURATION_SEC = 30;

/**
 * Seedance accepts up to 30 image references but for identity-locking
 * we only ship the 4 wizard shots (frontal + profile + 3/4 + full body).
 * Extra refs would dilute the character embedding.
 */
export const SEEDANCE_MAX_REFERENCES = 4;

/** Aura credits per second, indexed by resolution. */
export const SEEDANCE_CREDITS_PER_SEC: Record<SeedanceResolution, number> = {
  "480p": CREDIT_COSTS.SEEDANCE_480P_PER_SEC,
  "720p": CREDIT_COSTS.SEEDANCE_720P_PER_SEC,
};

/**
 * Default fal model ids for each mode. Overridable via env for staging /
 * A/B experiments — see `.env.example` (`FAL_SEEDANCE_*_MODEL`).
 */
export const SEEDANCE_DEFAULT_MODELS: Record<SeedanceMode, string> = {
  reference_to_video: "bytedance/seedance-2.5/reference-to-video",
  image_to_video: "bytedance/seedance-2.5/image-to-video",
};

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export function resolveSeedanceModelId(
  mode: SeedanceMode,
  env: Record<string, string | undefined> = process.env
): string {
  const overrideKey =
    mode === "reference_to_video"
      ? "FAL_SEEDANCE_REFERENCE_MODEL"
      : "FAL_SEEDANCE_I2V_MODEL";
  return env[overrideKey]?.trim() || SEEDANCE_DEFAULT_MODELS[mode];
}

/**
 * Total Aura credits held for a scene of the given resolution and
 * duration. Ceils per whole second — Seedance always emits full seconds
 * so we never over-charge and never under-charge.
 */
export function estimateSeedanceCredits(
  resolution: SeedanceResolution,
  durationSec: SeedanceDuration
): number {
  const perSec = SEEDANCE_CREDITS_PER_SEC[resolution];
  return Math.ceil(perSec * durationSec);
}

/**
 * Clamp a client-supplied duration to the allowed set. Anything outside
 * `SEEDANCE_ALLOWED_DURATIONS` snaps to the closest LOWER value so we
 * never bill for a longer clip than the user picked.
 */
export function clampSeedanceDuration(requested: number): SeedanceDuration {
  if (SEEDANCE_ALLOWED_DURATIONS.includes(requested as SeedanceDuration)) {
    return requested as SeedanceDuration;
  }
  if (!Number.isFinite(requested) || requested <= 0) {
    return SEEDANCE_ALLOWED_DURATIONS[0];
  }
  // Snap to the largest allowed value that does not exceed the request.
  const sorted = [...SEEDANCE_ALLOWED_DURATIONS].sort((a, b) => a - b);
  let picked: SeedanceDuration = sorted[0];
  for (const d of sorted) {
    if (d <= requested) picked = d;
  }
  return picked;
}

export function clampSeedanceResolution(
  requested: string | null | undefined
): SeedanceResolution {
  const r = (requested ?? "").toLowerCase();
  if (r === "480p" || r === "720p") return r;
  return "720p";
}

/**
 * V1 canary (Luana 2026-09-06): Fal `reference-to-video` 422s photoreal
 * identity packs. Always submit `image-to-video` with the frontal still
 * only (`image_url`, never more than one image). Lift this flag to
 * re-enable multi-ref r2v after Fal accepts packs.
 */
export const SEEDANCE_V1_SINGLE_FRONTAL_I2V = true;

/**
 * Fal endpoint picker from usable http refs:
 *   0–1 still → image-to-video (`image_url`)
 *   2+ stills → reference-to-video (`image_urls`)
 *
 * createSeedanceJob does not call this while
 * `SEEDANCE_V1_SINGLE_FRONTAL_I2V` is on — it always plans i2v + frontal.
 */
export function resolveSeedanceMode(
  referenceImageUrls: readonly string[]
): SeedanceMode {
  return referenceImageUrls.length >= 2
    ? "reference_to_video"
    : "image_to_video";
}

export function usableSeedanceRefs(
  referenceImageUrls: readonly string[]
): string[] {
  return referenceImageUrls
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
}

/**
 * What we actually send to Fal. V1 canary: frontal only + i2v.
 * When the canary is lifted: 1 ref → i2v, 2+ → r2v (capped).
 */
export function planSeedanceSubmit(referenceImageUrls: readonly string[]): {
  mode: SeedanceMode;
  imageUrls: string[];
} {
  const usable = usableSeedanceRefs(referenceImageUrls);
  if (SEEDANCE_V1_SINGLE_FRONTAL_I2V) {
    const frontal = usable[0];
    return {
      mode: "image_to_video",
      imageUrls: frontal ? [frontal] : [],
    };
  }
  const mode = resolveSeedanceMode(usable);
  if (mode === "image_to_video") {
    const frontal = usable[0];
    return { mode, imageUrls: frontal ? [frontal] : [] };
  }
  return {
    mode,
    imageUrls: usable.slice(0, SEEDANCE_MAX_REFERENCES),
  };
}

/**
 * Build the Seedance prompt template. The @Image1 marker binds the
 * generated shot to the frontal reference (identity lock). Extra tail
 * lets the user add situational details ("holding coffee", "voix
 * chuchotée"). Native audio is on by default so we tell the model to
 * behave naturally — no explicit dialogue unless the user typed one.
 */
export function buildSeedancePrompt(opts?: {
  characterName?: string | null;
  scene?: string | null;
  extra?: string | null;
}): string {
  const character = opts?.characterName?.trim();
  const scene = opts?.scene?.trim();
  const parts: string[] = [];

  const heroClause = character
    ? `@Image1 (${character})`
    : `@Image1`;
  if (scene) {
    parts.push(`${heroClause} ${scene}`.replace(/\s+/g, " ").trim());
  } else {
    parts.push(
      `${heroClause} holding the entire shot, natural motion, looking at camera occasionally.`
    );
  }

  parts.push(
    `Vertical 9:16 framing, cinematic realism, natural skin, no morphing face.`
  );
  parts.push(
    `Native ambient audio and light footsteps or breathing where relevant. Keep the same character throughout the shot.`
  );

  const extra = opts?.extra?.trim();
  if (extra) parts.push(extra);
  return parts.join(" ");
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

export interface SeedanceValidationIssue {
  code:
    | "no_scene_prompt"
    | "no_identity_reference"
    | "prompt_too_long"
    | "invalid_duration"
    | "invalid_resolution";
  message: string;
}

/**
 * Server-side pre-flight. Runs BEFORE we hold credits so a malformed
 * request never charges the user. Purely deterministic — same result on
 * client and server so the UI can render the exact error we would
 * surface from tRPC.
 */
export function validateSeedanceRequest(input: {
  scenePrompt: string;
  referenceImageUrls: readonly string[];
  duration: number;
  resolution: string;
}): SeedanceValidationIssue | null {
  if (!input.scenePrompt || input.scenePrompt.trim().length === 0) {
    return {
      code: "no_scene_prompt",
      message: "Décris la scène en une phrase avant de générer.",
    };
  }
  if (input.scenePrompt.length > 1200) {
    return {
      code: "prompt_too_long",
      message: "Scène trop longue (max 1200 caractères).",
    };
  }
  if (input.referenceImageUrls.length === 0) {
    return {
      code: "no_identity_reference",
      message:
        "Ce personnage n'a pas encore de portrait de référence. Termine l'assistant de création avant de générer une scène.",
    };
  }
  if (
    !SEEDANCE_ALLOWED_DURATIONS.includes(input.duration as SeedanceDuration)
  ) {
    return {
      code: "invalid_duration",
      message: "Durée non supportée. Choisis 10, 15 ou 30 secondes.",
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

/**
 * Snapshot of the pricing/config the UI needs to render the picker and
 * the cost preview WITHOUT needing to call the server. Kept as a static
 * shape so the client bundle stays lean.
 */
export interface SeedancePricingSnapshot {
  allowedDurations: readonly SeedanceDuration[];
  allowedResolutions: readonly SeedanceResolution[];
  creditsPerSec: Record<SeedanceResolution, number>;
  matrix: Array<{
    resolution: SeedanceResolution;
    durationSec: SeedanceDuration;
    credits: number;
  }>;
  defaultDurationSec: SeedanceDuration;
  defaultResolution: SeedanceResolution;
}

export function getSeedancePricingSnapshot(): SeedancePricingSnapshot {
  const matrix = SEEDANCE_ALLOWED_RESOLUTIONS.flatMap((resolution) =>
    SEEDANCE_ALLOWED_DURATIONS.map((durationSec) => ({
      resolution,
      durationSec,
      credits: estimateSeedanceCredits(resolution, durationSec),
    }))
  );
  return {
    allowedDurations: SEEDANCE_ALLOWED_DURATIONS,
    allowedResolutions: SEEDANCE_ALLOWED_RESOLUTIONS,
    creditsPerSec: { ...SEEDANCE_CREDITS_PER_SEC },
    matrix,
    // Default = 15s 720p per PRD.
    defaultDurationSec: 15,
    defaultResolution: "720p",
  };
}
