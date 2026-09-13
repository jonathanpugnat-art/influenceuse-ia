/**
 * Viral remix V2 — Motion Control cascade + Viggle + Wan replace.
 *
 * The user uploads a TikTok/Reel clip and the locked character replays
 * the motion. Default `REMIX_ENGINE=motion_control_cascade`:
 *   P0a fal-ai/kling-video/v2.6/standard/motion-control
 *       then v3/standard then v3/pro (image_url + video_url)
 *   P0b Viggle POST /v1/renders when VIGGLE_API_KEY is set (~$0.01/s)
 *   P0c fal-ai/wan/v2.2-14b/animate/replace (same FAL_KEY / queue / webhook)
 * Kling O3 Omni V2V stays as `REMIX_ENGINE=kling_o3_v2v`. No PuLID.
 *
 * Assumed provider list prices (2026-09 docs):
 *   Motion Control V2.6 Standard: $0.07/s
 *   Motion Control V3 Standard:   $0.126/s → 10 credits/s → ~3.17×
 *   Motion Control V3 Pro:        $0.168/s → 14 credits/s → ~3.33×
 *   Viggle remix:                 $0.01/s (when keyed)
 *   Wan replace 480p:             ~$0.04/s billed-frame (rare fallback)
 * 1 Aura credit ≈ $0.04. ≥3× margin on the primary MC path.
 */

export const REMIX_TIER_VALUES = ["standard", "pro"] as const;
export type RemixTier = (typeof REMIX_TIER_VALUES)[number];

export const REMIX_ORIENTATION_VALUES = ["video", "image"] as const;
export type RemixOrientation = (typeof REMIX_ORIENTATION_VALUES)[number];

/** Motion-control `video` orientation + UI picker: 5 | 10 | 15 | 30. */
export const REMIX_ALLOWED_DURATIONS = [5, 10, 15, 30] as const;
export type RemixDuration = (typeof REMIX_ALLOWED_DURATIONS)[number];

/** Camera / portrait (`character_orientation=image`) — Fal max 10s. */
export const REMIX_IMAGE_ALLOWED_DURATIONS = [5, 10] as const;
export type RemixImageDuration = (typeof REMIX_IMAGE_ALLOWED_DURATIONS)[number];

/** Full-body / fitness (`character_orientation=video`) — Fal max 30s. */
export const REMIX_VIDEO_ORIENTATION_MAX_SEC = 30;
export const REMIX_IMAGE_ORIENTATION_MAX_SEC = 10;
/** Hard cap = video orientation (longest supported primary engine). */
export const REMIX_MAX_DURATION_SEC = REMIX_VIDEO_ORIENTATION_MAX_SEC;
/** Kling minimum source clip length. */
export const REMIX_MIN_SOURCE_DURATION_SEC = 3;
/** Default source cap (video orientation). Image orientation uses 10s. */
export const REMIX_MAX_SOURCE_DURATION_SEC = REMIX_VIDEO_ORIENTATION_MAX_SEC;
/** Kling max upload size (mp4/mov). */
export const REMIX_MAX_SOURCE_BYTES = 200 * 1024 * 1024;
/** Kling accepted uploads. */
export const REMIX_ALLOWED_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;
/** Kling caps `elements + image_urls` at 4 references total. */
export const REMIX_MAX_TOTAL_REFERENCES = 4;

/**
 * Live per-second provider cost (USD) and Aura credit charge.
 *   Standard MC V3: $0.126/s → 10 credits/s → 1 credit ≈ $0.04 → ~3.17×
 *   Pro MC V3:      $0.168/s → 14 credits/s → same 1 credit ≈ $0.04 → ~3.33×
 */
export const REMIX_ONE_CREDIT_USD = 0.04;

export const REMIX_MOTION_CONTROL_V26_STANDARD_MODEL =
  "fal-ai/kling-video/v2.6/standard/motion-control";
export const REMIX_MOTION_CONTROL_STANDARD_MODEL =
  "fal-ai/kling-video/v3/standard/motion-control";
export const REMIX_MOTION_CONTROL_PRO_MODEL =
  "fal-ai/kling-video/v3/pro/motion-control";
export const REMIX_O1_V2V_EDIT_MODEL =
  "fal-ai/kling-video/o1/video-to-video/edit";
export const REMIX_WAN_REPLACE_MODEL =
  "fal-ai/wan/v2.2-14b/animate/replace";
export const REMIX_VIGGLE_MODEL_ID = "viggle.ai/v1/renders";
export const REMIX_O3_STANDARD_MODEL =
  "fal-ai/kling-video/o3/standard/video-to-video/reference";
export const REMIX_O3_PRO_MODEL =
  "fal-ai/kling-video/o3/pro/video-to-video/reference";

