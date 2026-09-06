/**
 * FAL Kling O3 Standard — image-to-video (scene V1).
 *
 * Non-blocking queue submit. Result via /api/webhooks/fal-seedance
 * (same SeedanceJob row) or falQueueCheck. Do NOT route remix V2V here.
 */

import {
  falQueueCheck,
  falQueueSubmit,
} from "@/server/services/image-providers/fal-queue.client";
import { extractFalVideoUrl } from "@/server/services/video-providers/fal-kling-i2v.provider";
import {
  resolveKlingSceneModelId,
  type KlingSceneDuration,
} from "@/lib/scene-engine";

export interface FalKlingO3I2vSubmitInput {
  imageUrl: string;
  prompt: string;
  duration: KlingSceneDuration;
  generateAudio: boolean;
  webhookUrl?: string;
}

export interface FalKlingO3I2vBuildResult {
  modelId: string;
  payload: Record<string, unknown>;
  prompt: string;
}

export interface FalKlingO3I2vSubmitResult extends FalKlingO3I2vBuildResult {
  requestId: string;
}

export function buildFalKlingO3I2vPayload(
  input: FalKlingO3I2vSubmitInput
): FalKlingO3I2vBuildResult {
  const imageUrl = input.imageUrl.trim();
  if (!imageUrl.startsWith("http")) {
    throw new Error("Kling O3 scene I2V requires a public image_url.");
  }
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("Kling O3 scene I2V requires a scene prompt.");
  }

  const payload: Record<string, unknown> = {
    prompt,
    image_url: imageUrl,
    duration: String(input.duration) as "5" | "10" | "15",
    generate_audio: input.generateAudio,
  };

  return {
    modelId: resolveKlingSceneModelId(),
    payload,
    prompt,
  };
}

export async function submitFalKlingO3I2v(
  input: FalKlingO3I2vSubmitInput
): Promise<FalKlingO3I2vSubmitResult> {
  const built = buildFalKlingO3I2vPayload(input);
  const requestId = await falQueueSubmit(built.modelId, built.payload, {
    webhookUrl: input.webhookUrl,
  });
  return { ...built, requestId };
}

export type FalKlingO3I2vCheckResult =
  | { state: "IN_QUEUE" | "IN_PROGRESS" }
  | { state: "COMPLETED"; videoUrl: string; raw: unknown }
  | { state: "FAILED"; error: string };

export async function checkFalKlingO3I2v(
  modelId: string,
  requestId: string
): Promise<FalKlingO3I2vCheckResult> {
  const check = await falQueueCheck(modelId, requestId);
  if (check.state === "COMPLETED") {
    const url = extractFalVideoUrl(check.result);
    if (!url) {
      return {
        state: "FAILED",
        error: "FAL Kling O3 scene returned no output video URL.",
      };
    }
    return { state: "COMPLETED", videoUrl: url, raw: check.result };
  }
  if (check.state === "FAILED") {
    return { state: "FAILED", error: check.error };
  }
  return { state: check.state };
}
