/**
 * Viggle Video Remix — P0b in the Motion Control cascade.
 *
 * POST https://apis.viggle.ai/v1/renders with a character still + driving
 * clip. No Fal webhook: we persist the render id and poll GET /v1/videos/:id
 * from reconcile (same hold/refund as Fal remix).
 *
 * Assumed list price ~$0.01/s. Only planned when VIGGLE_API_KEY is set.
 */

import { FalQueueSubmitError } from "@/server/services/image-providers/fal-queue.client";
import { REMIX_VIGGLE_MODEL_ID } from "@/lib/remix-config";
import type { FalRemixCheckResult, FalRemixSubmitResult } from "@/server/services/video-providers/fal-kling-motion-control-remix.provider";

const VIGGLE_API_BASE = "https://apis.viggle.ai/v1";

export function getViggleApiKey(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const key = env.VIGGLE_API_KEY?.trim();
  return key || undefined;
}

export function buildViggleRemixPayload(input: {
  videoUrl: string;
  frontalImageUrl: string;
}): { payload: Record<string, string>; prompt: string } {
  const image = input.frontalImageUrl.trim();
  const video = input.videoUrl.trim();
  if (!image.startsWith("http")) {
    throw new Error("Viggle remix requires a public character image URL.");
  }
  if (!video.startsWith("http")) {
    throw new Error("Viggle remix requires a public source video URL.");
  }
  return {
    payload: {
      image_url: image,
      motion_video_url: video,
      background_mode: "original",
    },
    prompt: "Viggle video remix (character + motion)",
  };
}

export async function submitViggleRemix(input: {
  videoUrl: string;
  frontalImageUrl: string;
}): Promise<FalRemixSubmitResult> {
  const key = getViggleApiKey();
  if (!key) {
    throw new Error("VIGGLE_API_KEY is not configured.");
  }
  const { payload, prompt } = buildViggleRemixPayload(input);
  const form = new FormData();
  form.append("image_url", payload.image_url);
  form.append("motion_video_url", payload.motion_video_url);
  form.append("background_mode", payload.background_mode);

  const res = await fetch(`${VIGGLE_API_BASE}/renders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new FalQueueSubmitError(res.status, text.slice(0, 200));
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) {
    throw new Error("Viggle submit returned no render id.");
  }
  return {
    requestId: body.id,
    modelId: REMIX_VIGGLE_MODEL_ID,
    prompt,
    payload,
  };
}

export async function checkViggleRemix(
  renderId: string
): Promise<FalRemixCheckResult> {
  const key = getViggleApiKey();
  if (!key) {
    return { state: "FAILED", error: "VIGGLE_API_KEY is not configured." };
  }
  const res = await fetch(`${VIGGLE_API_BASE}/videos/${encodeURIComponent(renderId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      state: "FAILED",
      error: `Viggle poll failed (${res.status}): ${text.slice(0, 180)}`,
    };
  }
  const body = (await res.json()) as {
    status?: string;
    video_url?: string;
    error?: { code?: string; message?: string } | string;
  };
  const status = (body.status ?? "").toLowerCase();
  switch (status) {
    case "ready": {
      const url = body.video_url;
      if (!url?.startsWith("http")) {
        return { state: "FAILED", error: "Viggle returned no output video URL." };
      }
      return { state: "COMPLETED", videoUrl: url, raw: body };
    }
    case "failed":
    case "cancelled": {
      const err =
        typeof body.error === "string"
          ? body.error
          : body.error?.message || `Viggle render ${status}`;
      return { state: "FAILED", error: err };
    }
    case "queued":
    case "processing":
    case "analyzing":
    case "rendering":
    case "finishing":
      return { state: "IN_PROGRESS" };
    default:
      return { state: "IN_QUEUE" };
  }
}
