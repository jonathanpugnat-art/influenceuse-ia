/**
 * Hedra Avatar client — talking-head V1 (single video vendor).
 *
 * Endpoint base: https://api.hedra.com/web-app/public
 * Header:        X-API-Key: <HEDRA_API_KEY>
 *
 * Flow used by `talking-head.service`:
 *   1. POST /assets { type: "audio" }           → asset id
 *      POST /assets/{id}/upload (multipart)      → attach mp3 bytes
 *   2. POST /assets { type: "image" }           → asset id
 *      POST /assets/{id}/upload (multipart)      → attach portrait bytes
 *   3. POST /generations
 *        {
 *          type: "video",
 *          model_slug: "together/hedra-avatar",
 *          start_keyframe_id: <image asset id>,
 *          audio_id:          <audio asset id>,
 *          generated_video_inputs: {
 *            text_prompt: "A person speaking to the camera",
 *            aspect_ratio: "9:16",
 *            resolution:   "720p",
 *          }
 *        }
 *   4. GET /generations/{id}/status              → poll until complete
 *
 * Docs: https://www.hedra.com/docs/pages/developer/guides/generate-avatar-video
 *
 * NOTE: we intentionally do not import the Hedra SDK. The public API is a
 * small set of HTTP calls and pinning `fetch` keeps deploy footprint low
 * (matches how we call FAL / Novita / OpenRouter today).
 */

const DEFAULT_BASE_URL = "https://api.hedra.com/web-app/public";
const DEFAULT_MODEL_SLUG = "together/hedra-avatar";
const REQUEST_TIMEOUT_MS = 60_000;

export function isHedraConfigured(): boolean {
  return Boolean(process.env.HEDRA_API_KEY?.trim());
}

function requireApiKey(): string {
  const key = process.env.HEDRA_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "HEDRA_API_KEY manquant. Configure la clé Hedra pour activer la génération talking-head."
    );
  }
  return key;
}

function baseUrl(): string {
  return process.env.HEDRA_API_URL?.trim() || DEFAULT_BASE_URL;
}

export function hedraModelSlug(): string {
  return process.env.HEDRA_MODEL_SLUG?.trim() || DEFAULT_MODEL_SLUG;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function jsonRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const apiKey = requireApiKey();
  const res = await fetchWithTimeout(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json" }
        : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Hedra ${init.method ?? "GET"} ${path} a échoué (HTTP ${res.status}) : ${text.slice(0, 400)}`
    );
  }
  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

// ──────────────────────────────────────────────
// Assets
// ──────────────────────────────────────────────

export type HedraAssetType = "audio" | "image" | "video";

interface HedraAssetResponse {
  id?: string;
  asset_id?: string;
}

export interface CreateAssetInput {
  type: HedraAssetType;
  name?: string;
}

export async function createAsset(
  input: CreateAssetInput
): Promise<{ assetId: string }> {
  const body: Record<string, unknown> = { type: input.type };
  if (input.name) body.name = input.name.slice(0, 120);
  const json = await jsonRequest<HedraAssetResponse>("/assets", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const id = json.id ?? json.asset_id;
  if (!id) {
    throw new Error("Hedra n'a pas retourné d'id d'asset.");
  }
  return { assetId: id };
}

export interface UploadAssetInput {
  assetId: string;
  data: Buffer;
  filename: string;
  contentType: string;
}

export async function uploadAsset(input: UploadAssetInput): Promise<void> {
  const apiKey = requireApiKey();
  const form = new FormData();
  // Copy into a fresh ArrayBuffer so Blob accepts it under the DOM lib's
  // strict `ArrayBuffer` (not `SharedArrayBuffer`) type. Node's Buffer is
  // backed by an `ArrayBufferLike` which TypeScript refuses without the
  // memcpy.
  const bytes = new Uint8Array(input.data.byteLength);
  bytes.set(input.data);
  form.append(
    "file",
    new Blob([bytes.buffer], { type: input.contentType }),
    input.filename
  );

  const res = await fetchWithTimeout(
    `${baseUrl()}/assets/${encodeURIComponent(input.assetId)}/upload`,
    {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
      },
      body: form,
      timeoutMs: 120_000,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Hedra upload asset ${input.assetId} a échoué (HTTP ${res.status}) : ${text.slice(0, 400)}`
    );
  }
}

// ──────────────────────────────────────────────
// Generations
// ──────────────────────────────────────────────

export interface CreateGenerationInput {
  audioAssetId: string;
  imageAssetId: string;
  /** Prompt fed to the avatar. Default keeps the character neutral. */
  textPrompt?: string;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  resolution?: "540p" | "720p";
  modelSlug?: string;
}

interface HedraGenerationResponse {
  id?: string;
  generation_id?: string;
  asset_id?: string;
}

