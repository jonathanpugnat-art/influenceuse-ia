/**
 * Talking-head V1 orchestration.
 *
 * Pipeline:
 *   1. Validate script + resolve character voice_id (fail fast if none).
 *   2. Hold credits (deductCredits — refunded on FAILED).
 *   3. Persist a TalkingHeadJob row PENDING.
 *   4. Run ElevenLabs TTS → upload mp3 to R2 → measure duration.
 *   5. Upload mp3 + portrait to Hedra as assets.
 *   6. POST /generations to Hedra with 9:16 / 720p.
 *   7. Row → PROCESSING; the poller cron finishes the job.
 *
 * Everything runs server-side. The tRPC layer only calls
 * `startTalkingHeadJob` and `pollTalkingHeadJob`; the cron only calls
 * `pollPendingTalkingHeadJobs`.
 */

import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import {
  checkCredits,
  deductCredits,
  refundCredits,
} from "@/server/services/credits.service";
import { uploadFile, uploadFromUrl } from "@/server/services/storage.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import { synthesizeSpeech } from "@/server/services/elevenlabs.service";
import {
  createAsset,
  createGeneration,
  getAssetUrl,
  getGenerationStatus,
  hedraModelSlug,
  isHedraConfigured,
  uploadAsset,
} from "@/server/services/hedra.service";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  clampTalkingHeadDurationSec,
  estimateTalkingHeadCredits,
  estimateTalkingHeadDurationSec,
  validateTalkingHeadScript,
} from "@/lib/talking-head";
import type { TalkingHeadJob } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface StartTalkingHeadInput {
  userId: string;
  influencerId: string;
  script: string;
  language?: string;
}

export interface StartTalkingHeadResult {
  jobId: string;
  estimatedDurationSec: number;
  estimatedCost: number;
  status: TalkingHeadJob["status"];
}

// ──────────────────────────────────────────────
// Public API — start
// ──────────────────────────────────────────────

