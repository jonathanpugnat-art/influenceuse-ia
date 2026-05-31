import { resolvePremiumSelfHostUrl } from "@/lib/premium-image-config";
import { runWithConcurrency } from "@/server/services/replicate-utils";
import type { TogetherFluxInput } from "@/server/services/image-providers/together-flux.provider";

/**
 * Self-hosted FLUX HTTP contract (ComfyUI wrapper, RunPod handler, etc.)
 *
 * POST {PREMIUM_SELFHOST_URL}
 * Body: { prompt, negative_prompt?, width?, height?, steps?, guidance_scale?, seed? }
 * Response: { url: string } | { urls: string[] }
 */
async function runSingleSelfHostFlux(
  endpoint: string,
  input: TogetherFluxInput
): Promise<string[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: input.prompt,
      negative_prompt: input.negative_prompt,
      width: input.width ?? 1024,
      height: input.height ?? 1280,
      steps: input.steps ?? 28,
      guidance_scale: input.guidance_scale ?? 3.5,
      seed: input.seed ?? Math.floor(Math.random() * 2147483647),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Premium self-host failed (${res.status}): ${text.slice(0, 280)}`
    );
  }

  const json = (await res.json()) as Record<string, unknown>;
  if (typeof json.url === "string" && json.url.startsWith("http")) {
    return [json.url];
  }
  if (Array.isArray(json.urls)) {
    return json.urls.filter(
      (u): u is string => typeof u === "string" && u.startsWith("http")
    );
  }
  throw new Error("Premium self-host returned no image URLs");
}

export async function runSelfHostFluxBatch(
  input: TogetherFluxInput,
  count: number
): Promise<{ urls: string[]; model: string }> {
  const endpoint = resolvePremiumSelfHostUrl();
  if (!endpoint) {
    throw new Error("PREMIUM_SELFHOST_URL is not configured.");
  }

  const tasks = Array.from({ length: count }, (_, i) => () =>
    runSingleSelfHostFlux(endpoint, {
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
  return { urls, model: "selfhost/flux" };
}

export function isSelfHostFluxConfigured(): boolean {
  return Boolean(resolvePremiumSelfHostUrl());
}