export interface RemixTierConfig {
  label: string;
  /** Default FAL model id when env override is not set (O3 rollback). */
  defaultModelId: string;
  /** Primary motion-control model for this tier. */
  motionControlModelId: string;
  /** Provider list price in USD per second of output (primary engine). */
  costPerSecUsd: number;
  /** Aura credits charged per second of output. Ceils per-remix. */
  creditsPerSec: number;
}

export const REMIX_TIERS: Record<RemixTier, RemixTierConfig> = {
  standard: {
    label: "Standard",
    defaultModelId: REMIX_O3_STANDARD_MODEL,
    motionControlModelId: REMIX_MOTION_CONTROL_STANDARD_MODEL,
    costPerSecUsd: 0.126,
    creditsPerSec: 10,
  },
  pro: {
    label: "Pro",
    defaultModelId: REMIX_O3_PRO_MODEL,
    motionControlModelId: REMIX_MOTION_CONTROL_PRO_MODEL,
    costPerSecUsd: 0.168,
    creditsPerSec: 14,
  },
};

/** O3 Omni V2V — kept for `REMIX_ENGINE=kling_o3_v2v` rollback. */
export function resolveRemixModelId(
  tier: RemixTier,
  env: Record<string, string | undefined> = process.env
): string {
  const overrideKey =
    tier === "standard"
      ? "FAL_KLING_O3_REMIX_STANDARD_MODEL"
      : "FAL_KLING_O3_REMIX_PRO_MODEL";
  return env[overrideKey]?.trim() || REMIX_TIERS[tier].defaultModelId;
}

export function resolveRemixMotionControlModelId(
  tier: RemixTier,
  env: Record<string, string | undefined> = process.env
): string {
  const overrideKey =
    tier === "standard"
      ? "FAL_KLING_MOTION_CONTROL_STANDARD_MODEL"
      : "FAL_KLING_MOTION_CONTROL_PRO_MODEL";
  return env[overrideKey]?.trim() || REMIX_TIERS[tier].motionControlModelId;
}

export function resolveRemixO1EditModelId(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FAL_KLING_O1_V2V_EDIT_MODEL?.trim() || REMIX_O1_V2V_EDIT_MODEL;
}

export function resolveRemixWanReplaceModelId(
  env: Record<string, string | undefined> = process.env
): string {
  return env.FAL_WAN_REPLACE_MODEL?.trim() || REMIX_WAN_REPLACE_MODEL;
}

export function isViggleRemixModelId(modelId: string | null | undefined): boolean {
  return (modelId ?? "").trim() === REMIX_VIGGLE_MODEL_ID;
}

export function remixMaxDurationSec(
  orientation: RemixOrientation = "video"
): RemixDuration {
  return orientation === "image"
    ? REMIX_IMAGE_ORIENTATION_MAX_SEC
    : REMIX_VIDEO_ORIENTATION_MAX_SEC;
}

export function allowedRemixDurations(
  orientation: RemixOrientation = "video"
): readonly RemixDuration[] {
  return orientation === "image"
    ? REMIX_IMAGE_ALLOWED_DURATIONS
    : REMIX_ALLOWED_DURATIONS;
}

/** Total credits held on queue. Integer, ceiled. */
export function estimateRemixCreditsForTier(
  tier: RemixTier,
  durationSec: RemixDuration
): number {
  return Math.ceil(REMIX_TIERS[tier].creditsPerSec * durationSec);
}

/**
 * Server-side duration clamp. The client picks 5/10/15/(30) but the
 * billed length cannot exceed the source clip or the orientation cap
 * (10s image / 30s video). When `sourceDurationSec` is unknown we trust
 * the client pick as long as it's within the orientation max.
 */
export function clampRemixDuration(
  requested: number,
  sourceDurationSec?: number | null,
  orientation: RemixOrientation = "video"
): RemixDuration {
  const allowed = allowedRemixDurations(orientation);
  const max = remixMaxDurationSec(orientation);
  const source = Number.isFinite(sourceDurationSec)
    ? Math.max(0, Math.floor(sourceDurationSec as number))
    : max;
  const ceiling = Math.min(max, source);
  const eligible = allowed.filter((d) => d <= ceiling);
  const preferred: RemixDuration = allowed.includes(requested as RemixDuration)
    ? (requested as RemixDuration)
    : allowed.filter((d) => d <= requested).pop() ?? max;

  if (eligible.length === 0) {
    // Source is < 5s. We let the server surface a validation error so the
    // user re-uploads a longer clip.
    return 5;
  }
  if (eligible.includes(preferred)) return preferred;
  return eligible[eligible.length - 1];
}

/**
 * Build Kling's `elements[]` payload. The frontal image is always the first
 * reference (Kling character lock); up to 3 alternate angle stills follow so
 * `elements + image_urls` stays within the total cap of 4.
 */
