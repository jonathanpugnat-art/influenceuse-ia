import { getAppUrlHost } from "@/lib/app-url";

/** Fail-closed: never submit Seedance to Fal without a signed webhook URL. */
export const MISSING_SEEDANCE_WEBHOOK_SECRET =
  "SEEDANCE_WEBHOOK_SECRET is not configured. Fal submit skipped; credits refunded.";

/** Fail-closed: never submit Remix to Fal without a signed webhook URL. */
export const MISSING_REMIX_WEBHOOK_SECRET =
  "REMIX_WEBHOOK_SECRET is not configured. Fal submit skipped; credits refunded.";

/**
 * Structured submit log — never includes the webhook secret or the full
 * webhook URL (the secret lives in the query string).
 */
export function logFalVideoSubmit(opts: {
  engine: "seedance" | "remix" | "kling_o3_i2v";
  jobId: string;
  webhookConfigured: boolean;
  falRequestId?: string | null;
  modelId?: string | null;
  mode?: string | null;
  refCount?: number | null;
  duration?: number | null;
  generateAudio?: boolean | null;
  characterId?: string | null;
}): void {
  const line = opts.webhookConfigured ? console.info : console.error;
  line(`[${opts.engine}] fal-submit`, {
    jobId: opts.jobId,
    webhookConfigured: opts.webhookConfigured,
    appHost: getAppUrlHost(),
    falRequestId: opts.falRequestId ?? null,
    modelId: opts.modelId ?? null,
    mode: opts.mode ?? null,
    refCount: opts.refCount ?? null,
    duration: opts.duration ?? null,
    generate_audio: opts.generateAudio ?? null,
    characterId: opts.characterId ?? null,
  });
}
