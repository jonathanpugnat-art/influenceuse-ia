/**
 * FAL Kling V3 Motion Control — Remix V2 primary engine.
 *
 * Non-blocking queue.submit + webhook (same FAL_KEY as scene / Seedance).
 * Verified endpoint: fal-ai/kling-video/v3/standard/motion-control
 * (Pro: fal-ai/kling-video/v3/pro/motion-control).
 *
 * Required: image_url (character frontal), video_url (uploaded clip),
 * character_orientation. Optional: keep_original_sound, 1 face element
 * when orientation=video.
 */

import {
  falQueueCheck,
  falQueueSubmit,
} from "@/server/services/image-providers/fal-queue.client";
import { extractFalVideoUrl } from "@/server/services/video-providers/fal-kling-i2v.provider";
import { buildRemixElements, type RemixOrientation } from "@/lib/remix-config";
import {
  buildMotionControlPrompt,
  REMIX_O1_EDIT_PROMPT,
} from "@/lib/remix-engine";

export interface FalMotionControlRemixInput {
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
  orientation: RemixOrientation;
  keepAudio: boolean;
  characterName?: string | null;
  extraPromptTail?: string | null;
}

export interface FalRemixSubmitResult {
  requestId: string;
  modelId: string;
  prompt: string;
  payload: Record<string, unknown>;
}

export function buildFalKlingMotionControlRemixPayload(
  input: FalMotionControlRemixInput
): { payload: Record<string, unknown>; prompt: string } {
  const image = input.frontalImageUrl.trim();
  const video = input.videoUrl.trim();
  if (!image.startsWith("http")) {
    throw new Error("Kling Motion Control remix requires a public character image URL.");
  }
  if (!video.startsWith("http")) {
    throw new Error("Kling Motion Control remix requires a public source video URL.");
  }

  const prompt = buildMotionControlPrompt({
    orientation: input.orientation,
    characterName: input.characterName,
    extra: input.extraPromptTail,
  });

  const payload: Record<string, unknown> = {
    image_url: image,
    video_url: video,
    character_orientation: input.orientation,
    keep_original_sound: input.keepAudio,
  };

  if (prompt) payload.prompt = prompt;

  // Face bind is only supported when orientation=video (Fal schema).
  if (input.orientation === "video") {
    const [element] = buildRemixElements({
      frontalImageUrl: image,
      referenceImageUrls: input.referenceImageUrls,
    });
    const faceElement: Record<string, unknown> = {
      frontal_image_url: element.frontal_image_url,
    };
    if (element.reference_image_urls.length > 0) {
      faceElement.reference_image_urls = element.reference_image_urls;
    }
    payload.elements = [faceElement];
  }

  return { payload, prompt };
}

export async function submitFalKlingMotionControlRemix(input: {
  modelId: string;
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
  orientation: RemixOrientation;
  keepAudio: boolean;
  characterName?: string | null;
  extraPromptTail?: string | null;
  webhookUrl?: string;
}): Promise<FalRemixSubmitResult> {
  const { payload, prompt } = buildFalKlingMotionControlRemixPayload(input);
  const requestId = await falQueueSubmit(input.modelId, payload, {
    webhookUrl: input.webhookUrl,
  });
  return { requestId, modelId: input.modelId, prompt, payload };
}

export function buildFalKlingO1V2vEditPayload(input: {
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
  keepAudio: boolean;
}): { payload: Record<string, unknown>; prompt: string } {
  const video = input.videoUrl.trim();
  const frontal = input.frontalImageUrl.trim();
  if (!video.startsWith("http")) {
    throw new Error("Kling O1 V2V edit requires a public source video URL.");
  }
  if (!frontal.startsWith("http")) {
    throw new Error("Kling O1 V2V edit requires a public character still.");
  }

  const [element] = buildRemixElements({
    frontalImageUrl: frontal,
    referenceImageUrls: input.referenceImageUrls,
  });

  const payload: Record<string, unknown> = {
    prompt: REMIX_O1_EDIT_PROMPT,
    video_url: video,
    keep_audio: input.keepAudio,
    elements: [element],
  };

  return { payload, prompt: REMIX_O1_EDIT_PROMPT };
}

export async function submitFalKlingO1V2vEdit(input: {
  modelId: string;
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
  keepAudio: boolean;
  webhookUrl?: string;
}): Promise<FalRemixSubmitResult> {
  const { payload, prompt } = buildFalKlingO1V2vEditPayload(input);
  const requestId = await falQueueSubmit(input.modelId, payload, {
    webhookUrl: input.webhookUrl,
  });
  return { requestId, modelId: input.modelId, prompt, payload };
}

export type FalRemixCheckResult =
  | { state: "IN_QUEUE" | "IN_PROGRESS" }
  | { state: "COMPLETED"; videoUrl: string; raw: unknown }
  | { state: "FAILED"; error: string };

export async function checkFalRemixQueue(
  modelId: string,
  requestId: string
): Promise<FalRemixCheckResult> {
  const check = await falQueueCheck(modelId, requestId);
  if (check.state === "COMPLETED") {
    const url = extractFalVideoUrl(check.result);
    if (!url) {
      return {
        state: "FAILED",
        error: "FAL remix returned no output video URL.",
      };
    }
    return { state: "COMPLETED", videoUrl: url, raw: check.result };
  }
  if (check.state === "FAILED") {
    return { state: "FAILED", error: check.error };
  }
  return { state: check.state };
}
