/**
 * Remix engine routing (independent from `SCENE_ENGINE`).
 *
 * SCENE_ENGINE stays `kling_o3_i2v` — do not re-enable Seedance for
 * photoreal faces from this module.
 *
 * Default product path is `motion_control_cascade` (max
 * `REMIX_CASCADE_MAX_ATTEMPTS` submits per hold):
 *   P0a Kling Motion Control v2.6 std → v3 std → v3 pro
 *   P0b Viggle POST /v1/renders when `VIGGLE_API_KEY` is set ($0.01/s)
 *   P0c Fal Wan 2.2 animate/replace (same FAL_KEY + queue + webhook)
 *
 * TODO(nsfw-adult-provider): Pro NSFW / hard adult generation is out of
 * scope for Remix V2. Kling Motion Control, Viggle and Seedance will keep
 * refusing explicit adult clips — ship a dedicated adult provider before
 * enabling that lane. Do not route this PR through WaveSpeed (#18).
 */

import {
  REMIX_IMAGE_ORIENTATION_MAX_SEC,
  REMIX_MOTION_CONTROL_PRO_MODEL,
  REMIX_MOTION_CONTROL_STANDARD_MODEL,
  REMIX_MOTION_CONTROL_V26_STANDARD_MODEL,
  REMIX_VIGGLE_MODEL_ID,
  type RemixOrientation,
  type RemixTier,
  resolveRemixModelId,
  resolveRemixMotionControlModelId,
  resolveRemixO1EditModelId,
  resolveRemixWanReplaceModelId,
} from "@/lib/remix-config";

export const REMIX_ENGINES = [
  "motion_control_cascade",
  "motion_control_v3_std",
  "kling_o3_v2v",
] as const;
export type RemixEngine = (typeof REMIX_ENGINES)[number];

export const DEFAULT_REMIX_ENGINE: RemixEngine = "motion_control_cascade";

/** 1 primary + 2 fallbacks max per credit hold on the cascade engine. */
export const REMIX_CASCADE_MAX_ATTEMPTS = 3;

/** In-process cap: content_policy advances per user / 10 min. */
export const REMIX_CONTENT_POLICY_RATE_LIMIT = 6;
export const REMIX_CONTENT_POLICY_RATE_WINDOW_MS = 10 * 60 * 1000;

const contentPolicyAdvancesByUser = new Map<string, number[]>();

export function resetRemixContentPolicyRateLimit(): void {
  contentPolicyAdvancesByUser.clear();
}

/**
 * Record one content_policy advance. Returns false when the user is already
 * at the window cap — caller must stop the cascade (no extra provider submit).
 */
export function consumeRemixContentPolicyAdvance(
  userId: string,
  now = Date.now()
): boolean {
  const windowStart = now - REMIX_CONTENT_POLICY_RATE_WINDOW_MS;
  const recent = (contentPolicyAdvancesByUser.get(userId) ?? []).filter(
    (ts) => ts > windowStart
  );
  if (recent.length >= REMIX_CONTENT_POLICY_RATE_LIMIT) {
    contentPolicyAdvancesByUser.set(userId, recent);
    return false;
  }
  recent.push(now);
  contentPolicyAdvancesByUser.set(userId, recent);
  return true;
}

export const REMIX_ATTEMPT_KINDS = [
  "motion_control",
  "viggle",
  "wan_replace",
  "o1_v2v_edit",
  "kling_o3_v2v",
] as const;
export type RemixAttemptKind = (typeof REMIX_ATTEMPT_KINDS)[number];

export type RemixMotionControlVariant = "v26_std" | "v3_std" | "v3_pro";

export type RemixErrorClass = "content_policy" | "other";

export type RemixAttempt =
  | {
      kind: "motion_control";
      engine: "motion_control_v26_std" | "motion_control_v3_std" | "motion_control_v3_pro";
      variant: RemixMotionControlVariant;
      orientation: RemixOrientation;
      modelId: string;
      includeFaceElement: boolean;
    }
  | {
      kind: "viggle";
      engine: "viggle";
      modelId: string;
    }
  | {
      kind: "wan_replace";
      engine: "wan_replace";
      modelId: string;
    }
  | {
      kind: "o1_v2v_edit";
      engine: "kling_o1_v2v_edit";
      modelId: string;
    }
  | {
      kind: "kling_o3_v2v";
      engine: "kling_o3_v2v";
      modelId: string;
    };

