import {
  mapDimensionsToFalImageSize,
  resolveFalFluxT2iModel,
} from "@/lib/image-t2i-config";
import { runWithConcurrency } from "@/server/services/replicate-utils";

const FAL_QUEUE_BASE = "https://queue.fal.run";

export type FalFluxT2iInput = {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
};

function getFalKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new Error("FAL_KEY is not configured. Set it in your .env file.");
  }
  return key;
}

function buildFalPrompt(prompt: string, negative?: string): string {
  const base = prompt.trim();
  const neg = negative?.trim();
  if (!neg) return base;
  return `${base}. Avoid: ${neg}`;
}

export function extractFalImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;
  const images = data.images;
  if (!Array.isArray(images)) return [];

  const urls: string[] = [];
  for (const item of images) {
    if (typeof item === "string" && item.startsWith("http")) {
      urls.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const url = (item as Record<string, unknown>).url;
      if (typeof url === "string" && url.startsWith("http")) urls.push(url);
    }
  }
  return urls;
}

async function falSubscribe(
  modelId: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const key = getFalKey();
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`FAL submit failed (${submitRes.status}): ${text.slice(0, 240)}`);
  }

  const submitted = (await submitRes.json()) as { request_id?: string };
  const requestId = submitted.request_id;
  if (!requestId) {
    throw new Error("FAL submit returned no request_id");
  }

  const statusUrl = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status`;
  const resultUrl = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}`;
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!statusRes.ok) {
      const text = await statusRes.text();
      throw new Error(`FAL status failed (${statusRes.status}): ${text.slice(0, 200)}`);
    }

    const statusPayload = (await statusRes.json()) as {
      status?: string;
      error?: string;
    };

    if (statusPayload.status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!resultRes.ok) {
        const text = await resultRes.text();
        throw new Error(`FAL result failed (${resultRes.status}): ${text.slice(0, 200)}`);
      }
      return resultRes.json();
    }

    if (statusPayload.status === "FAILED") {
      throw new Error(
        `FAL generation failed: ${statusPayload.error ?? "unknown error"}`
      );
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  throw new Error("FAL generation timed out after 120s");
}

async function runSingleFalFluxT2i(
  modelId: string,
  input: FalFluxT2iInput
): Promise<string[]> {
  const falInput: Record<string, unknown> = {
    prompt: buildFalPrompt(input.prompt, input.negative_prompt),
    image_size: mapDimensionsToFalImageSize(input.width, input.height),
    num_inference_steps: input.num_inference_steps ?? 28,
    guidance_scale: input.guidance_scale ?? 3.5,
    seed: input.seed ?? Math.floor(Math.random() * 2147483647),
    num_images: 1,
    enable_safety_checker: true,
  };

  const result = await falSubscribe(modelId, falInput);
  const urls = extractFalImageUrls(result);
  if (urls.length === 0) {
    throw new Error("FAL returned no image URLs");
  }
  return urls;
}

/** Generate `count` FLUX T2I images via FAL (parallel, bounded). */
export async function runFalFluxT2iBatch(
  input: FalFluxT2iInput,
  count: number
): Promise<{ urls: string[]; model: string }> {
  const model = resolveFalFluxT2iModel();
  const tasks = Array.from({ length: count }, (_, i) => () =>
    runSingleFalFluxT2i(model, {
      ...input,
      seed:
        input.seed != null
          ? input.seed + i
          : Math.floor(Math.random() * 2147483647),
    })
  );

  const settled = await runWithConcurrency(tasks, 2);
  const urls: string[] = [];
  const errors: unknown[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") urls.push(...r.value);
    else errors.push(r.reason);
  }
  if (urls.length === 0 && errors.length > 0) {
    throw errors[0];
  }
  return { urls, model };
}
