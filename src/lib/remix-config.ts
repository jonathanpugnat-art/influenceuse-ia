/**
 * Viral remix V1 — Kling O3 Omni video-to-video + elements config.
 *
 * The user pastes/uploads a TikTok/Reel clip and the locked character
 * (existing influencer identity) replays the motion. We use Kling's
 * V2V + reference-elements endpoint so camera/motion is preserved and
 * identity is locked via `elements[]` stills (no PuLID).
 *
 * Standard is the iteration tier ($0.126/s), Pro is paid export ($0.168/s).
 * Costs and credit rates are calibrated against the ≥3× provider-cost
 * economics target (1 Aura credit ≈ $0.04).
 */

export const REMIX_TIER_VALUES = ["standard", "pro"] as const;
export type RemixTier = (typeof REMIX_TIER_VALUES)[number];

export const REMIX_ALLOWED_DURATIONS = [5, 10, 15] as const;
export type RemixDuration = (typeof REMIX_ALLOWED_DURATIONS)[number];

/** Kling accepts durations 5|10|15. V1 caps at 15s per PRD. */
export const REMIX_MAX_DURATION_SEC = 15;
/** Kling minimum source clip length. */
export const REMIX_MIN_SOURCE_DURATION_SEC = 3;
/** Kling maximum source clip length — hard upstream constraint. */
export const REMIX_MAX_SOURCE_DURATION_SEC = 15;
/** Kling max upload size (mp4/mov). */
export const REMIX_MAX_SOURCE_BYTES = 200 * 1024 * 1024;
/** Kling accepted uploads. */
export const REMIX_ALLOWED_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;
/** Kling caps `elements + image_urls` at 4 references total. */
export const REMIX_MAX_TOTAL_REFERENCES = 4;

/**
 * Live per-second provider cost (USD) and Aura credit charge.
 *   Standard: $0.126/s → 10 credits/s → 1 credit ≈ $0.04 → ~3.17× margin
 *   Pro:      $0.168/s → 14 credits/s → same 1 credit ≈ $0.04 → ~3.33× margin
 * If a codebase-owned video credit helper appears later, replace these two
 * constants; the rest of the file only depends on them.
 */
export const REMIX_ONE_CREDIT_USD = 0.04;

export interface RemixTierConfig {
  label: string;
  /** Default FAL model id when env override is not set. */
  defaultModelId: string;
  /** Provider list price in USD per second of output. */
  costPerSecUsd: number;
  /** Aura credits charged per second of output. Ceils per-remix. */
  creditsPerSec: number;
}

export const REMIX_TIERS: Record<RemixTier, RemixTierConfig> = {
  standard: {
    label: "Standard",
    defaultModelId:
      "fal-ai/kling-video/o3/standard/video-to-video/reference",
    costPerSecUsd: 0.126,
    creditsPerSec: 10,
  },
  pro: {
    label: "Pro",
    defaultModelId: "fal-ai/kling-video/o3/pro/video-to-video/reference",
    costPerSecUsd: 0.168,
    creditsPerSec: 14,
  },
};

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

/** Total credits held on queue. Integer, ceiled. */
export function estimateRemixCreditsForTier(
  tier: RemixTier,
  durationSec: RemixDuration
): number {
  return Math.ceil(REMIX_TIERS[tier].creditsPerSec * durationSec);
}

/**
 * Server-side duration clamp. The client picks 5/10/15 but Kling can only
 * output up to `sourceDurationSec`, and the PRD caps V1 at 15s regardless
 * of the source. When `sourceDurationSec` is unknown we trust the client
 * pick as long as it's ≤ 15s.
 */
export function clampRemixDuration(
  requested: number,
  sourceDurationSec?: number | null
): RemixDuration {
  const source = Number.isFinite(sourceDurationSec)
    ? Math.max(0, Math.floor(sourceDurationSec as number))
    : REMIX_MAX_DURATION_SEC;
  const ceiling = Math.min(REMIX_MAX_DURATION_SEC, source);
  const eligible = REMIX_ALLOWED_DURATIONS.filter((d) => d <= ceiling);
  const preferred = REMIX_ALLOWED_DURATIONS.includes(
    requested as RemixDuration
  )
    ? (requested as RemixDuration)
    : REMIX_MAX_DURATION_SEC;

  if (eligible.length === 0) {
    // Source is < 5s. Kling still requires 5|10|15; we let the server surface
    // a validation error so the user re-uploads a longer clip.
    return 5;
  }
  if (eligible.includes(preferred)) return preferred;
  // Pick the largest allowed value that still fits the source.
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
export function validateRemixSource(source: {
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSec?: number | null;
  url?: string | null;
}): RemixSourceIssue | null {
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
    if (source.durationSec > REMIX_MAX_SOURCE_DURATION_SEC + 1) {
      // Allow 1s of slack for browser rounding; anything beyond is rejected.
      return {
        code: "too_long",
        message: `Clip trop long (> ${REMIX_MAX_SOURCE_DURATION_SEC}s). Raccourcis-le en amont.`,
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
