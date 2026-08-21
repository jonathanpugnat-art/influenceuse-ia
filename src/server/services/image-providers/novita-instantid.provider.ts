import {
  resolveNovitaAdapterStrength,
  resolveNovitaApiKey,
  resolveNovitaGuidanceScale,
  resolveNovitaIdStrength,
  resolveNovitaInstantIdModel,
  resolveNovitaSampler,
  resolveNovitaSteps,
} from "@/lib/premium-image-config";
import { runWithConcurrency } from "@/server/services/replicate-utils";

/**
 * Novita InstantID provider — face-locked NSFW generation for the `explicit`
 * tier. Async V3 API: POST submits a task and returns a `task_id`; we then poll
 * the task-result endpoint until the image is ready.
 *
 * Docs: https://novita.ai/docs (Image Generation → InstantID / Task Result)
 *   POST https://api.novita.ai/v3/async/instant-id  → { task_id }
 *   GET  https://api.novita.ai/v3/async/task-result?task_id=…  → { task, images }
 */
const NOVITA_INSTANTID_URL = "https://api.novita.ai/v3/async/instant-id";
const NOVITA_TASK_RESULT_URL = "https://api.novita.ai/v3/async/task-result";

const POLL_INTERVAL_MS = 2500;
/** RealVisXL InstantID routinely takes 90–120s; keep headroom for queue spikes. */
const POLL_TIMEOUT_MS = 180_000;

/** Novita InstantID rejects NegativePrompt longer than 1024 runes. */
const NOVITA_NEGATIVE_PROMPT_MAX = 1024;

type NovitaSubmitResponse = { task_id?: string };
type NovitaTaskResult = {
  task?: { status?: string; reason?: string };
  images?: Array<{ image_url?: string }>;
};

function getNovitaApiKey(): string {
  const key = resolveNovitaApiKey();
  if (!key) {
    throw new Error("NOVITA_API_KEY is not configured.");
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Truncate at a comma boundary when possible so we don't cut mid-token. */
function clampNovitaNegativePrompt(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= NOVITA_NEGATIVE_PROMPT_MAX) return trimmed;
  const slice = trimmed.slice(0, NOVITA_NEGATIVE_PROMPT_MAX);
  const lastComma = slice.lastIndexOf(",");
  const clamped =
    lastComma > NOVITA_NEGATIVE_PROMPT_MAX * 0.7
      ? slice.slice(0, lastComma).trim()
      : slice.trim();
  console.warn(
    `[novita-instantid] negative_prompt truncated ${trimmed.length} → ${clamped.length} (Novita max ${NOVITA_NEGATIVE_PROMPT_MAX})`
  );
  return clamped;
}

async function submitInstantIdTask(
  apiKey: string,
  model: string,
  faceUrl: string,
  prompt: string,
  negativePrompt: string,
  seed: number
): Promise<string> {
  const body = {
    model_name: model,
    face_image_urls: [faceUrl],
    prompt,
    negative_prompt: clampNovitaNegativePrompt(negativePrompt),
    id_strength: resolveNovitaIdStrength(),
    adapter_strength: resolveNovitaAdapterStrength(),
    steps: resolveNovitaSteps(),
    guidance_scale: resolveNovitaGuidanceScale(),
    sampler_name: resolveNovitaSampler(),
    width: 1024,
    height: 1280,
    image_num: 1,
    seed,
    // Critical for the explicit tier: never let Novita's optional NSFW filter
    // blank the output. Aura runs its own pre-check + post-moderation.
    extra: {
      response_image_type: "jpeg",
      enable_nsfw_detection: false,
    },
  };

  const res = await fetch(NOVITA_INSTANTID_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Novita InstantID submit failed (${res.status}): ${text.slice(0, 280)}`
    );
  }

  const json = (await res.json()) as NovitaSubmitResponse;
  const taskId = json.task_id?.trim();
  if (!taskId) {
    throw new Error("Novita InstantID returned no task_id");
  }
  return taskId;
}

async function pollInstantIdTask(
  apiKey: string,
  taskId: string
): Promise<string[]> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${NOVITA_TASK_RESULT_URL}?task_id=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Novita task-result failed (${res.status}): ${text.slice(0, 200)}`
      );
    }

    const json = (await res.json()) as NovitaTaskResult;
    const status = json.task?.status;

    if (status === "TASK_STATUS_SUCCEED") {
      const urls = (json.images ?? [])
        .map((img) => img.image_url?.trim())
        .filter((u): u is string => typeof u === "string" && u.startsWith("http"));
      if (urls.length === 0) {
        throw new Error("Novita task succeeded but returned no image URLs");
      }
      return urls;
    }

    if (status === "TASK_STATUS_FAILED") {
      throw new Error(
        `Novita InstantID task failed: ${json.task?.reason || "unknown reason"}`
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Novita InstantID task timed out after ${POLL_TIMEOUT_MS / 1000}s`
  );
}

/**
 * Generate `count` face-locked explicit images via Novita InstantID. Each image
 * is one async task (own seed) so failures are isolated. Throws only when every
 * task fails, letting the caller fall back to the uncensored T2I router.
 */
export async function runNovitaInstantIdBatch(
  faceUrl: string,
  prompt: string,
  negativePrompt: string,
  count: number
): Promise<{ urls: string[]; model: string }> {
  const apiKey = getNovitaApiKey();
  const model = resolveNovitaInstantIdModel();

  const tasks: Array<() => Promise<string[]>> = Array.from(
    { length: Math.max(1, count) },
    () => async () => {
      const seed = Math.floor(Math.random() * 2147483647);
      const taskId = await submitInstantIdTask(
        apiKey,
        model,
        faceUrl,
        prompt,
        negativePrompt,
        seed
      );
      return pollInstantIdTask(apiKey, taskId);
    }
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
