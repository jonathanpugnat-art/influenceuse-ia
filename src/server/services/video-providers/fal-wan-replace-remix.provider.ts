/**
 * Fal Wan 2.2 Animate Replace — P0c in the Motion Control cascade.
 *
 * Same FAL_KEY + queue.submit + remix webhook as Kling. Replaces the
 * person in the uploaded clip with the character still.
 *
 * Chosen over Replicate prunaai/p-video-replace and Pixverse swap so the
 * hold/refund/webhook path stays Fal-native. Override with
 * FAL_WAN_REPLACE_MODEL if needed.
 */

import { falQueueSubmit } from "@/server/services/image-providers/fal-queue.client";
import type { FalRemixSubmitResult } from "@/server/services/video-providers/fal-kling-motion-control-remix.provider";

export function buildFalWanReplaceRemixPayload(input: {
  videoUrl: string;
  frontalImageUrl: string;
}): { payload: Record<string, unknown>; prompt: string } {
  const image = input.frontalImageUrl.trim();
  const video = input.videoUrl.trim();
  if (!image.startsWith("http")) {
    throw new Error("Wan replace remix requires a public character image URL.");
  }
  if (!video.startsWith("http")) {
    throw new Error("Wan replace remix requires a public source video URL.");
  }
  const prompt = "Replace the person in the video with the character image.";
  return {
    payload: {
      image_url: image,
      video_url: video,
      resolution: "480p",
    },
    prompt,
  };
}

export async function submitFalWanReplaceRemix(input: {
  modelId: string;
  videoUrl: string;
  frontalImageUrl: string;
  webhookUrl?: string;
}): Promise<FalRemixSubmitResult> {
  const { payload, prompt } = buildFalWanReplaceRemixPayload(input);
  const requestId = await falQueueSubmit(input.modelId, payload, {
    webhookUrl: input.webhookUrl,
  });
  return { requestId, modelId: input.modelId, prompt, payload };
}
