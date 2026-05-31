import { resolveTogetherFluxModel } from "@/lib/premium-image-config";
import { runWithConcurrency } from "@/server/services/replicate-utils";

export type TogetherFluxInput = {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance_scale?: number;
  seed?: number;
  reference_images?: string[];
};

const TOGETHER_IMAGES_URL = "https://api.together.xyz/v1/images/generations";

function getTogetherApiKey(): string {
  const key = process.env.TOGETHER_API_KEY?.trim();
  if (!key) {
    throw new Error("TOGETHER_API_KEY is not configured.");
  }
  return key;
}

function extractTogetherImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;

  const dataArray = data.data;
  if (Array.isArray(dataArray)) {
    const urls: string[] = [];
    for (const item of dataArray) {
      if (typeof item === "string" && item.startsWith("http")) {
        urls.push(item);
        continue;
      }
      if (item && typeof item === "object") {
        const url = (item as Record<string, unknown>).url;
        if (typeof url === "string" && url.startsWith("http")) urls.push(url);
        const b64 = (item as Record<string, unknown>).b64_json;
        if (typeof b64 === "string" && b64.length > 0) {
          urls.push(`data:image/jpeg;base64,${b64}`);
        }
      }
    }
    if (urls.length > 0) return urls;
  }

  const output = data.output;
  if (typeof output === "string" && output.startsWith("http")) return [output];
  if (output && typeof output === "object") {
    const url = (output as Record<string, unknown>).url;
    if (typeof url === "string" && url.startsWith("http")) return [url];
  }

  return [];
}

async function runSingleTogetherFlux(
  model: string,
  input: TogetherFluxInput
): Promise<string[]> {
  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    width: input.width ?? 1024,
    height: input.height ?? 1280,
    steps: input.steps ?? 28,
    n: 1,
    response_format: "url",
    output_format: "jpeg",
    prompt_upsampling: false,
  };

  if (input.negative_prompt?.trim()) {
    body.negative_prompt = input.negative_prompt.trim();
  }
  if (input.guidance_scale != null) {
    body.guidance = input.guidance_scale;
  }
  if (input.seed != null) {
    body.seed = input.seed;
  }
  if (input.reference_images?.length) {
    body.reference_images = input.reference_images.filter((u) =>
      u.startsWith("http")
    );
  }

  const res = await fetch(TOGETHER_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getTogetherApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Together image generation failed (${res.status}): ${text.slice(0, 280)}`
    );
  }

  const json = await res.json();
  const urls = extractTogetherImageUrls(json);
  if (urls.length === 0) {
    throw new Error("Together returned no image URLs");
  }
  return urls;
}

export async function runTogetherFluxBatch(
  input: TogetherFluxInput,
  count: number
): Promise<{ urls: string[]; model: string }> {
  const model = resolveTogetherFluxModel();
  const tasks = Array.from({ length: count }, (_, i) => () =>
    runSingleTogetherFlux(model, {
      ...input,
      seed:
        input.seed != null
          ? input.seed + i
          : Math.floor(Math.random() * 2147483647),
    })
  );

  const settled = await runWithConcurrency(tasks, 4);
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

export function isTogetherApiConfigured(): boolean {
  return Boolean(process.env.TOGETHER_API_KEY?.trim());
}
