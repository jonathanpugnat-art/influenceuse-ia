import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { getAppUrl } from "@/lib/app-url";
import { parseIdentityPack } from "@/lib/identity-pack";
import {
  clampRemixDuration,
  estimateRemixCreditsForTier,
  resolveRemixModelId,
  type RemixDuration,
  type RemixTier,
} from "@/lib/remix-config";
import {
  checkCredits,
  deductCredits,
  refundCredits,
} from "@/server/services/credits.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import {
  buildFalKlingO3RemixPayload,
  checkFalKlingO3Remix,
  submitFalKlingO3Remix,
} from "@/server/services/video-providers/fal-kling-o3-remix.provider";
import { uploadFromUrl } from "@/server/services/storage.service";
import { emitEvent } from "@/server/services/webhook.service";
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
  extraPromptTail?: string | null;
  oembedPreview?: unknown;
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
 *   2. Clamp duration to source (max 15s, PRD).
 *   3. Hold credits (deductCredits — refunded on FAIL).
 *   4. Submit to FAL queue with our webhook URL.
 *   5. Persist RemixJob so the webhook can find it by request_id.
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

  const duration = clampRemixDuration(
    input.requestedDuration,
    input.sourceDurationSec ?? null
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

  // Build & validate the FAL payload BEFORE we hold credits so a bad
  // input never bills the user.
  const { prompt } = buildFalKlingO3RemixPayload({
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
      prompt,
      creditsHeld: cost,
      status: "PENDING",
      falRequestId: null,
      falModel: resolveRemixModelId(input.tier),
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
    const submitted = await submitFalKlingO3Remix({
      tier: input.tier,
      videoUrl: sourceVideoUrl,
      frontalImageUrl: identity.frontalImageUrl,
      referenceImageUrls: identity.referenceImageUrls,
      duration,
      keepAudio: input.keepAudio,
      characterName: identity.characterName,
      extraPromptTail: input.extraPromptTail,
      webhookUrl: buildRemixWebhookUrl(job.id),
    });

    await db.remixJob.update({
      where: { id: job.id },
      data: {
        status: "IN_PROGRESS",
        falRequestId: submitted.requestId,
        falModel: submitted.modelId,
      },
    });

    return {
      jobId: job.id,
      cost,
      duration,
      status: "IN_PROGRESS",
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await failRemixJob(job.id, `Submit failed: ${errMsg.slice(0, 200)}`);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Impossible de lancer le remix. Les crédits ont été remboursés.",
    });
  }
}

// ──────────────────────────────────────────────
// Webhook / finalize
// ──────────────────────────────────────────────

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

  await db.remixJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      outputVideoUrl: stored,
      completedAt: new Date(),
      metadata:
        opts.rawPayload && typeof opts.rawPayload === "object"
          ? (opts.rawPayload as object)
          : job.metadata ?? undefined,
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

/**
 * Recovery: if the webhook was missed we can be nudged by a status query
 * from the client and re-poll FAL to move the job forward.
 */
export async function reconcileRemixJob(jobId: string): Promise<void> {
  const job = await db.remixJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "COMPLETED" || job.status === "REFUNDED") return;
  if (!job.falRequestId) return;

  try {
    const check = await checkFalKlingO3Remix(job.falModel, job.falRequestId);
    if (check.state === "COMPLETED") {
      await finalizeRemixJob(job.id, {
        videoUrl: check.videoUrl,
        rawPayload: check.raw,
      });
    } else if (check.state === "FAILED") {
      await failRemixJob(job.id, check.error);
    }
  } catch (err) {
    console.warn(
      `[remix] reconcileRemixJob failed for ${jobId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
