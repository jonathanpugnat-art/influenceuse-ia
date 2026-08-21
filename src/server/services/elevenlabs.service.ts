/**
 * ElevenLabs client — talking-head V1 (portable voice).
 *
 * Two operations we care about here:
 *   1. Instant Voice Clone (IVC) — upload 10–30s of clear speech and
 *      persist the returned `voice_id` on the Character. Reused for every
 *      talking-head reel + future features (remix, publish).
 *   2. Text-to-speech — feed the cloned `voice_id` a short script and
 *      stream back an MP3 that we upload to R2 and hand to Hedra as the
 *      audio asset.
 *
 * Docs:
 *   https://elevenlabs.io/docs/api-reference/voices/add-voice
 *   https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 *   https://elevenlabs.io/docs/api-reference/voices/get-shared-voices
 *
 * NOTE: We deliberately never fall back to ElevenLabs "Default voices"
 * — those expire on 2026-12-31 and would silently break the character
 * voice signature. The Voice Library picker is the only sanctioned
 * fallback when the user hasn't cloned yet.
 */

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const PREVIEW_MODEL_ID = "eleven_flash_v2_5";
const API_BASE = "https://api.elevenlabs.io/v1";
const REQUEST_TIMEOUT_MS = 60_000;

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

function requireApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "ELEVENLABS_API_KEY manquant. Configure la clé ElevenLabs dans les variables d'environnement pour activer la voix de personnage."
    );
  }
  return key;
}

// ──────────────────────────────────────────────
// HTTP helper with timeout
// ──────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return `HTTP ${res.status}`;
  }
}

// ──────────────────────────────────────────────
// Voice clone — POST /v1/voices/add (multipart)
// ──────────────────────────────────────────────

export interface CloneVoiceInput {
  /** Public URL of the audio sample (mp3/wav, 10-30s recommended). */
  sampleUrl: string;
  /** Human-readable label persisted alongside the voice on ElevenLabs. */
  name: string;
  /** Optional description (kept short — ElevenLabs limits ~500 chars). */
  description?: string;
}

export interface CloneVoiceResult {
  voiceId: string;
  raw: unknown;
}

/**
 * Clone a voice from a single sample URL. Uses ElevenLabs Instant Voice
 * Clone (paid plans only — commercial license from Starter). The sample
 * is downloaded server-side so we can respect the multipart contract
 * even when the sample lives on R2 (Signed URLs, etc.).
 */
export async function cloneVoice(
  input: CloneVoiceInput
): Promise<CloneVoiceResult> {
  const apiKey = requireApiKey();

  const sample = await fetchWithTimeout(input.sampleUrl, {
    timeoutMs: 45_000,
  });
  if (!sample.ok) {
    throw new Error(
      `Impossible de télécharger l'échantillon voix (HTTP ${sample.status}).`
    );
  }
  const contentType =
    sample.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
  const buffer = new Uint8Array(await sample.arrayBuffer());
  if (buffer.byteLength < 4_000) {
    throw new Error(
      "Échantillon audio trop court. Fournis au moins 10 s de parole claire."
    );
  }

  const filename = deriveSampleFilename(input.sampleUrl, contentType);
  const form = new FormData();
  form.append("name", input.name.slice(0, 90));
  if (input.description?.trim()) {
    form.append("description", input.description.trim().slice(0, 480));
  }
  form.append("files", new Blob([buffer], { type: contentType }), filename);

  const res = await fetchWithTimeout(`${API_BASE}/voices/add`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(
      `ElevenLabs voices/add a échoué (HTTP ${res.status}) : ${body}`
    );
  }

  const json = (await res.json()) as { voice_id?: string };
  if (!json?.voice_id) {
    throw new Error(
      "ElevenLabs n'a pas retourné de voice_id. Vérifie ton plan (IVC nécessite Starter minimum)."
    );
  }
  return { voiceId: json.voice_id, raw: json };
}

function deriveSampleFilename(url: string, contentType: string): string {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() || "sample";
    if (base.includes(".")) return base;
  } catch {
    // fall through
  }
  const ext =
    contentType.includes("wav")
      ? "wav"
      : contentType.includes("ogg")
        ? "ogg"
        : contentType.includes("mp4")
          ? "m4a"
          : "mp3";
  return `voice-sample.${ext}`;
}

