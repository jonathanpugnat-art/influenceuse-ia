/**
 * NSFW Pro V1 — WaveSpeed Wan 2.2 Spicy orchestration.
 *
 * Pattern mirrors `seedance.service.ts`:
 *   1. Gate: flag + Pro NSFW plan + API key + character isNsfw + consent.
 *   2. Resolve the locked character still (never a client-supplied image).
 *   3. Policy-scan the prompt (CSAM / NCII / real-person).
 *   4. Persist PENDING, then hold credits (`deductCredits`).
 *   5. Submit to WaveSpeed; store prediction id; IN_PROGRESS.
 *   6. Poll-on-read + stale sweeper finalise COMPLETED | REFUNDED.
 *
 * Fail-closed: flag off is unreachable; flag on without key refuses
 * before any hold. SFW Free/Creator never enter this file from the
 * reel/scene cascade.
 */

import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { getAppUrl } from "@/lib/app-url";
import {
  AuraContentPolicyError,
  assertAuraNsfwVideoPromptAllowed,
} from "@/lib/content-safety/aura-content-policy";
import { parseIdentityPack } from "@/lib/identity-pack";
import {
  clampWavespeedSpicyDuration,
  clampWavespeedSpicyResolution,
  estimateWavespeedSpicyCredits,
  evaluateWavespeedSpicyGate,
  isWavespeedApiConfigured,
  isWavespeedSpicyReachable,
  NSFW_ENGINE_UNREACHABLE_MESSAGE,
  NSFW_PLAN_REQUIRED_MESSAGE,
  resolveWavespeedSpicyModelId,
  trpcCodeForWavespeedGate,
  validateWavespeedSpicyRequest,
  WAVESPEED_MISSING_KEY_MESSAGE,
  WAVESPEED_SUBMIT_FAILED_MESSAGE,
  type WavespeedSpicyDuration,
  type WavespeedSpicyResolution,
} from "@/lib/wavespeed-spicy-config";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";
import {
  checkCredits,
  deductCredits,
  refundCredits,
} from "@/server/services/credits.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import { uploadFromUrl } from "@/server/services/storage.service";
import { emitEvent } from "@/server/services/webhook.service";
import {
  checkWavespeedSpicy,
  submitWavespeedSpicy,
} from "@/server/services/video-providers/wavespeed-spicy.provider";

export interface CreateWavespeedSpicyInput {
  userId: string;
  plan: Plan;
  influencerId: string;
  prompt: string;
  requestedDuration: number;
  requestedResolution: string;
  consentAccepted: boolean;
}

export interface CreateWavespeedSpicyResult {
  jobId: string;
  cost: number;
  durationSec: WavespeedSpicyDuration;
  resolution: WavespeedSpicyResolution;
  status: "PENDING" | "IN_PROGRESS";
  isSynthetic: true;
}

async function resolveCharacterStill(
  influencerId: string,
  userId: string
): Promise<{
  imageUrl: string;
  isNsfw: boolean;
  age: number;
}> {
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId },
    select: {
      id: true,
      age: true,
      isNsfw: true,
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
  const candidates: Array<string | null | undefined> = [
    pack?.shots.find((s) => s.id === "portrait_front")?.url,
    influencer.baseImageUrl,
    influencer.avatarUrl,
  ];
  let imageUrl: string | undefined;
  for (const candidate of candidates) {
    const resolved = await resolvePublicMediaUrl(candidate);
    if (resolved) {
      imageUrl = resolved;
      break;
    }
  }
  if (!imageUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Ce personnage n'a pas encore de portrait de référence. Termine l'assistant de création avant de générer.",
    });
  }

  return {
    imageUrl,
    isNsfw: influencer.isNsfw,
    age: influencer.age,
  };
}

