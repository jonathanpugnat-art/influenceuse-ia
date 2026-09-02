/**
 * FAL Kling O3 Omni — video-to-video + reference elements.
 *
 * Non-blocking. We ONLY submit here and return the FAL `request_id`; the
 * result is fetched later from either:
 *   1. our /api/webhooks/fal-remix endpoint (fast path), or
 *   2. a status recovery poll (`falQueueCheck`) when the webhook is missed.
 *
 * A blocking `subscribe` on Vercel would exceed the function budget for
 * remix workloads (60-120s) and is intentionally not exposed here.
 */

import { falQueueCheck, falQueueSubmit } from "@/server/services/image-providers/fal-queue.client";
import { extractFalVideoUrl } from "@/server/services/video-providers/fal-kling-i2v.provider";
import {
  buildRemixElements,
  buildRemixPrompt,
  resolveRemixModelId,
  type RemixDuration,
  type RemixTier,
} from "@/lib/remix-config";

export interface FalKlingO3RemixSubmitInput {
  tier: RemixTier;
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
  duration: RemixDuration;
  keepAudio: boolean;
  characterName?: string | null;
  extraPromptTail?: string | null;
  webhookUrl?: string;
}

export interface FalKlingO3RemixSubmitResult {
  requestId: string;
  modelId: string;
  prompt: string;
  payload: Record<string, unknown>;
}

/**
 * Build the JSON body sent to Kling. Public for tests — the exact shape is
 * described in the PRD and must stay stable.
 */
export function buildFalKlingO3RemixPayload(input: {
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
  duration: RemixDuration;
  keepAudio: boolean;
  characterName?: string | null;
  extraPromptTail?: string | null;
}): { payload: Record<string, unknown>; prompt: string } {
  const video = input.videoUrl.trim();
  if (!video.startsWith("http")) {
    throw new Error("Kling O3 remix requires a public source video URL.");
  }

  const elements = buildRemixElements({
    frontalImageUrl: input.frontalImageUrl,
    referenceImageUrls: input.referenceImageUrls,
  });

  const prompt = buildRemixPrompt({
    characterName: input.characterName,
    extra: input.extraPromptTail,
  });

  const payload: Record<string, unknown> = {
    prompt,
    video_url: video,
    elements,
    aspect_ratio: "9:16",
    duration: String(input.duration) as "5" | "10" | "15",
    keep_audio: input.keepAudio,
  };

  return { payload, prompt };
}

export async function submitFalKlingO3Remix(
  input: FalKlingO3RemixSubmitInput
): Promise<FalKlingO3RemixSubmitResult> {
  const modelId = resolveRemixModelId(input.tier);
  const { payload, prompt } = buildFalKlingO3RemixPayload(input);

  const requestId = await falQueueSubmit(modelId, payload, {
    webhookUrl: input.webhookUrl,
  });

  return { requestId, modelId, prompt, payload };
}

export type FalKlingO3RemixCheckResult =
  | { state: "IN_QUEUE" | "IN_PROGRESS" }
  | { state: "COMPLETED"; videoUrl: string; raw: unknown }
  | { state: "FAILED"; error: string };

/**
 * Non-blocking status probe. Used by the webhook route (defence in depth
 * when FAL only sends a status ping without the payload) and by a recovery
 * poll if we ever wire a cron for stuck jobs.
 */
export async function checkFalKlingO3Remix(
  modelId: string,
  requestId: string
): Promise<FalKlingO3RemixCheckResult> {
  const check = await falQueueCheck(modelId, requestId);
  if (check.state === "COMPLETED") {
    const url = extractFalVideoUrl(check.result);
    if (!url) {
      return {
        state: "FAILED",
        error: "FAL Kling O3 remix returned no output video URL.",
      };
    }
    return { state: "COMPLETED", videoUrl: url, raw: check.result };
  }
  if (check.state === "FAILED") {
    return { state: "FAILED", error: check.error };
  }
  return { state: check.state };
}