export async function startTalkingHeadJob(
  input: StartTalkingHeadInput
): Promise<StartTalkingHeadResult> {
  const validation = validateTalkingHeadScript(input.script);
  if (!validation.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.error ?? "Script invalide.",
    });
  }

  const influencer = await db.influencer.findFirst({
    where: { id: input.influencerId, userId: input.userId },
    select: {
      id: true,
      name: true,
      voiceId: true,
      voiceProvider: true,
      voiceLanguage: true,
      voiceConsentAt: true,
      baseImageUrl: true,
      avatarUrl: true,
    },
  });
  if (!influencer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Personnage introuvable ou non accessible.",
    });
  }
  if (!influencer.voiceId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Ce personnage n'a pas encore de voix. Configure la voix (clone ou bibliothèque) avant de générer un talking-head.",
    });
  }
  if (!influencer.voiceConsentAt) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Consentement voix synthétique manquant. Ouvre le panneau voix et coche la case avant de générer.",
    });
  }
  if (!isHedraConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "HEDRA_API_KEY manquant — talking-head indisponible sur ce serveur.",
    });
  }

  const portrait = await resolvePublicMediaUrl(
    influencer.baseImageUrl ?? influencer.avatarUrl ?? null
  );
  if (!portrait) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Ce personnage n'a pas de portrait frontal. Termine l'assistant de création avant de générer un talking-head.",
    });
  }

  const language =
    (input.language?.trim() || influencer.voiceLanguage?.trim() || "fr");
  const estimatedDurationSec = estimateTalkingHeadDurationSec(input.script);
  const estimatedCost = estimateTalkingHeadCredits(estimatedDurationSec);

  const hasCredits = await checkCredits(input.userId, estimatedCost);
  if (!hasCredits) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Crédits insuffisants. Ce talking-head coûte ${estimatedCost} crédits.`,
    });
  }

  const job = await db.talkingHeadJob.create({
    data: {
      userId: input.userId,
      influencerId: influencer.id,
      script: input.script.trim(),
      voiceId: influencer.voiceId,
      voiceProvider: influencer.voiceProvider ?? "elevenlabs",
      language,
      portraitImageUrl: portrait,
      hedraModelSlug: hedraModelSlug(),
      creditsHeld: estimatedCost,
      status: "PENDING",
    },
  });

  try {
    await deductCredits(input.userId, estimatedCost);
  } catch (err) {
    await db.talkingHeadJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  try {
    await submitTalkingHeadToHedra(job.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failTalkingHeadJob(job.id, `Submit failed: ${msg.slice(0, 200)}`);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Impossible de lancer le talking-head. Les crédits ont été remboursés.",
    });
  }

  return {
    jobId: job.id,
    estimatedDurationSec,
    estimatedCost,
    status: "PROCESSING",
  };
}

// ──────────────────────────────────────────────
// Submission (TTS + Hedra assets + generation)
// ──────────────────────────────────────────────

async function submitTalkingHeadToHedra(jobId: string): Promise<void> {
  const job = await db.talkingHeadJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`TalkingHeadJob ${jobId} disappeared`);

  // Step 1 — TTS
  const tts = await synthesizeSpeech({
    voiceId: job.voiceId,
    text: job.script,
  });

  const audioFilename = `talking-head-${job.influencerId}-${nanoid(6)}.mp3`;
  const audioUrl = await uploadFile(
    tts.audio,
    audioFilename,
    tts.contentType || "audio/mpeg"
  );

  // Duration probe — we don't ship a MP3 parser in prod (would need a
  // native dep). Fallback to script estimate — same math the credit hold
  // used, so the reconciled duration is at least never wildly wrong.
  const estimated = estimateTalkingHeadDurationSec(job.script);
  const audioDurationSec = clampTalkingHeadDurationSec(estimated);

  // Step 2 — Hedra audio asset
  const audioAsset = await createAsset({
    type: "audio",
    name: `talking-head-audio-${job.id}`,
  });
  await uploadAsset({
    assetId: audioAsset.assetId,
    data: tts.audio,
    filename: audioFilename,
    contentType: tts.contentType || "audio/mpeg",
  });

  // Step 3 — Hedra portrait asset
  const portraitBuf = await downloadToBuffer(job.portraitImageUrl);
  const imageAsset = await createAsset({
    type: "image",
    name: `talking-head-portrait-${job.id}`,
  });
  await uploadAsset({
    assetId: imageAsset.assetId,
    data: portraitBuf.data,
    filename: portraitBuf.filename,
    contentType: portraitBuf.contentType,
  });

  // Step 4 — Generation
  const generation = await createGeneration({
    audioAssetId: audioAsset.assetId,
    imageAssetId: imageAsset.assetId,
    aspectRatio: "9:16",
    resolution: "720p",
    modelSlug: job.hedraModelSlug ?? hedraModelSlug(),
  });

  await db.talkingHeadJob.update({
    where: { id: job.id },
    data: {
      status: "PROCESSING",
      audioUrl,
      audioDurationSec,
      hedraAudioAssetId: audioAsset.assetId,
      hedraImageAssetId: imageAsset.assetId,
      hedraGenerationId: generation.generationId,
      hedraModelSlug: generation.modelSlug,
    },
  });
}

async function downloadToBuffer(url: string): Promise<{
  data: Buffer;
  contentType: string;
  filename: string;
}> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Impossible de télécharger le portrait (HTTP ${res.status}) : ${url}`
    );
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const filename = deriveImageFilename(url, contentType);
  const data = Buffer.from(await res.arrayBuffer());
  return { data, contentType, filename };
}

function deriveImageFilename(url: string, contentType: string): string {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() || "portrait";
    if (base.includes(".")) return base;
  } catch {
    // fall through
  }
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  return `portrait.${ext}`;
}

// ──────────────────────────────────────────────
// Public API — polling
// ──────────────────────────────────────────────

/**
 * Advance one job by asking Hedra. Idempotent — safe to call from both
 * the cron and the tRPC query the UI uses to refresh a preview.
 */