export function buildRemixElements(input: {
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
}): Array<{ frontal_image_url: string; reference_image_urls: string[] }> {
  const frontal = input.frontalImageUrl.trim();
  if (!frontal) {
    throw new Error("Remix requires a frontal identity image URL.");
  }
  const refs = (input.referenceImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http") && u !== frontal);

  const maxRefs = Math.max(0, REMIX_MAX_TOTAL_REFERENCES - 1);
  return [
    {
      frontal_image_url: frontal,
      reference_image_urls: refs.slice(0, maxRefs),
    },
  ];
}

/**
 * Kling prompt template — instructs the model to REPLACE the main character
 * with our locked identity while keeping camera, motion and timing of the
 * source video (the whole point of remix vs I2V).
 */
export function buildRemixPrompt(opts?: {
  characterName?: string | null;
  extra?: string | null;
}): string {
  const character = opts?.characterName?.trim();
  const base = character
    ? `Replace the main character with @Element1 (${character}).`
    : `Replace the main character with @Element1.`;
  const parts = [
    base,
    `Keep camera, motion and timing of @Video1.`,
    `Vertical 9:16 output, cinematic realism, natural skin, no morphing face.`,
  ];
  if (opts?.extra?.trim()) parts.push(opts.extra.trim());
  return parts.join(" ");
}

export interface RemixSourceIssue {
  code:
    | "unsupported_mime"
    | "too_large"
    | "too_short"
    | "too_long"
    | "invalid_url";
  message: string;
}

/**
 * Validate a source clip using metadata the client already has (mime type,
 * size, duration measured from the `<video>` element on the drop). We do not
 * re-decode server-side (Vercel has no ffmpeg) — the URL served by our R2
 * matches what we uploaded, so the same constraints apply.
 */
export function validateRemixSource(
  source: {
    mimeType?: string | null;
    sizeBytes?: number | null;
    durationSec?: number | null;
    url?: string | null;
  },
  orientation: RemixOrientation = "video"
): RemixSourceIssue | null {
  if (!source.url || !source.url.trim().startsWith("http")) {
    return {
      code: "invalid_url",
      message:
        "URL vidéo source invalide. Uploade un MP4/MOV depuis le drop zone.",
    };
  }
  if (source.mimeType) {
    const mime = source.mimeType.toLowerCase();
    if (!REMIX_ALLOWED_MIME_TYPES.some((m) => mime.startsWith(m))) {
      return {
        code: "unsupported_mime",
        message: "Format non supporté. Utilise un MP4 ou MOV.",
      };
    }
  }
  if (
    typeof source.sizeBytes === "number" &&
    source.sizeBytes > REMIX_MAX_SOURCE_BYTES
  ) {
    return {
      code: "too_large",
      message: `Le clip dépasse ${Math.floor(
        REMIX_MAX_SOURCE_BYTES / 1024 / 1024
      )} Mo. Compresse ou raccourcis-le.`,
    };
  }
  if (typeof source.durationSec === "number") {
    if (source.durationSec < REMIX_MIN_SOURCE_DURATION_SEC) {
      return {
        code: "too_short",
        message: `Clip trop court (< ${REMIX_MIN_SOURCE_DURATION_SEC}s). Choisis un clip plus long.`,
      };
    }
    const maxSec = remixMaxDurationSec(orientation);
    if (source.durationSec > maxSec + 1) {
      // Allow 1s of slack for browser rounding; anything beyond is rejected.
      return {
        code: "too_long",
        message: `Clip trop long (> ${maxSec}s). Raccourcis-le en amont.`,
      };
    }
  }
  return null;
}

/**
 * Cheap oEmbed preview — TITLE / COVER only. V1 does NOT scrape TikTok/IG
 * media (ToS). We only render what the platform's public oEmbed endpoint
 * exposes; if oEmbed fails we display nothing (upload path is mandatory).
 */
export interface RemixOembedProvider {
  match: (url: string) => boolean;
  endpoint: (url: string) => string;
  provider: string;
}

export const REMIX_OEMBED_PROVIDERS: RemixOembedProvider[] = [
  {
    provider: "tiktok",
    match: (u) => /tiktok\.com\//.test(u),
    endpoint: (u) =>
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  },
  {
    provider: "instagram",
    match: (u) => /instagram\.com\/(reel|p|tv)\//.test(u),
    // IG oEmbed is authenticated (Meta App token). We only match so the UI can
    // show a friendly "collez une URL" hint, but never actually hit their API
    // in V1 — the upload flow is the only source of truth.
    endpoint: () => "",
  },
];

export function resolveRemixOembedProvider(
  url: string
): RemixOembedProvider | null {
  return REMIX_OEMBED_PROVIDERS.find((p) => p.match(url)) ?? null;
}
