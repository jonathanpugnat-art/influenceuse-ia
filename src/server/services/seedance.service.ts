/**
 * Seedance scene-video V1 service.
 *
 * Pattern mirrors `remix.service.ts` / `talking-head.service.ts`:
 *   1. Resolve identity pack (frontal + up to 3 alt angles).
 *   2. Estimate cost (resolution × durationSec) and check credits.
 *   3. Persist SeedanceJob row PENDING (before hitting FAL — the webhook
 *      can race in ahead of the returned request_id).
 *   4. Hold credits (`deductCredits`; refunded via `refundCredits` on
 *      failure).
 *   5. V1 canary: plan image-to-video with the frontal still only
 *      (Fal r2v 422s photoreal packs). No auto-retry on 422.
 *   6. Require a signed webhook URL (fail-closed if
 *      SEEDANCE_WEBHOOK_SECRET is missing — never submit to Fal
 *      without a callback).
 *   7. Submit to fal queue, log host + modelId + mode + refCount
 *      + falRequestId (no secrets).
 *   8. Move row to IN_PROGRESS + persist request_id.
 *
 * The webhook (or poll-on-read) then finalises to COMPLETED | FAILED |
 * REFUNDED. All state transitions are idempotent.
 *
 * If no webhook arrives within 20 min (`STALE_VIDEO_JOB_MS` in
 * stale-video-job.service), the sweeper calls `failSeedanceJob` so the
 * hold is refunded and the UI stops spinning.
 */

import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { getAppUrl } from "@/lib/app-url";
import { formatGenerationErrorForUser } from "@/lib/generation-errors";
import { parseIdentityPack } from "@/lib/identity-pack";
import {
  clampSeedanceDuration,
  clampSeedanceResolution,
  estimateSeedanceCredits,
  planSeedanceSubmit,
  validateSeedanceRequest,
  type SeedanceDuration,
  type SeedanceMode,
  type SeedanceResolution,
} from "@/lib/seedance-config";
import {
  checkCredits,
  deductCredits,
  refundCredits,
} from "@/server/services/credits.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import {
  buildFalSeedancePayload,
  checkFalSeedance,
  submitFalSeedance,
} from "@/server/services/video-providers/fal-seedance.provider";
import { checkFalKlingO3I2v } from "@/server/services/video-providers/fal-kling-o3-i2v.provider";
import { isKlingSceneModelId } from "@/lib/scene-engine";
import { uploadFromUrl } from "@/server/services/storage.service";
import { emitEvent } from "@/server/services/webhook.service";
import {
  logFalVideoSubmit,
  MISSING_SEEDANCE_WEBHOOK_SECRET,
} from "@/server/services/fal-video-webhook";
import type { SeedanceJob } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateSeedanceInput {
  userId: string;
  influencerId: string;
  scenePrompt: string;
  extraPromptTail?: string | null;
  requestedDuration: number;
  requestedResolution: string;
  generateAudio: boolean;
}

export interface CreateSeedanceResult {
  jobId: string;
  cost: number;
  durationSec: SeedanceDuration;
  resolution: SeedanceResolution;
  mode: SeedanceMode;
  status: SeedanceJob["status"];
}

interface ResolvedSeedanceIdentity {
  referenceImageUrls: string[];
  characterName: string;
}

// ──────────────────────────────────────────────
// Identity resolution
// ──────────────────────────────────────────────

/**
 * Assemble the identity pack passed as Seedance `image_urls`. Frontal is
 * mandatory (wizard base portrait); alt angles come from the identity
 * pack when ready. We cap at SEEDANCE_MAX_REFERENCES (4) — more refs
 * would dilute the character embedding without improving lock.
 */
