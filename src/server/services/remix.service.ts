import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { getAppUrl } from "@/lib/app-url";
import { formatGenerationErrorForUser } from "@/lib/generation-errors";
import { parseIdentityPack } from "@/lib/identity-pack";
import {
  clampRemixDuration,
  estimateRemixCreditsForTier,
  isViggleRemixModelId,
  type RemixDuration,
  type RemixOrientation,
  type RemixTier,
} from "@/lib/remix-config";
import {
  buildMotionControlPrompt,
  classifyRemixProviderError,
  getRemixEngine,
  isRemixEngine,
  logRemixProviderError,
  planRemixAttempts,
  REMIX_CONTENT_POLICY_USER_MESSAGE,
  REMIX_O1_EDIT_PROMPT,
  type RemixAttempt,
  type RemixEngine,
  type RemixErrorClass,
} from "@/lib/remix-engine";
import {
  checkCredits,
  deductCredits,
  refundCredits,
} from "@/server/services/credits.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import {
  buildFalKlingO3RemixPayload,
  submitFalKlingO3Remix,
} from "@/server/services/video-providers/fal-kling-o3-remix.provider";
import {
  checkFalRemixQueue,
  submitFalKlingMotionControlRemix,
  submitFalKlingO1V2vEdit,
  type FalRemixCheckResult,
  type FalRemixSubmitResult,
} from "@/server/services/video-providers/fal-kling-motion-control-remix.provider";
import { submitFalWanReplaceRemix } from "@/server/services/video-providers/fal-wan-replace-remix.provider";
import {
  checkViggleRemix,
  submitViggleRemix,
} from "@/server/services/video-providers/viggle-remix.provider";
import { uploadFromUrl } from "@/server/services/storage.service";
import { emitEvent } from "@/server/services/webhook.service";
import {
  logFalVideoSubmit,
  MISSING_REMIX_WEBHOOK_SECRET,
} from "@/server/services/fal-video-webhook";
import type { RemixJob } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateRemixInput {
  userId: string;
  influencerId: string;
  tier: RemixTier;
  sourceVideoUrl: string;
  sourceDurationSec?: number | null;
  requestedDuration: number;
  keepAudio: boolean;
  /** `video` = full-body / fitness (≤30s). `image` = camera (≤10s). */
  characterOrientation?: RemixOrientation;
  extraPromptTail?: string | null;
  oembedPreview?: unknown;
}

export interface RemixAttemptRecord {
  kind: RemixAttempt["kind"];
  engine: string;
  orientation?: RemixOrientation;
  modelId: string;
  falRequestId?: string;
  errorClass?: RemixErrorClass;
  error?: string;
}

export interface RemixJobMeta {
  v: 2;
  engine: RemixEngine;
  orientation: RemixOrientation;
  attemptIndex: number;
  attempts: RemixAttemptRecord[];
}

function remixMetaJson(meta: RemixJobMeta): object {
  return meta;
}

export interface CreateRemixResult {
  jobId: string;
  cost: number;
  duration: RemixDuration;
  status: RemixJob["status"];
}

// ──────────────────────────────────────────────
// Identity resolution (elements[])
// ──────────────────────────────────────────────

interface ResolvedRemixIdentity {
  frontalImageUrl: string;
  referenceImageUrls: string[];
  characterName: string;
}

/**
 * Assemble the identity pack used as Kling `elements[]`. Frontal is
 * mandatory (wizard base portrait); refs are the identity-pack angle
 * stills (3/4, full-body, profile) when they're ready. If none of these
 * exist we throw — a locked character with no picture cannot be remixed.
 */