// ──────────────────────────────────────────────
// TTS — POST /v1/text-to-speech/{voice_id}
// ──────────────────────────────────────────────

export interface SynthesizeSpeechInput {
  voiceId: string;
  text: string;
  /** ElevenLabs model id (defaults to `eleven_multilingual_v2`). */
  modelId?: string;
  /**
   * Optional voice settings — sensible defaults are used when unset:
   * `{ stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true }`
   */
  voiceSettings?: Record<string, number | boolean>;
}

export interface SynthesizeSpeechResult {
  /** Raw MP3 bytes (caller uploads to R2). */
  audio: Buffer;
  contentType: string;
  charactersUsed: number;
  modelId: string;
}

export async function synthesizeSpeech(
  input: SynthesizeSpeechInput
): Promise<SynthesizeSpeechResult> {
  const apiKey = requireApiKey();
  const text = input.text.trim();
  if (!text) {
    throw new Error("Script vide — impossible de synthétiser une voix.");
  }
  const modelId = input.modelId?.trim() || DEFAULT_MODEL_ID;

  const url = `${API_BASE}/text-to-speech/${encodeURIComponent(
    input.voiceId
  )}?output_format=mp3_44100_128`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      accept: "audio/mpeg",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
        ...input.voiceSettings,
      },
    }),
    timeoutMs: 90_000,
  });

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(
      `ElevenLabs TTS a échoué (HTTP ${res.status}) : ${body}`
    );
  }

  const arr = await res.arrayBuffer();
  const audio = Buffer.from(arr);
  if (audio.byteLength < 1_000) {
    throw new Error(
      "ElevenLabs a retourné un audio vide. Réessaie ou vérifie ta voix."
    );
  }

  return {
    audio,
    contentType: res.headers.get("content-type") ?? "audio/mpeg",
    charactersUsed: text.length,
    modelId,
  };
}

/**
 * Cheaper, lower-latency preview TTS (Flash 2.5) — used by the voice
 * picker to play a 3s sample without hammering the good model.
 */
export async function synthesizeVoicePreview(input: {
  voiceId: string;
  text: string;
}): Promise<SynthesizeSpeechResult> {
  return synthesizeSpeech({
    voiceId: input.voiceId,
    text: input.text,
    modelId: PREVIEW_MODEL_ID,
  });
}

// ──────────────────────────────────────────────
// Voice Library — GET /v1/shared-voices
// ──────────────────────────────────────────────

export interface LibraryVoice {
  voiceId: string;
  name: string;
  description: string | null;
  gender: string | null;
  language: string | null;
  previewUrl: string | null;
}

export interface ListLibraryVoicesInput {
  gender?: "male" | "female";
  language?: string;
  search?: string;
  pageSize?: number;
}

/**
 * List published shared voices from the ElevenLabs Voice Library.
 * Only "public" voices are returned so the user can pick a stable fallback
 * without cloning (Default voices are excluded — they expire 2026-12-31).
 */
export async function listLibraryVoices(
  input: ListLibraryVoicesInput = {}
): Promise<LibraryVoice[]> {
  const apiKey = requireApiKey();
  const params = new URLSearchParams();
  params.set("page_size", String(Math.min(Math.max(input.pageSize ?? 20, 1), 50)));
  if (input.gender) params.set("gender", input.gender);
  if (input.language) params.set("language", input.language);
  if (input.search) params.set("search", input.search);

  const res = await fetchWithTimeout(
    `${API_BASE}/shared-voices?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        accept: "application/json",
      },
    }
  );
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(
      `ElevenLabs shared-voices a échoué (HTTP ${res.status}) : ${body}`
    );
  }
  const json = (await res.json()) as {
    voices?: Array<{
      voice_id: string;
      name?: string;
      description?: string | null;
      gender?: string | null;
      language?: string | null;
      preview_url?: string | null;
    }>;
  };
  const voices = json.voices ?? [];
  return voices.map((v) => ({
    voiceId: v.voice_id,
    name: v.name ?? "(voix sans nom)",
    description: v.description ?? null,
    gender: v.gender ?? null,
    language: v.language ?? null,
    previewUrl: v.preview_url ?? null,
  }));
}