export async function createWavespeedSpicyJob(
  input: CreateWavespeedSpicyInput
): Promise<CreateWavespeedSpicyResult> {
  const planConfig = PLANS[input.plan];
  if (!isWavespeedSpicyReachable()) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: NSFW_ENGINE_UNREACHABLE_MESSAGE,
    });
  }
  if (!planConfig.hasNsfw) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: NSFW_PLAN_REQUIRED_MESSAGE,
    });
  }
  if (!isWavespeedApiConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: WAVESPEED_MISSING_KEY_MESSAGE,
    });
  }

  const identity = await resolveCharacterStill(
    input.influencerId,
    input.userId
  );

  const gate = evaluateWavespeedSpicyGate({
    planHasNsfw: planConfig.hasNsfw,
    influencerIsNsfw: identity.isNsfw,
    consentAccepted: input.consentAccepted,
    influencerAge: identity.age,
  });
  if (!gate.ok) {
    throw new TRPCError({
      code: trpcCodeForWavespeedGate(gate.code),
      message: gate.message,
    });
  }

  try {
    assertAuraNsfwVideoPromptAllowed(input.prompt);
  } catch (err) {
    if (err instanceof AuraContentPolicyError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err.message,
      });
    }
    throw err;
  }

  const duration = clampWavespeedSpicyDuration(input.requestedDuration);
  const resolution = clampWavespeedSpicyResolution(input.requestedResolution);
  const cost = estimateWavespeedSpicyCredits(resolution, duration);

  const validation = validateWavespeedSpicyRequest({
    prompt: input.prompt,
    imageUrl: identity.imageUrl,
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
      message: `Crédits insuffisants. Cette génération adulte coûte ${cost} crédits.`,
    });
  }

  const consentAcceptedAt = new Date();
  const modelId = resolveWavespeedSpicyModelId();

  const job = await db.wavespeedSpicyJob.create({
    data: {
      userId: input.userId,
      influencerId: input.influencerId,
      durationSec: duration,
      resolution,
      aspectRatio: "9:16",
      prompt: input.prompt.trim(),
      imageUrl: identity.imageUrl,
      creditsHeld: cost,
      status: "PENDING",
      wavespeedModel: modelId,
      isSynthetic: true,
      consentAcceptedAt,
    },
  });

  await db.influencer.update({
    where: { id: input.influencerId },
    data: { nsfwVideoConsentAt: consentAcceptedAt },
  });

  try {
    await deductCredits(input.userId, cost);
  } catch (err) {
    await db.wavespeedSpicyJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  try {
    const submitted = await submitWavespeedSpicy({
      imageUrl: identity.imageUrl,
      prompt: input.prompt.trim(),
      duration,
      resolution,
      callbackUrl: buildWavespeedSpicyWebhookUrl(job.id),
    });

    await db.wavespeedSpicyJob.update({
      where: { id: job.id },
      data: {
        status: "IN_PROGRESS",
        wavespeedPredictionId: submitted.predictionId,
        wavespeedModel: submitted.modelId,
      },
    });

    return {
      jobId: job.id,
      cost,
      durationSec: duration,
      resolution,
      status: "IN_PROGRESS",
      isSynthetic: true,
    };
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    const errMsg = err instanceof Error ? err.message : String(err);
    await failWavespeedSpicyJob(job.id, `Submit failed: ${errMsg}`.slice(0, 500));
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: WAVESPEED_SUBMIT_FAILED_MESSAGE,
    });
  }
}

export function buildWavespeedSpicyWebhookUrl(
  jobId: string
): string | undefined {
  const secret = process.env.WAVESPEED_WEBHOOK_SECRET?.trim();
  if (!secret) return undefined;
  return `${getAppUrl()}/api/webhooks/wavespeed-spicy?job=${encodeURIComponent(
    jobId
  )}&secret=${encodeURIComponent(secret)}`;
}

export function verifyWavespeedSpicyWebhookSecret(
  candidate: string | null
): boolean {
  const expected = process.env.WAVESPEED_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  if (!candidate) return false;
  return expected === candidate.trim();
}