export async function createGeneration(
  input: CreateGenerationInput
): Promise<{ generationId: string; modelSlug: string }> {
  const modelSlug = input.modelSlug?.trim() || hedraModelSlug();
  const payload = {
    type: "video",
    model_slug: modelSlug,
    start_keyframe_id: input.imageAssetId,
    audio_id: input.audioAssetId,
    generated_video_inputs: {
      text_prompt: input.textPrompt?.trim() || "A person speaking to the camera",
      aspect_ratio: input.aspectRatio ?? "9:16",
      resolution: input.resolution ?? "720p",
    },
  };
  const json = await jsonRequest<HedraGenerationResponse>("/generations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const id = json.id ?? json.generation_id;
  if (!id) {
    throw new Error(
      "Hedra n'a pas retourné d'id de génération. Vérifie le model_slug et les assets."
    );
  }
  return { generationId: id, modelSlug };
}

// ──────────────────────────────────────────────
// Status polling
// ──────────────────────────────────────────────

export type HedraGenerationState =
  | "queued"
  | "processing"
  | "complete"
  | "error"
  | "canceled";

export interface HedraGenerationStatus {
  state: HedraGenerationState;
  /** Hedra "asset id" of the finished MP4. */
  assetId?: string;
  /** Public playback URL when Hedra exposes one (some responses embed it). */
  url?: string;
  /** Poster / thumbnail URL when Hedra exposes one. */
  thumbnailUrl?: string;
  error?: string;
  raw: unknown;
}

interface RawHedraStatus {
  status?: string;
  state?: string;
  progress?: number;
  asset_id?: string;
  url?: string;
  video_url?: string;
  thumbnail_url?: string;
  error_message?: string;
  error?: string | { message?: string };
  output?: {
    asset_id?: string;
    url?: string;
    thumbnail_url?: string;
  };
  result?: {
    asset_id?: string;
    url?: string;
    thumbnail_url?: string;
  };
}

/**
 * Normalize the various shapes Hedra has returned over time. We map every
 * flavor onto a stable `HedraGenerationState` so the caller never has to
 * pattern-match strings.
 */
function normalizeState(raw: RawHedraStatus): HedraGenerationState {
  const s = (raw.status ?? raw.state ?? "").toLowerCase().trim();
  if (["complete", "completed", "succeeded", "success"].includes(s)) {
    return "complete";
  }
  if (["error", "failed", "failure"].includes(s)) {
    return "error";
  }
  if (["canceled", "cancelled"].includes(s)) {
    return "canceled";
  }
  if (["queued", "pending", "waiting"].includes(s)) {
    return "queued";
  }
  return "processing";
}

export async function getGenerationStatus(
  generationId: string
): Promise<HedraGenerationStatus> {
  const raw = await jsonRequest<RawHedraStatus>(
    `/generations/${encodeURIComponent(generationId)}/status`,
    { method: "GET" }
  );
  const state = normalizeState(raw);
  const nested = raw.output ?? raw.result ?? {};
  const errorMsg =
    raw.error_message ??
    (typeof raw.error === "string"
      ? raw.error
      : raw.error?.message) ??
    undefined;

  return {
    state,
    assetId: nested.asset_id ?? raw.asset_id,
    url: nested.url ?? raw.url ?? raw.video_url,
    thumbnailUrl: nested.thumbnail_url ?? raw.thumbnail_url,
    error: errorMsg,
    raw,
  };
}

/**
 * Fetch a Hedra asset to resolve its public URL when `/generations/{id}/status`
 * only returns an `asset_id`. Best-effort — returns undefined on any failure
 * so the caller can decide whether to retry later.
 */
export async function getAssetUrl(
  assetId: string
): Promise<{ url?: string; thumbnailUrl?: string }> {
  try {
    const raw = await jsonRequest<{
      url?: string;
      download_url?: string;
      thumbnail_url?: string;
    }>(`/assets/${encodeURIComponent(assetId)}`, { method: "GET" });
    return {
      url: raw.url ?? raw.download_url,
      thumbnailUrl: raw.thumbnail_url,
    };
  } catch {
    return {};
  }
}

// ──────────────────────────────────────────────
// Model catalog (optional pre-flight — reads Hedra's duration caps)
// ──────────────────────────────────────────────

export interface HedraVideoModel {
  slug: string;
  label: string;
  maxDurationSec: number | null;
  raw: unknown;
}

interface RawHedraModel {
  slug?: string;
  model_slug?: string;
  name?: string;
  label?: string;
  max_duration?: number;
  max_duration_sec?: number;
  max_duration_seconds?: number;
}

export async function listVideoModels(): Promise<HedraVideoModel[]> {
  const json = await jsonRequest<{ models?: RawHedraModel[] } | RawHedraModel[]>(
    "/models?types=video",
    { method: "GET" }
  );
  const rows = Array.isArray(json) ? json : json.models ?? [];
  return rows.map((r) => ({
    slug: r.slug ?? r.model_slug ?? "unknown",
    label: r.label ?? r.name ?? r.slug ?? "unknown",
    maxDurationSec:
      r.max_duration ?? r.max_duration_sec ?? r.max_duration_seconds ?? null,
    raw: r,
  }));
}