async function resolveInfluencerIdentity(
  influencerId: string,
  userId: string
): Promise<ResolvedRemixIdentity> {
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId },
    select: {
      id: true,
      name: true,
      baseImageUrl: true,
      avatarUrl: true,
      identityPack: true,
    },
  });
  if (!influencer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Personnage introuvable ou non accessible.",
    });
  }

  const pack = parseIdentityPack(influencer.identityPack);

  const frontalCandidates: Array<string | null | undefined> = [
    pack?.shots.find((s) => s.id === "portrait_front")?.url,
    influencer.baseImageUrl,
    influencer.avatarUrl,
  ];
  let frontal: string | undefined;
  for (const candidate of frontalCandidates) {
    const resolved = await resolvePublicMediaUrl(candidate);
    if (resolved) {
      frontal = resolved;
      break;
    }
  }
  if (!frontal) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Ce personnage n'a pas encore de portrait de référence. Termine l'assistant de création avant de lancer un remix.",
    });
  }

  const refsRaw =
    pack && pack.status === "ready"
      ? pack.shots
          .filter((s) => s.id !== "portrait_front")
          .map((s) => s.url)
      : [];
  const refs: string[] = [];
  for (const raw of refsRaw) {
    if (refs.length >= 3) break;
    const resolved = await resolvePublicMediaUrl(raw);
    if (resolved && resolved !== frontal && !refs.includes(resolved)) {
      refs.push(resolved);
    }
  }

  return {
    frontalImageUrl: frontal,
    referenceImageUrls: refs,
    characterName: influencer.name,
  };
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Kick off a remix job:
 *   1. Resolve identity pack (frontal + up to 3 refs).
 *   2. Clamp duration to source + orientation (10s image / 30s video).
 *   3. Hold credits (deductCredits — refunded on FAIL).
 *   4. Require a signed webhook URL (fail-closed if
 *      REMIX_WEBHOOK_SECRET is missing — never submit to Fal without
 *      a callback).
 *   5. Submit the cascade (MC v2.6 → v3 std → v3 pro → Viggle → Wan),
 *      log host + falRequestId (no secrets). content_policy / 422 tries
 *      the next engine before refunding.
 *   6. Persist RemixJob so the webhook can find it by request_id.
 *
 * The caller receives the job id + the credits held so the UI can show
 * the exact charge before render is complete.
 *
 * If no webhook arrives within 20 min (`STALE_VIDEO_JOB_MS`), the
 * sweeper calls `failRemixJob` so the hold is refunded.
 */
