/**
 * FAL Seedance 2.5 — reference-to-video + image-to-video.
 *
 * Non-blocking. We ONLY submit here and return the FAL `request_id`; the
 * result is fetched later from either:
 *   1. our /api/webhooks/fal-seedance endpoint (fast path), or
 *   2. a status recovery poll (`falQueueCheck`) when the webhook is missed.
 *
 * A blocking `subscribe` on Vercel would exceed the function budget for
 * scene renders (60-180s at 720p) and is intentionally not exposed here.
 *
 * IMPORTANT: this file is separate from the Kling remix provider. Do NOT
 * route remix requests through it — remix stays on Kling O3 V2V.
 */

import {
  falQueueCheck,
  falQueueSubmit,
} from "@/server/services/image-providers/fal-queue.client";
import { extractFalVideoUrl } from "@/server/services/video-providers/fal-kling-i2v.provider";
import {
  buildSeedancePrompt,
  resolveSeedanceModelId,
  resolveSeedanceMode,
  SEEDANCE_ASPECT_RATIO,
  SEEDANCE_MAX_REFERENCES,
  type SeedanceDuration,
  type SeedanceMode,
  type SeedanceResolution,
} from "@/lib/seedance-config";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface FalSeedanceSubmitInput {
  /**
   * Identity pack URLs. The first entry is used as the frontal @Image1
   * (or as the single `image_url` in i2v mode). Anything past the
   * SEEDANCE_MAX_REFERENCES cap is trimmed.
   */
  referenceImageUrls: readonly string[];
  duration: SeedanceDuration;
  resolution: SeedanceResolution;
  generateAudio: boolean;
  characterName?: string | null;
  scenePrompt: string;
  extraPromptTail?: string | null;
  webhookUrl?: string;
  /** Explicit mode override for tests; auto-resolved from ref count otherwise. */
  mode?: SeedanceMode;
}

export interface FalSeedanceBuildResult {
  mode: SeedanceMode;
  modelId: string;
  payload: Record<string, unknown>;
  prompt: string;
}

export interface FalSeedanceSubmitResult extends FalSeedanceBuildResult {
  requestId: string;
}

// ──────────────────────────────────────────────
// Payload builder (public for tests)
// ──────────────────────────────────────────────

/**
 * Build the JSON body sent to Seedance. Public for tests — the exact
 * shape is described in the PRD (task spec) and must stay stable.
 */
export function buildFalSeedancePayload(
  input: FalSeedanceSubmitInput
): FalSeedanceBuildResult {
  const refsRaw = (input.referenceImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"))
    .slice(0, SEEDANCE_MAX_REFERENCES);

  const mode: SeedanceMode = input.mode ?? resolveSeedanceMode(refsRaw);
  const refs =
    mode === "image_to_video" ? refsRaw.slice(0, 1) : refsRaw;

  const prompt = buildSeedancePrompt({
    characterName: input.characterName,
    scene: input.scenePrompt,
    extra: input.extraPromptTail,
  });

  const modelId = resolveSeedanceModelId(mode);

  const base: Record<string, unknown> = {
    prompt,
    duration: String(input.duration) as "10" | "15" | "30",
    resolution: input.resolution,
    aspect_ratio: SEEDANCE_ASPECT_RATIO,
    generate_audio: input.generateAudio,
  };

  let payload: Record<string, unknown>;
  switch (mode) {
    case "reference_to_video": {
      if (refs.length === 0) {
        throw new Error(
          "Seedance reference-to-video requires at least one image URL."
        );
      }
      payload = {
        ...base,
        image_urls: refs,
      };
      break;
    }
    case "image_to_video": {
      // The i2v endpoint takes a single `image_url` (start frame).
      // Never send image_urls / extra refs on this path.
      const start = refs[0];
      if (!start) {
        throw new Error(
          "Seedance image-to-video requires a start image URL."
        );
      }
      payload = {
        ...base,
        image_url: start,
      };
      break;
    }
    default: {
      const _never: never = mode;
      throw new Error(`Unhandled Seedance mode: ${String(_never)}`);
    }
  }

  return { mode, modelId, payload, prompt };
}

// ──────────────────────────────────────────────
// Queue submit / status
// ──────────────────────────────────────────────

export async function submitFalSeedance(
  input: FalSeedanceSubmitInput
): Promise<FalSeedanceSubmitResult> {
  const built = buildFalSeedancePayload(input);
  const requestId = await falQueueSubmit(built.modelId, built.payload, {
    webhookUrl: input.webhookUrl,
  });
  return { ...built, requestId };
}

export type FalSeedanceCheckResult =
  | { state: "IN_QUEUE" | "IN_PROGRESS" }
  | { state: "COMPLETED"; videoUrl: string; raw: unknown }
  | { state: "FAILED"; error: string };

/**
 * Non-blocking status probe. Used by the webhook route (defence in depth
 * when FAL only sends a status ping) and by poll-on-read recovery.
 */
export async function checkFalSeedance(
  modelId: string,
  requestId: string
): Promise<FalSeedanceCheckResult> {
  const check = await falQueueCheck(modelId, requestId);
  if (check.state === "COMPLETED") {
    const url = extractFalVideoUrl(check.result);
    if (!url) {
      return {
        state: "FAILED",
        error: "FAL Seedance returned no output video URL.",
      };
    }
    return { state: "COMPLETED", videoUrl: url, raw: check.result };
  }
  if (check.state === "FAILED") {
    return { state: "FAILED", error: check.error };
  }
  return { state: check.state };
}