export async function finalizeWavespeedSpicyJob(
  jobId: string,
  opts: { videoUrl: string; rawPayload?: unknown }
): Promise<void> {
  const job = await db.wavespeedSpicyJob.findUnique({ where: { id: jobId } });
  if (!job) {
    console.warn(
      `[wavespeed-spicy] finalizeWavespeedSpicyJob: job ${jobId} not found`
    );
    return;
  }
  if (job.status === "COMPLETED" && job.outputVideoUrl) {
    return;
  }

  const filename = `wavespeed-spicy-${job.influencerId}-${nanoid(6)}.mp4`;
  let stored: string;
  try {
    stored = await uploadFromUrl(opts.videoUrl, filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[wavespeed-spicy] finalize upload failed for ${jobId}:`,
      msg
    );
    await failWavespeedSpicyJob(
      jobId,
      `Storage upload failed: ${msg.slice(0, 180)}`
    );
    return;
  }

  await db.wavespeedSpicyJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      outputVideoUrl: stored,
      isSynthetic: true,
      completedAt: new Date(),
      metadata:
        opts.rawPayload && typeof opts.rawPayload === "object"
          ? {
              ...(opts.rawPayload as object),
              is_synthetic: true,
              engine: "wavespeed_spicy",
            }
          : { is_synthetic: true, engine: "wavespeed_spicy" },
    },
  });

  try {
    await db.mediaAsset.create({
      data: {
        userId: job.userId,
        influencerId: job.influencerId,
        name: `Génération adulte ${job.durationSec}s ${job.resolution}`,
        kind: "VIDEO",
        url: stored,
        tags: ["nsfw", "wavespeed", "synthetic"],
        isSynthetic: true,
        metadata: {
          engine: "wavespeed_spicy",
          is_synthetic: true,
          jobId: job.id,
          durationSec: job.durationSec,
          resolution: job.resolution,
        },
      },
    });
  } catch (err) {
    console.warn(
      `[wavespeed-spicy] mediaAsset create failed for ${jobId}:`,
      err instanceof Error ? err.message : err
    );
  }

  await emitEvent(job.userId, "NSFW_VIDEO_COMPLETED", {
    jobId: job.id,
    influencerId: job.influencerId,
    durationSec: job.durationSec,
    resolution: job.resolution,
    videoUrl: stored,
    isSynthetic: true,
    creditsCharged: job.creditsHeld,
  });
}

export async function failWavespeedSpicyJob(
  jobId: string,
  error: string
): Promise<void> {
  const job = await db.wavespeedSpicyJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const claimed = await db.wavespeedSpicyJob.updateMany({
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

  await emitEvent(job.userId, "NSFW_VIDEO_FAILED", {
    jobId: job.id,
    influencerId: job.influencerId,
    durationSec: job.durationSec,
    resolution: job.resolution,
    error: error.slice(0, 500),
    creditsRefunded: job.creditsHeld,
  });
}

export async function reconcileWavespeedSpicyJob(
  jobId: string
): Promise<void> {
  const job = await db.wavespeedSpicyJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "COMPLETED" || job.status === "REFUNDED") return;
  if (!job.wavespeedPredictionId) return;
  if (!isWavespeedSpicyReachable()) return;

  try {
    const check = await checkWavespeedSpicy(job.wavespeedPredictionId);
    switch (check.state) {
      case "COMPLETED": {
        await finalizeWavespeedSpicyJob(job.id, {
          videoUrl: check.videoUrl,
          rawPayload: check.raw,
        });
        return;
      }
      case "FAILED": {
        await failWavespeedSpicyJob(job.id, check.error);
        return;
      }
      case "IN_QUEUE":
      case "IN_PROGRESS": {
        return;
      }
      default: {
        const _never: never = check;
        throw new Error(
          `Unhandled WaveSpeed check state: ${String(_never)}`
        );
      }
    }
  } catch (err) {
    console.warn(
      `[wavespeed-spicy] reconcile failed for ${jobId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