export async function createRemixJob(
  input: CreateRemixInput
): Promise<CreateRemixResult> {
  const identity = await resolveInfluencerIdentity(
    input.influencerId,
    input.userId
  );

  const orientation: RemixOrientation = input.characterOrientation ?? "video";
  const engine = getRemixEngine();
  const duration = clampRemixDuration(
    input.requestedDuration,
    input.sourceDurationSec ?? null,
    orientation
  );
  const cost = estimateRemixCreditsForTier(input.tier, duration);

  const sourceVideoUrl = await resolvePublicMediaUrl(input.sourceVideoUrl);
  if (!sourceVideoUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "URL vidéo source inaccessible. Ré-uploade le clip depuis le drop zone.",
    });
  }

  const hasCredits = await checkCredits(input.userId, cost);
  if (!hasCredits) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Crédits insuffisants. Ce remix coûte ${cost} crédits.`,
    });
  }

  const clipDurationSec = input.sourceDurationSec ?? duration;
  const attempts = planRemixAttempts({
    engine,
    orientation,
    clipDurationSec,
    tier: input.tier,
  });
  if (attempts.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: REMIX_CONTENT_POLICY_USER_MESSAGE,
    });
  }

  // Validate the first payload BEFORE we hold credits so a bad input
  // never bills the user.
  const firstPrompt = previewRemixAttemptPrompt({
    attempt: attempts[0],
    videoUrl: sourceVideoUrl,
    frontalImageUrl: identity.frontalImageUrl,
    referenceImageUrls: identity.referenceImageUrls,
    duration,
    keepAudio: input.keepAudio,
    characterName: identity.characterName,
    extraPromptTail: input.extraPromptTail,
  });

  // Persist a PENDING row FIRST — before hitting FAL. If the webhook races
  // in ahead of the returned request_id we still have a job to look up (the
  // webhook route falls back to matching by tail-created row when needed).
  const initialMeta: RemixJobMeta = {
    v: 2,
    engine,
    orientation,
    attemptIndex: 0,
    attempts: [],
  };
  const job = await db.remixJob.create({
    data: {
      userId: input.userId,
      influencerId: input.influencerId,
      tier: input.tier,
      durationSec: duration,
      sourceDurationSec: input.sourceDurationSec ?? null,
      sourceVideoUrl,
      frontalImageUrl: identity.frontalImageUrl,
      referenceImageUrls: identity.referenceImageUrls,
      keepAudio: input.keepAudio,
      prompt: firstPrompt,
      creditsHeld: cost,
      status: "PENDING",
      falRequestId: null,
      falModel: attempts[0].modelId,
      metadata: remixMetaJson(initialMeta),
      oembedPreview:
        input.oembedPreview && typeof input.oembedPreview === "object"
          ? (input.oembedPreview as object)
          : undefined,
    },
  });

  // Hold credits AFTER the row exists so a refund path always has a job to
  // update. `deductCredits` throws on insufficient balance.
  try {
    await deductCredits(input.userId, cost);
  } catch (err) {
    await db.remixJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  try {
    const webhookUrl = buildRemixWebhookUrl(job.id);
    if (!webhookUrl) {
      logFalVideoSubmit({
        engine: "remix",
        jobId: job.id,
        webhookConfigured: false,
      });
      await failRemixJob(job.id, MISSING_REMIX_WEBHOOK_SECRET);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de lancer le remix. Les crédits ont été remboursés.",
      });
    }

    const submitted = await submitRemixAttemptsUntilAccepted({
      jobId: job.id,
      attempts,
      startIndex: 0,
      priorRecords: [],
      webhookUrl,
      videoUrl: sourceVideoUrl,
      frontalImageUrl: identity.frontalImageUrl,
      referenceImageUrls: identity.referenceImageUrls,
      duration,
      keepAudio: input.keepAudio,
      characterName: identity.characterName,
      extraPromptTail: input.extraPromptTail,
      tier: input.tier,
      engine,
      orientation,
    });

    if (!submitted.ok) {
      await failRemixJob(job.id, submitted.userError);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: submitted.userError,
      });
    }

    logFalVideoSubmit({
      engine: "remix",
      jobId: job.id,
      webhookConfigured: true,
      falRequestId: submitted.result.requestId,
      modelId: submitted.result.modelId,
    });

    await db.remixJob.update({
      where: { id: job.id },
      data: {
        status: "IN_PROGRESS",
        falRequestId: submitted.result.requestId,
        falModel: submitted.result.modelId,
        prompt: submitted.result.prompt,
        metadata: remixMetaJson(submitted.meta),
      },
    });

    return {
      jobId: job.id,
      cost,
      duration,
      status: "IN_PROGRESS",
    };
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    const errMsg = err instanceof Error ? err.message : String(err);
    const persisted = `Submit failed: ${errMsg}`.slice(0, 500);
    await failRemixJob(job.id, persisted);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: formatGenerationErrorForUser(persisted),
    });
  }
}

// ──────────────────────────────────────────────
// Submit + content_policy fallback
// ──────────────────────────────────────────────

function previewRemixAttemptPrompt(input: {
  attempt: RemixAttempt;
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls?: readonly string[];
  duration: RemixDuration;
  keepAudio: boolean;
  characterName?: string | null;
  extraPromptTail?: string | null;
}): string {
  switch (input.attempt.kind) {
    case "motion_control":
      return buildMotionControlPrompt({
        orientation: input.attempt.orientation,
        characterName: input.characterName,
        extra: input.extraPromptTail,
      });
    case "viggle":
      return "Viggle video remix (character + motion)";
    case "wan_replace":
      return "Replace the person in the video with the character image.";
    case "o1_v2v_edit":
      return REMIX_O1_EDIT_PROMPT;
    case "kling_o3_v2v":
      return buildFalKlingO3RemixPayload({
        videoUrl: input.videoUrl,
        frontalImageUrl: input.frontalImageUrl,
        referenceImageUrls: input.referenceImageUrls,
        duration: input.duration,
        keepAudio: input.keepAudio,
        characterName: input.characterName,
        extraPromptTail: input.extraPromptTail,
      }).prompt;
    default: {
      const _never: never = input.attempt;
      throw new Error(`Unhandled remix attempt: ${String(_never)}`);
    }
  }
}

async function submitOneRemixAttempt(input: {
  attempt: RemixAttempt;
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls: readonly string[];
  duration: RemixDuration;
  keepAudio: boolean;
  characterName: string;
  extraPromptTail?: string | null;
  tier: RemixTier;
  webhookUrl: string;
}): Promise<FalRemixSubmitResult> {
  switch (input.attempt.kind) {
    case "motion_control":
      return submitFalKlingMotionControlRemix({
        modelId: input.attempt.modelId,
        videoUrl: input.videoUrl,
        frontalImageUrl: input.frontalImageUrl,
        referenceImageUrls: input.referenceImageUrls,
        orientation: input.attempt.orientation,
        keepAudio: input.keepAudio,
        characterName: input.characterName,
        extraPromptTail: input.extraPromptTail,
        includeFaceElement: input.attempt.includeFaceElement,
        webhookUrl: input.webhookUrl,
      });
    case "viggle":
      return submitViggleRemix({
        videoUrl: input.videoUrl,
        frontalImageUrl: input.frontalImageUrl,
      });
    case "wan_replace":
      return submitFalWanReplaceRemix({
        modelId: input.attempt.modelId,
        videoUrl: input.videoUrl,
        frontalImageUrl: input.frontalImageUrl,
        webhookUrl: input.webhookUrl,
      });
    case "o1_v2v_edit":
      return submitFalKlingO1V2vEdit({
        modelId: input.attempt.modelId,
        videoUrl: input.videoUrl,
        frontalImageUrl: input.frontalImageUrl,
        referenceImageUrls: input.referenceImageUrls,
        keepAudio: input.keepAudio,
        webhookUrl: input.webhookUrl,
      });
    case "kling_o3_v2v":
      return submitFalKlingO3Remix({
        tier: input.tier,
        videoUrl: input.videoUrl,
        frontalImageUrl: input.frontalImageUrl,
        referenceImageUrls: input.referenceImageUrls,
        duration: input.duration,
        keepAudio: input.keepAudio,
        characterName: input.characterName,
        extraPromptTail: input.extraPromptTail,
        webhookUrl: input.webhookUrl,
      });
    default: {
      const _never: never = input.attempt;
      throw new Error(`Unhandled remix attempt: ${String(_never)}`);
    }
  }
}

export async function submitRemixAttemptsUntilAccepted(input: {
  jobId: string;
  attempts: RemixAttempt[];
  startIndex: number;
  priorRecords: RemixAttemptRecord[];
  webhookUrl: string;
  videoUrl: string;
  frontalImageUrl: string;
  referenceImageUrls: readonly string[];
  duration: RemixDuration;
  keepAudio: boolean;
  characterName: string;
  extraPromptTail?: string | null;
  tier: RemixTier;
  engine: RemixEngine;
  orientation: RemixOrientation;
}): Promise<
  | { ok: true; result: FalRemixSubmitResult; meta: RemixJobMeta }
  | { ok: false; userError: string; meta: RemixJobMeta }
> {
  const records = [...input.priorRecords];

  for (let i = input.startIndex; i < input.attempts.length; i++) {
    const attempt = input.attempts[i];
    try {
      const result = await submitOneRemixAttempt({
        attempt,
        videoUrl: input.videoUrl,
        frontalImageUrl: input.frontalImageUrl,
        referenceImageUrls: input.referenceImageUrls,
        duration: input.duration,
        keepAudio: input.keepAudio,
        characterName: input.characterName,
        extraPromptTail: input.extraPromptTail,
        tier: input.tier,
        webhookUrl: input.webhookUrl,
      });
      records.push({
        kind: attempt.kind,
        engine: attempt.engine,
        orientation: attempt.kind === "motion_control" ? attempt.orientation : undefined,
        modelId: result.modelId,
        falRequestId: result.requestId,
      });
      return {
        ok: true,
        result,
        meta: {
          v: 2,
          engine: input.engine,
          orientation: input.orientation,
          attemptIndex: i,
          attempts: records,
        },
      };
    } catch (err) {
      const errorClass = classifyRemixProviderError(err);
      const detail = err instanceof Error ? err.message : String(err);
      logRemixProviderError({
        jobId: input.jobId,
        engine: attempt.engine,
        errorClass,
        modelId: attempt.modelId,
        orientation: attempt.kind === "motion_control" ? attempt.orientation : null,
        detail,
      });
      records.push({
        kind: attempt.kind,
        engine: attempt.engine,
        orientation: attempt.kind === "motion_control" ? attempt.orientation : undefined,
        modelId: attempt.modelId,
        errorClass,
        error: detail.slice(0, 280),
      });
      if (errorClass === "content_policy") {
        continue;
      }
      return {
        ok: false,
        userError: formatGenerationErrorForUser(`Submit failed: ${detail}`),
        meta: {
          v: 2,
          engine: input.engine,
          orientation: input.orientation,
          attemptIndex: i,
          attempts: records,
        },
      };
    }
  }

  return {
    ok: false,
    userError: REMIX_CONTENT_POLICY_USER_MESSAGE,
    meta: {
      v: 2,
      engine: input.engine,
      orientation: input.orientation,
      attemptIndex: Math.max(0, input.attempts.length - 1),
      attempts: records,
    },
  };
}

export function parseRemixJobMeta(raw: unknown): RemixJobMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 2) return null;
  if (!isRemixEngine(rec.engine)) return null;
  if (rec.orientation !== "video" && rec.orientation !== "image") return null;
  return {
    v: 2,
    engine: rec.engine,
    orientation: rec.orientation,
    attemptIndex: typeof rec.attemptIndex === "number" ? rec.attemptIndex : 0,
    attempts: Array.isArray(rec.attempts)
      ? (rec.attempts as RemixAttemptRecord[])
      : [],
  };
}

/**
 * Webhook / reconcile failure: retry remaining engines on content_policy,
 * otherwise refund. Never silent — every branch logs engine + error class.
 */
export async function handleRemixProviderFailure(
  jobId: string,
  error: string,
  webhookRequestId?: string | null
): Promise<"fallback" | "refunded" | "ignored"> {
  const job = await db.remixJob.findUnique({ where: { id: jobId } });
  if (!job) return "ignored";
  if (job.status === "COMPLETED" || job.status === "REFUNDED") return "ignored";

  if (
    webhookRequestId &&
    job.falRequestId &&
    webhookRequestId !== job.falRequestId
  ) {
    console.warn("[remix] ignoring stale provider failure", {
      jobId,
      webhookRequestId,
      currentFalRequestId: job.falRequestId,
    });
    return "ignored";
  }

  const errorClass = classifyRemixProviderError(error);
  logRemixProviderError({
    jobId,
    engine: job.falModel,
    falRequestId: job.falRequestId,
    errorClass,
    modelId: job.falModel,
    detail: error,
  });

  if (errorClass !== "content_policy") {
    await failRemixJob(jobId, error);
    return "refunded";
  }

  const meta = parseRemixJobMeta(job.metadata);
  const orientation = meta?.orientation ?? "video";
  const engine = meta?.engine ?? getRemixEngine();
  const clipDurationSec = job.sourceDurationSec ?? job.durationSec;
  const attempts = planRemixAttempts({
    engine,
    orientation,
    clipDurationSec,
    tier: job.tier as RemixTier,
  });
  const startIndex = (meta?.attemptIndex ?? 0) + 1;
  if (startIndex >= attempts.length) {
    await failRemixJob(jobId, REMIX_CONTENT_POLICY_USER_MESSAGE);
    return "refunded";
  }

  const webhookUrl = buildRemixWebhookUrl(job.id);
  if (!webhookUrl) {
    await failRemixJob(jobId, MISSING_REMIX_WEBHOOK_SECRET);
    return "refunded";
  }

  const lockToken = `fallback-pending:${job.id}:${startIndex}`;
  const locked = await db.remixJob.updateMany({
    where: {
      id: job.id,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      falRequestId: job.falRequestId,
    },
    data: { falRequestId: lockToken },
  });
  if (locked.count !== 1) return "ignored";

  const submitted = await submitRemixAttemptsUntilAccepted({
    jobId: job.id,
    attempts,
    startIndex,
    priorRecords: [
      ...(meta?.attempts ?? []),
      {
        kind: attempts[meta?.attemptIndex ?? 0]?.kind ?? "motion_control",
        engine: job.falModel,
        modelId: job.falModel,
        falRequestId: webhookRequestId ?? job.falRequestId ?? undefined,
        errorClass: "content_policy",
        error: error.slice(0, 280),
      },
    ],
    webhookUrl,
    videoUrl: job.sourceVideoUrl,
    frontalImageUrl: job.frontalImageUrl,
    referenceImageUrls: job.referenceImageUrls,
    duration: job.durationSec as RemixDuration,
    keepAudio: job.keepAudio,
    characterName: "",
    extraPromptTail: null,
    tier: job.tier as RemixTier,
    engine,
    orientation,
  });

  if (!submitted.ok) {
    await failRemixJob(job.id, submitted.userError);
    return "refunded";
  }

  await db.remixJob.update({
    where: { id: job.id },
    data: {
      status: "IN_PROGRESS",
      falRequestId: submitted.result.requestId,
      falModel: submitted.result.modelId,
      prompt: submitted.result.prompt,
      metadata: remixMetaJson(submitted.meta),
      error: null,
    },
  });
  return "fallback";
}


/**
 * Signed webhook URL — we use a per-app secret in the path segment plus
 * the job id so:
 *   - FAL cannot spoof completions on behalf of another job (secret guard);
 *   - a mistyped/leaked URL doesn't reveal any user data.
 */
export function buildRemixWebhookUrl(jobId: string): string | undefined {
  const secret = process.env.REMIX_WEBHOOK_SECRET?.trim();
  if (!secret) return undefined;
  return `${getAppUrl()}/api/webhooks/fal-remix?job=${encodeURIComponent(
    jobId
  )}&secret=${encodeURIComponent(secret)}`;
}

export function verifyRemixWebhookSecret(candidate: string | null): boolean {
  const expected = process.env.REMIX_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  if (!candidate) return false;
  return expected === candidate.trim();
}

/**
 * Called by the FAL webhook (or by a recovery poll) once the render has
 * completed. Persists the output MP4 on our R2 and emits REMIX_COMPLETED.
 * Idempotent — a duplicate webhook won't double-charge or re-upload.
 */
export async function finalizeRemixJob(
  jobId: string,
  opts: { videoUrl: string; rawPayload?: unknown }
): Promise<void> {
  const job = await db.remixJob.findUnique({ where: { id: jobId } });
  if (!job) {
    console.warn(`[remix] finalizeRemixJob: job ${jobId} not found`);
    return;
  }
  if (job.status === "COMPLETED" && job.outputVideoUrl) {
    console.log(`[remix] finalizeRemixJob: ${jobId} already COMPLETED`);
    return;
  }

  const filename = `remix-${job.influencerId}-${nanoid(6)}.mp4`;
  let stored: string;
  try {
    stored = await uploadFromUrl(opts.videoUrl, filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[remix] finalizeRemixJob upload failed for ${jobId}:`, msg);
    await failRemixJob(jobId, `Storage upload failed: ${msg.slice(0, 180)}`);
    return;
  }

  const existingMeta = parseRemixJobMeta(job.metadata);
  await db.remixJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      outputVideoUrl: stored,
      completedAt: new Date(),
      metadata: {
        ...(existingMeta ?? {}),
        falOutput:
          opts.rawPayload && typeof opts.rawPayload === "object"
            ? opts.rawPayload
            : undefined,
      } as object,
    },
  });

  await emitEvent(job.userId, "REMIX_COMPLETED", {
    jobId: job.id,
    influencerId: job.influencerId,
    tier: job.tier,
    durationSec: job.durationSec,
    videoUrl: stored,
    creditsCharged: job.creditsHeld,
  });
}