export const REMIX_CONTENT_POLICY_USER_MESSAGE =
  "Ce clip est bloqué par le filtre du fournisseur. Essaie un autre clip ou une pose moins sensible.";

export const REMIX_O1_EDIT_PROMPT =
  "Replace the character with @Element1 keeping same motion";

export function getRemixEngine(
  env: Record<string, string | undefined> = process.env
): RemixEngine {
  const raw = env.REMIX_ENGINE?.trim();
  if (raw === "kling_o3_v2v") return "kling_o3_v2v";
  if (raw === "motion_control_v3_std") return "motion_control_v3_std";
  return DEFAULT_REMIX_ENGINE;
}

export function isViggleRemixConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.VIGGLE_API_KEY?.trim());
}

export function oppositeRemixOrientation(
  orientation: RemixOrientation
): RemixOrientation {
  return orientation === "video" ? "image" : "video";
}

export function remixOrientationMaxSec(orientation: RemixOrientation): number {
  return orientation === "image" ? REMIX_IMAGE_ORIENTATION_MAX_SEC : 30;
}

export function clipFitsOrientation(
  clipDurationSec: number,
  orientation: RemixOrientation
): boolean {
  return clipDurationSec <= remixOrientationMaxSec(orientation) + 1;
}

function motionControlAttempt(input: {
  variant: RemixMotionControlVariant;
  orientation: RemixOrientation;
  modelId: string;
  includeFaceElement: boolean;
}): RemixAttempt {
  switch (input.variant) {
    case "v26_std":
      return {
        kind: "motion_control",
        engine: "motion_control_v26_std",
        variant: "v26_std",
        orientation: input.orientation,
        modelId: input.modelId,
        includeFaceElement: input.includeFaceElement,
      };
    case "v3_std":
      return {
        kind: "motion_control",
        engine: "motion_control_v3_std",
        variant: "v3_std",
        orientation: input.orientation,
        modelId: input.modelId,
        includeFaceElement: input.includeFaceElement,
      };
    case "v3_pro":
      return {
        kind: "motion_control",
        engine: "motion_control_v3_pro",
        variant: "v3_pro",
        orientation: input.orientation,
        modelId: input.modelId,
        includeFaceElement: input.includeFaceElement,
      };
    default: {
      const _never: never = input.variant;
      throw new Error(`Unhandled motion-control variant: ${String(_never)}`);
    }
  }
}

function resolveMotionControlV26ModelId(
  env: Record<string, string | undefined>
): string {
  return (
    env.FAL_KLING_MOTION_CONTROL_V26_MODEL?.trim() ||
    REMIX_MOTION_CONTROL_V26_STANDARD_MODEL
  );
}

/**
 * Ordered submit attempts. Cascade (default): MC v2.6 → v3 std → v3 pro,
 * then Viggle when keyed, then Wan replace — sliced to
 * `REMIX_CASCADE_MAX_ATTEMPTS`. Legacy `motion_control_v3_std` keeps
 * orientation inverse + O1 (already ≤3). O3 rollback is a single attempt.
 */
