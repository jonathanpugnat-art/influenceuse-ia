/**
 * Remix engine routing (independent from `SCENE_ENGINE`).
 *
 * SCENE_ENGINE stays `kling_o3_i2v` — do not re-enable Seedance for
 * photoreal faces from this module.
 *
 * TODO(nsfw-adult-provider): Pro NSFW / hard adult generation is out of
 * scope for Remix V2. Kling Motion Control and Seedance will keep refusing
 * explicit adult clips — ship a dedicated adult provider before enabling
 * that lane.
 */

import {
  REMIX_IMAGE_ORIENTATION_MAX_SEC,
  type RemixOrientation,
  type RemixTier,
  resolveRemixModelId,
  resolveRemixMotionControlModelId,
  resolveRemixO1EditModelId,
} from "@/lib/remix-config";

export const REMIX_ENGINES = ["motion_control_v3_std", "kling_o3_v2v"] as const;
export type RemixEngine = (typeof REMIX_ENGINES)[number];

export const DEFAULT_REMIX_ENGINE: RemixEngine = "motion_control_v3_std";

export const REMIX_ATTEMPT_KINDS = [
  "motion_control",
  "o1_v2v_edit",
  "kling_o3_v2v",
] as const;
export type RemixAttemptKind = (typeof REMIX_ATTEMPT_KINDS)[number];

export type RemixErrorClass = "content_policy" | "other";

export type RemixAttempt =
  | {
      kind: "motion_control";
      engine: "motion_control_v3_std";
      orientation: RemixOrientation;
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
  return DEFAULT_REMIX_ENGINE;
}

export function oppositeRemixOrientation(
  orientation: RemixOrientation
): RemixOrientation {
  return orientation === "video" ? "image" : "video";
}

export function remixOrientationMaxSec(orientation: RemixOrientation): number {
  return orientation === "image"
    ? REMIX_IMAGE_ORIENTATION_MAX_SEC
    : 30;
}

export function clipFitsOrientation(
  clipDurationSec: number,
  orientation: RemixOrientation
): boolean {
  return clipDurationSec <= remixOrientationMaxSec(orientation) + 1;
}

/**
 * Ordered submit attempts. Motion-control: requested orientation, then the
 * inverse (once) if the clip fits, then O1 V2V edit when the clip is ≤10s.
 * O3 rollback is a single attempt (no motion-control fallbacks).
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
        {
          kind: "motion_control",
          engine: "motion_control_v3_std",
          orientation: input.orientation,
          modelId: resolveRemixMotionControlModelId(input.tier, env),
        },
      ];
      const inverse = oppositeRemixOrientation(input.orientation);
      if (clipFitsOrientation(input.clipDurationSec, inverse)) {
        attempts.push({
          kind: "motion_control",
          engine: "motion_control_v3_std",
          orientation: inverse,
          modelId: resolveRemixMotionControlModelId(input.tier, env),
        });
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
