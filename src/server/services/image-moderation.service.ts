import {
  isSightengineConfigured,
  resolvePremiumModerationPartialThreshold,
  resolvePremiumModerationRawThreshold,
  shouldUsePremiumModeration,
} from "@/lib/premium-image-config";

export type ImageModerationResult = {
  ok: boolean;
  provider: "sightengine" | "skipped";
  raw?: number;
  partial?: number;
  reason?: string;
};

const SIGHTENGINE_CHECK_URL = "https://api.sightengine.com/1.0/check.json";

export class PremiumImageModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PremiumImageModerationError";
  }
}

export const PREMIUM_MODERATION_USER_MESSAGE =
  "L'image générée a été refusée (contenu trop explicite). Reformule en mode boudoir suggestif — lingerie portée, pas de nudité — puis réessaie.";

interface SightengineNudityScores {
  raw?: number;
  partial?: number;
  safe?: number;
}

async function checkWithSightengine(imageUrl: string): Promise<ImageModerationResult> {
  const apiUser = process.env.SIGHTENGINE_API_USER?.trim();
  const apiSecret = process.env.SIGHTENGINE_API_SECRET?.trim();
  if (!apiUser || !apiSecret) {
    throw new Error("Sightengine credentials missing");
  }

  const params = new URLSearchParams({
    url: imageUrl,
    models: "nudity-2.0,offensive",
    api_user: apiUser,
    api_secret: apiSecret,
  });

  const res = await fetch(`${SIGHTENGINE_CHECK_URL}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sightengine check failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    status?: string;
    nudity?: SightengineNudityScores;
    offensive?: { prob?: number };
  };

  const raw = json.nudity?.raw ?? 0;
  const partial = json.nudity?.partial ?? 0;
  const rawThreshold = resolvePremiumModerationRawThreshold();
  const partialThreshold = resolvePremiumModerationPartialThreshold();

  if (raw >= rawThreshold) {
    return {
      ok: false,
      provider: "sightengine",
      raw,
      partial,
      reason: `raw nudity ${raw.toFixed(2)} >= ${rawThreshold}`,
    };
  }
  if (partial >= partialThreshold) {
    return {
      ok: false,
      provider: "sightengine",
      raw,
      partial,
      reason: `partial nudity ${partial.toFixed(2)} >= ${partialThreshold}`,
    };
  }

  const offensive = json.offensive?.prob ?? 0;
  if (offensive >= 0.85) {
    return {
      ok: false,
      provider: "sightengine",
      raw,
      partial,
      reason: `offensive ${offensive.toFixed(2)}`,
    };
  }

  return { ok: true, provider: "sightengine", raw, partial };
}

/** Moderate a single generated image URL for the Premium lane. */
export async function moderatePremiumImageUrl(
  imageUrl: string
): Promise<ImageModerationResult> {
  if (!shouldUsePremiumModeration()) {
    if (!isSightengineConfigured()) {
      console.warn(
        "[image-moderation] Sightengine not configured — Premium images skip post-filter. " +
          "Set SIGHTENGINE_API_USER + SIGHTENGINE_API_SECRET on Vercel for production."
      );
    }
    return { ok: true, provider: "skipped" };
  }

  return checkWithSightengine(imageUrl);
}

/** Filter URLs — throws if any image fails moderation. */
export async function assertPremiumImagesModerated(
  imageUrls: string[]
): Promise<ImageModerationResult[]> {
  const results: ImageModerationResult[] = [];
  for (const url of imageUrls) {
    const result = await moderatePremiumImageUrl(url);
    results.push(result);
    if (!result.ok) {
      throw new PremiumImageModerationError(PREMIUM_MODERATION_USER_MESSAGE);
    }
  }
  return results;
}
