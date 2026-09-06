/**
 * Kling O3 Standard image-to-video — scene V1 (default `SCENE_ENGINE`).
 *
 * Reuses SeedanceJob rows + fal-seedance webhook + failSeedanceJob
 * (hold / refund / 20 min timeout). Seedance submit is not called here.
 */

import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { formatGenerationErrorForUser } from "@/lib/generation-errors";
import { parseIdentityPack } from "@/lib/identity-pack";
import {
  clampKlingSceneDuration,
  estimateKlingSceneCredits,
  KLING_SCENE_MODE,
  type KlingSceneDuration,
} from "@/lib/scene-engine";
import {
  checkCredits,
  deductCredits,
} from "@/server/services/credits.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import {
  buildFalKlingO3I2vPayload,
  submitFalKlingO3I2v,
} from "@/server/services/video-providers/fal-kling-o3-i2v.provider";
import {
  logFalVideoSubmit,
  MISSING_SEEDANCE_WEBHOOK_SECRET,
} from "@/server/services/fal-video-webhook";
import {
  buildSeedanceWebhookUrl,
  failSeedanceJob,
} from "@/server/services/seedance.service";
import type { SeedanceJob } from "@/generated/prisma/client";

export interface CreateKlingSceneInput {
  userId: string;
  influencerId: string;
  scenePrompt: string;
  extraPromptTail?: string | null;
  requestedDuration: number;
  generateAudio: boolean;
}

export interface CreateKlingSceneResult {
  jobId: string;
  cost: number;
  durationSec: KlingSceneDuration;
  resolution: "standard";
  mode: typeof KLING_SCENE_MODE;
  status: SeedanceJob["status"];
}

interface ResolvedSceneFrontal {
  imageUrl: string;
  characterName: string;
}

/**
 * Frontal still only — same candidate order as Seedance identity, but
 * we never attach pack alt-angles (Kling O3 I2V takes one `image_url`).
 */
async function resolveSceneFrontal(
  influencerId: string,
  userId: string
): Promise<ResolvedSceneFrontal> {
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
  for (const candidate of frontalCandidates) {
    const resolved = await resolvePublicMediaUrl(candidate);
    if (resolved) {
      return { imageUrl: resolved, characterName: influencer.name };
    }
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Ce personnage n'a pas encore de portrait de référence. Termine l'assistant de création avant de lancer une scène.",
  });
}

function buildKlingScenePrompt(opts: {
  scenePrompt: string;
  extraPromptTail?: string | null;
}): string {
  const scene = opts.scenePrompt.trim();
  const extra = opts.extraPromptTail?.trim();
  return extra ? `${scene} ${extra}`.replace(/\s+/g, " ").trim() : scene;
}

export async function createKlingSceneJob(
  input: CreateKlingSceneInput
): Promise<CreateKlingSceneResult> {
  const identity = await resolveSceneFrontal(
    input.influencerId,
    input.userId
  );

  const duration = clampKlingSceneDuration(input.requestedDuration);
  const cost = estimateKlingSceneCredits(duration, input.generateAudio);
  const prompt = buildKlingScenePrompt({
    scenePrompt: input.scenePrompt,
    extraPromptTail: input.extraPromptTail,
  });
  if (!prompt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Décris la scène avant de lancer la génération.",
    });
  }

  const hasCredits = await checkCredits(input.userId, cost);
  if (!hasCredits) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Crédits insuffisants. Cette scène coûte ${cost} crédits.`,
    });
  }

  const built = buildFalKlingO3I2vPayload({
    imageUrl: identity.imageUrl,
    prompt,
    duration,
    generateAudio: input.generateAudio,
  });

  const job = await db.seedanceJob.create({
    data: {
      userId: input.userId,
      influencerId: input.influencerId,
      mode: "IMAGE_TO_VIDEO",
      durationSec: duration,
      resolution: "standard",
      aspectRatio: "9:16",
      generateAudio: input.generateAudio,
      prompt: built.prompt,
      extraPromptTail: input.extraPromptTail ?? null,
      referenceImageUrls: [identity.imageUrl],
      creditsHeld: cost,
      status: "PENDING",
      falRequestId: null,
      falModel: built.modelId,
    },
  });

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
        engine: "kling_o3_i2v",
        jobId: job.id,
        webhookConfigured: false,
        mode: KLING_SCENE_MODE,
        duration,
        generateAudio: input.generateAudio,
        characterId: input.influencerId,
        refCount: 1,
      });
      await failSeedanceJob(job.id, MISSING_SEEDANCE_WEBHOOK_SECRET);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Impossible de lancer la vidéo scène. Les crédits ont été remboursés.",
      });
    }

    const submitted = await submitFalKlingO3I2v({
      imageUrl: identity.imageUrl,
      prompt,
      duration,
      generateAudio: input.generateAudio,
      webhookUrl,
    });

    logFalVideoSubmit({
      engine: "kling_o3_i2v",
      jobId: job.id,
      webhookConfigured: true,
      falRequestId: submitted.requestId,
      modelId: submitted.modelId,
      mode: KLING_SCENE_MODE,
      refCount: 1,
      duration,
      generateAudio: input.generateAudio,
      characterId: input.influencerId,
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
      resolution: "standard",
      mode: KLING_SCENE_MODE,
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