async function resolveInfluencerIdentity(
  influencerId: string,
  userId: string
): Promise<ResolvedSeedanceIdentity> {
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
        "Ce personnage n'a pas encore de portrait de référence. Termine l'assistant de création avant de lancer une scène.",
    });
  }

  const refs: string[] = [frontal];
  const packRefs =
    pack && pack.status === "ready"
      ? pack.shots
          .filter((s) => s.id !== "portrait_front")
          .map((s) => s.url)
      : [];
  for (const raw of packRefs) {
    if (refs.length >= 4) break;
    const resolved = await resolvePublicMediaUrl(raw);
    if (resolved && !refs.includes(resolved)) {
      refs.push(resolved);
    }
  }

  return {
    referenceImageUrls: refs,
    characterName: influencer.name,
  };
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export async function createSeedanceJob(
  input: CreateSeedanceInput
): Promise<CreateSeedanceResult> {
  const identity = await resolveInfluencerIdentity(
    input.influencerId,
    input.userId
  );

  const duration = clampSeedanceDuration(input.requestedDuration);
  const resolution = clampSeedanceResolution(input.requestedResolution);
  const cost = estimateSeedanceCredits(resolution, duration);
  // V1 canary: frontal-only image-to-video. Do not auto-retry r2v 422s —
  // fail cleanly and let the user retry (credits held once).
  const plan = planSeedanceSubmit(identity.referenceImageUrls);

  const validation = validateSeedanceRequest({
    scenePrompt: input.scenePrompt,
    referenceImageUrls: plan.imageUrls.length
      ? plan.imageUrls
      : identity.referenceImageUrls,
    duration,
    resolution,
  });
  if (validation) {
    throw new TRPCError({ code: "BAD_REQUEST", message: validation.message });
  }

  const hasCredits = await checkCredits(input.userId, cost);
  if (!hasCredits) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Crédits insuffisants. Cette scène coûte ${cost} crédits.`,
    });
  }

  const built = buildFalSeedancePayload({
    referenceImageUrls: plan.imageUrls,
    duration,
    resolution,
    generateAudio: input.generateAudio,
    characterName: identity.characterName,
    scenePrompt: input.scenePrompt,
    extraPromptTail: input.extraPromptTail,
    mode: plan.mode,
  });

  // Persist a PENDING row FIRST — before hitting FAL. If the webhook races
  // in ahead of the returned request_id we still have a job to look up
  // (falls back to the reconcile path if request_id is not yet stored).
  const job = await db.seedanceJob.create({
    data: {
      userId: input.userId,
      influencerId: input.influencerId,
      mode:
        built.mode === "reference_to_video"
          ? "REFERENCE_TO_VIDEO"
          : "IMAGE_TO_VIDEO",
      durationSec: duration,
      resolution,
      aspectRatio: "9:16",
      generateAudio: input.generateAudio,
      prompt: built.prompt,
      extraPromptTail: input.extraPromptTail ?? null,
      referenceImageUrls: plan.imageUrls,
      creditsHeld: cost,
      status: "PENDING",
      falRequestId: null,
      falModel: built.modelId,
    },
  });

  // Hold credits AFTER the row exists so a refund path always has a job
  // to update. `deductCredits` throws on insufficient balance.
  try {
    await deductCredits(input.userId, cost);
  } catch (err) {
    await db.seedanceJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  try {
    const webhookUrl = buildSeedanceWebhookUrl(job.id);
    if (!webhookUrl) {
      logFalVideoSubmit({
        engine: "seedance",
        jobId: job.id,
        webhookConfigured: false,
      });
      await failSeedanceJob(job.id, MISSING_SEEDANCE_WEBHOOK_SECRET);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de lancer la scène Seedance. Les crédits ont été remboursés.",
      });
    }

    const submitted = await submitFalSeedance({
      referenceImageUrls: plan.imageUrls,
      duration,
      resolution,
      generateAudio: input.generateAudio,
      characterName: identity.characterName,
      scenePrompt: input.scenePrompt,
      extraPromptTail: input.extraPromptTail,
      mode: built.mode,
      webhookUrl,
    });

    logFalVideoSubmit({
      engine: "seedance",
      jobId: job.id,
      webhookConfigured: true,
      falRequestId: submitted.requestId,
      modelId: submitted.modelId,
      mode: submitted.mode,
      refCount: plan.imageUrls.length,
    });

    await db.seedanceJob.update({
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
      durationSec: duration,
      resolution,
      mode: built.mode,
      status: "IN_PROGRESS",
    };
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    const errMsg = err instanceof Error ? err.message : String(err);
    const persisted = `Submit failed: ${errMsg}`.slice(0, 500);
    await failSeedanceJob(job.id, persisted);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: formatGenerationErrorForUser(persisted),
    });
  }
}

// ──────────────────────────────────────────────
// Webhook / finalise
// ──────────────────────────────────────────────

/**
 * Signed webhook URL — same pattern as remix. Per-app secret in the
 * query string plus the job id so:
 *   - FAL cannot spoof completions on behalf of another job;
 *   - a mistyped/leaked URL doesn't reveal any user data.
 */
export function buildSeedanceWebhookUrl(jobId: string): string | undefined {
  const secret = process.env.SEEDANCE_WEBHOOK_SECRET?.trim();
  if (!secret) return undefined;
  return `${getAppUrl()}/api/webhooks/fal-seedance?job=${encodeURIComponent(
    jobId
  )}&secret=${encodeURIComponent(secret)}`;
}

export function verifySeedanceWebhookSecret(
  candidate: string | null
): boolean {
  const expected = process.env.SEEDANCE_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  if (!candidate) return false;
  return expected === candidate.trim();
}

/**
 * Called by the FAL webhook (or by the reconcile path) once the render
 * completes. Persists the output MP4 on our R2 and emits SCENE_COMPLETED.
 * Idempotent — a duplicate delivery won't double-charge or re-upload.
 */
export async function finalizeSeedanceJob(
  jobId: string,
  opts: { videoUrl: string; rawPayload?: unknown }
): Promise<void> {
  const job = await db.seedanceJob.findUnique({ where: { id: jobId } });
  if (!job) {
    console.warn(`[seedance] finalizeSeedanceJob: job ${jobId} not found`);
    return;
  }
  if (job.status === "COMPLETED" && job.outputVideoUrl) {
    return;
  }

  const filename = `seedance-${job.influencerId}-${nanoid(6)}.mp4`;
  let stored: string;
  try {
    stored = await uploadFromUrl(opts.videoUrl, filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[seedance] finalizeSeedanceJob upload failed for ${jobId}:`,
      msg
    );
    await failSeedanceJob(jobId, `Storage upload failed: ${msg.slice(0, 180)}`);
    return;
  }

  await db.seedanceJob.update({
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

  await emitEvent(job.userId, "SCENE_COMPLETED", {
    jobId: job.id,
    influencerId: job.influencerId,
    durationSec: job.durationSec,
    resolution: job.resolution,
    mode: job.mode,
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
export async function failSeedanceJob(
  jobId: string,
  error: string
): Promise<void> {
  const job = await db.seedanceJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const claimed = await db.seedanceJob.updateMany({
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

  await emitEvent(job.userId, "SCENE_FAILED", {
    jobId: job.id,
    influencerId: job.influencerId,
    durationSec: job.durationSec,
    resolution: job.resolution,
    mode: job.mode,
    error: error.slice(0, 500),
    creditsRefunded: job.creditsHeld,
  });
}

/**
 * Recovery: if the webhook was missed, a status query from the client
 * can nudge FAL and move the job forward.
 */
export async function reconcileSeedanceJob(jobId: string): Promise<void> {
  const job = await db.seedanceJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "COMPLETED" || job.status === "REFUNDED") return;
  if (!job.falRequestId) return;

  try {
    const check = isKlingSceneModelId(job.falModel)
      ? await checkFalKlingO3I2v(job.falModel, job.falRequestId)
      : await checkFalSeedance(job.falModel, job.falRequestId);
    switch (check.state) {
      case "COMPLETED": {
        await finalizeSeedanceJob(job.id, {
          videoUrl: check.videoUrl,
          rawPayload: check.raw,
        });
        return;
      }
      case "FAILED": {
        await failSeedanceJob(job.id, check.error);
        return;
      }
      case "IN_QUEUE":
      case "IN_PROGRESS": {
        return;
      }
      default: {
        const _never: never = check;
        throw new Error(`Unhandled Seedance check state: ${String(_never)}`);
      }
    }
  } catch (err) {
    console.warn(
      `[seedance] reconcileSeedanceJob failed for ${jobId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