export function planRemixAttempts(input: {
  engine: RemixEngine;
  orientation: RemixOrientation;
  clipDurationSec: number;
  tier: RemixTier;
  env?: Record<string, string | undefined>;
}): RemixAttempt[] {
  const env = input.env ?? process.env;
  switch (input.engine) {
    case "kling_o3_v2v":
      return [
        {
          kind: "kling_o3_v2v",
          engine: "kling_o3_v2v",
          modelId: resolveRemixModelId(input.tier, env),
        },
      ];
    case "motion_control_v3_std": {
      const attempts: RemixAttempt[] = [
        motionControlAttempt({
          variant: "v3_std",
          orientation: input.orientation,
          modelId: resolveRemixMotionControlModelId(input.tier, env),
          includeFaceElement: input.orientation === "video",
        }),
      ];
      const inverse = oppositeRemixOrientation(input.orientation);
      if (clipFitsOrientation(input.clipDurationSec, inverse)) {
        attempts.push(
          motionControlAttempt({
            variant: "v3_std",
            orientation: inverse,
            modelId: resolveRemixMotionControlModelId(input.tier, env),
            includeFaceElement: inverse === "video",
          })
        );
      }
      if (input.clipDurationSec <= REMIX_IMAGE_ORIENTATION_MAX_SEC + 1) {
        attempts.push({
          kind: "o1_v2v_edit",
          engine: "kling_o1_v2v_edit",
          modelId: resolveRemixO1EditModelId(env),
        });
      }
      return attempts;
    }
    case "motion_control_cascade": {
      const face = input.orientation === "video";
      const attempts: RemixAttempt[] = [
        motionControlAttempt({
          variant: "v26_std",
          orientation: input.orientation,
          modelId: resolveMotionControlV26ModelId(env),
          includeFaceElement: false,
        }),
        motionControlAttempt({
          variant: "v3_std",
          orientation: input.orientation,
          modelId:
            env.FAL_KLING_MOTION_CONTROL_STANDARD_MODEL?.trim() ||
            REMIX_MOTION_CONTROL_STANDARD_MODEL,
          includeFaceElement: face,
        }),
        motionControlAttempt({
          variant: "v3_pro",
          orientation: input.orientation,
          modelId:
            env.FAL_KLING_MOTION_CONTROL_PRO_MODEL?.trim() ||
            REMIX_MOTION_CONTROL_PRO_MODEL,
          includeFaceElement: face,
        }),
      ];
      if (isViggleRemixConfigured(env)) {
        attempts.push({
          kind: "viggle",
          engine: "viggle",
          modelId: REMIX_VIGGLE_MODEL_ID,
        });
      }
      attempts.push({
        kind: "wan_replace",
        engine: "wan_replace",
        modelId: resolveRemixWanReplaceModelId(env),
      });
      return attempts.slice(0, REMIX_CASCADE_MAX_ATTEMPTS);
    }
    default: {
      const _never: never = input.engine;
      throw new Error(`Unhandled remix engine: ${String(_never)}`);
    }
  }
}

export function classifyRemixProviderError(err: unknown): RemixErrorClass {
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status?: unknown }).status)
      : NaN;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (status === 422) return "content_policy";
  if (/\b422\b/.test(msg)) return "content_policy";
  if (
    lower.includes("content_policy") ||
    lower.includes("content policy") ||
    lower.includes("content-policy")
  ) {
    return "content_policy";
  }
  return "other";
}

export function buildMotionControlPrompt(opts: {
  orientation: RemixOrientation;
  characterName?: string | null;
  extra?: string | null;
}): string {
  const parts: string[] = [];
  if (opts.orientation === "video") {
    const name = opts.characterName?.trim();
    parts.push(
      name
        ? `The character is @Element1 (${name}). Keep facial identity consistent.`
        : "The character is @Element1. Keep facial identity consistent."
    );
  }
  parts.push("Transfer the motion from the reference video.");
  if (opts.extra?.trim()) parts.push(opts.extra.trim());
  return parts.join(" ");
}

export function logRemixProviderError(opts: {
  jobId: string;
  engine: string;
  falRequestId?: string | null;
  errorClass: RemixErrorClass;
  modelId?: string | null;
  orientation?: RemixOrientation | null;
  detail: string;
}): void {
  console.error("[remix] provider error", {
    jobId: opts.jobId,
    engine: opts.engine,
    falRequestId: opts.falRequestId ?? null,
    errorClass: opts.errorClass,
    modelId: opts.modelId ?? null,
    orientation: opts.orientation ?? null,
    detail: opts.detail.slice(0, 280),
  });
}

export function isRemixEngine(value: unknown): value is RemixEngine {
  return (
    value === "motion_control_cascade" ||
    value === "motion_control_v3_std" ||
    value === "kling_o3_v2v"
  );
}