export async function pollTalkingHeadJob(
  jobId: string
): Promise<TalkingHeadJob> {
  const job = await db.talkingHeadJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Job introuvable.",
    });
  }

  if (
    job.status === "COMPLETED" ||
    job.status === "FAILED" ||
    job.status === "REFUNDED"
  ) {
    return job;
  }
  if (!job.hedraGenerationId) {
    return job; // still in the middle of submission
  }

  try {
    const status = await getGenerationStatus(job.hedraGenerationId);
    if (status.state === "complete") {
      await finalizeTalkingHeadJob(job.id, {
        videoUrl: status.url,
        thumbnailUrl: status.thumbnailUrl,
        assetId: status.assetId,
        rawPayload: status.raw,
      });
    } else if (status.state === "error" || status.state === "canceled") {
      await failTalkingHeadJob(
        job.id,
        status.error?.slice(0, 300) ?? "Hedra generation failed"
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[talking-head] pollTalkingHeadJob ${jobId} failed:`,
      msg
    );
  }

  return (
    (await db.talkingHeadJob.findUnique({ where: { id: jobId } })) ?? job
  );
}

export interface PollBatchResult {
  scanned: number;
  completed: number;
  failed: number;
  stillProcessing: number;
}

/** Move every PROCESSING job forward. Called by the cron. */
export async function pollPendingTalkingHeadJobs(): Promise<PollBatchResult> {
  const rows = await db.talkingHeadJob.findMany({
    where: { status: "PROCESSING" },
    orderBy: { updatedAt: "asc" },
    take: 25,
  });

  const result: PollBatchResult = {
    scanned: rows.length,
    completed: 0,
    failed: 0,
    stillProcessing: 0,
  };

  for (const row of rows) {
    const updated = await pollTalkingHeadJob(row.id);
    if (updated.status === "COMPLETED") result.completed += 1;
    else if (updated.status === "FAILED" || updated.status === "REFUNDED")
      result.failed += 1;
    else result.stillProcessing += 1;
  }

  return result;
}

// ──────────────────────────────────────────────
// Finalize / fail
// ──────────────────────────────────────────────

interface FinalizeInput {
  videoUrl?: string;
  thumbnailUrl?: string;
  assetId?: string;
  rawPayload?: unknown;
}

async function finalizeTalkingHeadJob(
  jobId: string,
  opts: FinalizeInput
): Promise<void> {
  const job = await db.talkingHeadJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "COMPLETED" && job.videoUrl) return;

  let remoteUrl = opts.videoUrl;
  let thumbnailUrl = opts.thumbnailUrl;

  // Some Hedra responses only include the asset id — resolve it lazily.
  if (!remoteUrl && opts.assetId) {
    const asset = await getAssetUrl(opts.assetId);
    if (asset.url) remoteUrl = asset.url;
    if (asset.thumbnailUrl) thumbnailUrl = thumbnailUrl ?? asset.thumbnailUrl;
  }

  if (!remoteUrl) {
    await failTalkingHeadJob(
      jobId,
      "Hedra a marqué la génération complete sans exposer d'URL de sortie."
    );
    return;
  }

  const filename = `talking-head-${job.influencerId}-${nanoid(6)}.mp4`;
  let storedUrl: string;
  try {
    storedUrl = await uploadFromUrl(remoteUrl, filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[talking-head] upload failed for ${jobId}:`, msg);
    await failTalkingHeadJob(
      jobId,
      `Storage upload failed: ${msg.slice(0, 180)}`
    );
    return;
  }

  await db.talkingHeadJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      videoUrl: storedUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      completedAt: new Date(),
      metadata:
        opts.rawPayload && typeof opts.rawPayload === "object"
          ? (opts.rawPayload as object)
          : job.metadata ?? undefined,
    },
  });
}

export async function failTalkingHeadJob(
  jobId: string,
  error: string
): Promise<void> {
  const job = await db.talkingHeadJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "FAILED" || job.status === "REFUNDED") return;

  if (job.creditsHeld > 0) {
    await refundCredits(job.userId, job.creditsHeld);
  }
  await db.talkingHeadJob.update({
    where: { id: jobId },
    data: {
      status: "REFUNDED",
      error: error.slice(0, 500),
      completedAt: new Date(),
    },
  });
}

// ──────────────────────────────────────────────
// Preview helper for the tRPC "getConfig" endpoint
// ──────────────────────────────────────────────

export interface TalkingHeadConfig {
  hedraConfigured: boolean;
  elevenLabsConfigured: boolean;
  perSecondCost: number;
  maxDurationSec: number;
  modelSlug: string;
}

export function readTalkingHeadConfig(): TalkingHeadConfig {
  return {
    hedraConfigured: isHedraConfigured(),
    elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
    perSecondCost: CREDIT_COSTS.TALKING_HEAD_PER_SEC,
    maxDurationSec: 30,
    modelSlug: hedraModelSlug(),
  };
}