/**
 * Failure path — claim the open row first, then refund. Cron + poll +
 * webhook can race; `updateMany` on PENDING|IN_PROGRESS → REFUNDED is the
 * single winner. `refundCredits` runs only when count === 1 so we never
 * double-refund or refund a COMPLETED job.
 */
export async function failRemixJob(
  jobId: string,
  error: string
): Promise<void> {
  const job = await db.remixJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const claimed = await db.remixJob.updateMany({
    where: {
      id: jobId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    data: {
      status: "REFUNDED",
      error: error.slice(0, 500),
      completedAt: new Date(),
    },
  });
  if (claimed.count !== 1) return;

  await refundCredits(job.userId, job.creditsHeld);

  await emitEvent(job.userId, "REMIX_FAILED", {
    jobId: job.id,
    influencerId: job.influencerId,
    tier: job.tier,
    durationSec: job.durationSec,
    error: error.slice(0, 500),
    creditsRefunded: job.creditsHeld,
  });
}

async function checkRemixProviderQueue(
  modelId: string,
  requestId: string
): Promise<FalRemixCheckResult> {
  if (isViggleRemixModelId(modelId)) {
    return checkViggleRemix(requestId);
  }
  return checkFalRemixQueue(modelId, requestId);
}

/**
 * Recovery: if the webhook was missed we can be nudged by a status query
 * from the client and re-poll FAL / Viggle to move the job forward.
 */
export async function reconcileRemixJob(jobId: string): Promise<void> {
  const job = await db.remixJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "COMPLETED" || job.status === "REFUNDED") return;
  if (!job.falRequestId) return;
  if (job.falRequestId.startsWith("fallback-pending:")) return;

  try {
    const check = await checkRemixProviderQueue(job.falModel, job.falRequestId);
    switch (check.state) {
      case "COMPLETED": {
        await finalizeRemixJob(job.id, {
          videoUrl: check.videoUrl,
          rawPayload: check.raw,
        });
        return;
      }
      case "FAILED": {
        await handleRemixProviderFailure(job.id, check.error, job.falRequestId);
        return;
      }
      case "IN_QUEUE":
      case "IN_PROGRESS": {
        return;
      }
      default: {
        const _never: never = check;
        throw new Error(`Unhandled Remix check state: ${String(_never)}`);
      }
    }
  } catch (err) {
    console.warn(
      `[remix] reconcileRemixJob failed for ${jobId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
