/**
 * WaveSpeed Wan 2.2 Spicy — image-to-video.
 *
 * Official model: wavespeed-ai/wan-2.2-spicy/image-to-video
 * Docs: https://wavespeed.ai/docs/docs-api/wavespeed-ai/wan-2.2-spicy-image-to-video
 *
 * This provider is NEVER imported by the SFW reel/scene cascade.
 */

import {
  resolveWavespeedSpicyModelId,
  WAVESPEED_API_BASE,
  type WavespeedSpicyDuration,
  type WavespeedSpicyResolution,
} from "@/lib/wavespeed-spicy-config";

export interface WavespeedSpicySubmitInput {
  imageUrl: string;
  prompt: string;
  duration: WavespeedSpicyDuration;
  resolution: WavespeedSpicyResolution;
  callbackUrl?: string;
}

export interface WavespeedSpicyBuildResult {
  modelId: string;
  submitUrl: string;
  payload: Record<string, unknown>;
}

export interface WavespeedSpicySubmitResult extends WavespeedSpicyBuildResult {
  predictionId: string;
}

export type WavespeedSpicyCheckResult =
  | { state: "IN_QUEUE" | "IN_PROGRESS" }
  | { state: "COMPLETED"; videoUrl: string; raw: unknown }
  | { state: "FAILED"; error: string };

interface WavespeedEnvelope {
  code?: number;
  message?: string;
  data?: unknown;
}

function wavespeedHeaders(
  env: Record<string, string | undefined> = process.env
): HeadersInit {
  const key = env.WAVESPEED_API_KEY?.trim();
  if (!key) {
    throw new Error("WAVESPEED_API_KEY is not configured.");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function buildWavespeedSpicyPayload(
  input: WavespeedSpicySubmitInput,
  env: Record<string, string | undefined> = process.env
): WavespeedSpicyBuildResult {
  const imageUrl = input.imageUrl.trim();
  if (!imageUrl.startsWith("http")) {
    throw new Error("WaveSpeed spicy I2V requires a public image URL.");
  }
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("WaveSpeed spicy I2V requires a prompt.");
  }

  const modelId = resolveWavespeedSpicyModelId(env);
  const payload: Record<string, unknown> = {
    prompt,
    image: imageUrl,
    resolution: input.resolution,
    duration: input.duration,
  };
  if (input.callbackUrl?.startsWith("http")) {
    payload.callback = input.callbackUrl;
  }

  return {
    modelId,
    submitUrl: `${WAVESPEED_API_BASE}/${modelId}`,
    payload,
  };
}

async function readJson(res: Response): Promise<WavespeedEnvelope> {
  const text = await res.text();
  try {
    return JSON.parse(text) as WavespeedEnvelope;
  } catch {
    throw new Error(
      `WaveSpeed response was not JSON (${res.status}): ${text.slice(0, 180)}`
    );
  }
}

function unwrapData(body: WavespeedEnvelope): Record<string, unknown> {
  if (body.data && typeof body.data === "object") {
    return body.data as Record<string, unknown>;
  }
  return body as unknown as Record<string, unknown>;
}

function extractPredictionId(task: Record<string, unknown>): string | null {
  if (typeof task.id === "string" && task.id.trim()) return task.id.trim();
  return null;
}

function extractVideoUrl(task: Record<string, unknown>): string | null {
  const outputs = task.outputs;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (typeof item === "string" && item.startsWith("http")) return item;
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        if (typeof rec.url === "string" && rec.url.startsWith("http")) {
          return rec.url;
        }
      }
    }
  }
  if (typeof task.output === "string" && task.output.startsWith("http")) {
    return task.output;
  }
  return null;
}

export async function submitWavespeedSpicy(
  input: WavespeedSpicySubmitInput,
  env: Record<string, string | undefined> = process.env
): Promise<WavespeedSpicySubmitResult> {
  const built = buildWavespeedSpicyPayload(input, env);
  const res = await fetch(built.submitUrl, {
    method: "POST",
    headers: wavespeedHeaders(env),
    body: JSON.stringify(built.payload),
  });
  const body = await readJson(res);
  if (!res.ok) {
    const msg =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : `WaveSpeed submit failed (${res.status})`;
    throw new Error(msg.slice(0, 300));
  }
  const task = unwrapData(body);
  const predictionId = extractPredictionId(task);
  if (!predictionId) {
    throw new Error("WaveSpeed submit did not return a prediction id.");
  }
  return { ...built, predictionId };
}

export async function checkWavespeedSpicy(
  predictionId: string,
  env: Record<string, string | undefined> = process.env
): Promise<WavespeedSpicyCheckResult> {
  const id = predictionId.trim();
  if (!id) {
    return { state: "FAILED", error: "Missing WaveSpeed prediction id." };
  }
  const res = await fetch(`${WAVESPEED_API_BASE}/predictions/${id}/result`, {
    method: "GET",
    headers: wavespeedHeaders(env),
  });
  const body = await readJson(res);
  if (!res.ok) {
    const msg =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : `WaveSpeed poll failed (${res.status})`;
    return { state: "FAILED", error: msg.slice(0, 300) };
  }
  const task = unwrapData(body);
  const status = typeof task.status === "string" ? task.status.toLowerCase() : "";
  switch (status) {
    case "completed": {
      const videoUrl = extractVideoUrl(task);
      if (!videoUrl) {
        return {
          state: "FAILED",
          error: "WaveSpeed completed without a video URL.",
        };
      }
      return { state: "COMPLETED", videoUrl, raw: task };
    }
    case "failed":
    case "cancelled":
    case "canceled":
    case "timeout":
    case "deleted": {
      const error =
        typeof task.error === "string" && task.error.trim()
          ? task.error.trim()
          : `WaveSpeed status: ${status}`;
      return { state: "FAILED", error: error.slice(0, 300) };
    }
    case "created":
    case "pending":
    case "queued":
    case "in_queue":
      return { state: "IN_QUEUE" };
    case "processing":
    case "running":
    case "in_progress":
      return { state: "IN_PROGRESS" };
    default: {
      if (!status) return { state: "IN_QUEUE" };
      return { state: "IN_PROGRESS" };
    }
  }
}
