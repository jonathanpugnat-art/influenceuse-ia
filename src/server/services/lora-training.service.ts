import {
  falQueueCheck,
  falQueueSubscribe,
  isFalKeyConfigured,
} from "@/server/services/image-providers/fal-queue.client";
import {
  buildLoraTriggerWord,
  LORA_TRAINING_STEPS,
  parseLoraDataset,
  type LoraDatasetRecord,
} from "@/lib/lora";
import { CREDIT_COSTS } from "@/lib/constants";
import { db } from "@/server/db";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { generateLoraDataset } from "@/server/services/lora-dataset.service";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import Replicate from "replicate";
import { withReplicateRetry } from "@/server/services/replicate-utils";

const FAL_LORA_TRAINER_MODEL =
  process.env.FAL_LORA_TRAINER_MODEL?.trim() || "fal-ai/flux-lora-fast-training";
const REPLICATE_LORA_TRAINER = process.env.REPLICATE_LORA_TRAINER?.trim();
const LORA_TRAINING_STEPS_RESOLVED = (() => {
  const raw = process.env.LORA_TRAINING_STEPS?.trim();
  if (!raw) return LORA_TRAINING_STEPS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 100 && n <= 2000 ? n : LORA_TRAINING_STEPS;
})();

let _replicate: Replicate | null = null;

function getReplicate(): Replicate | null {
  if (!process.env.REPLICATE_API_TOKEN) return null;
  if (!_replicate) {
    _replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return _replicate;
}

function extractLoraWeightsUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;

  const diffusers = data.diffusers_lora_file;
  if (diffusers && typeof diffusers === "object") {
    const url = (diffusers as Record<string, unknown>).url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  if (typeof data.lora_url === "string" && data.lora_url.startsWith("http")) {
    return data.lora_url;
  }

  const weights = data.weights;
  if (weights && typeof weights === "object") {
    const url = (weights as Record<string, unknown>).url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  return null;
}

/** Encode the provider + real request id so a stalled job can be recovered. */
function encodeFalJobId(requestId: string): string {
  return `fal:${FAL_LORA_TRAINER_MODEL}:${requestId}`;
}

function parseFalJobId(
  jobId: string | null | undefined
): { modelId: string; requestId: string } | null {
  if (!jobId?.startsWith("fal:")) return null;
  const rest = jobId.slice(4);
  const lastColon = rest.lastIndexOf(":");
  if (lastColon <= 0 || lastColon === rest.length - 1) return null;
  return {
    modelId: rest.slice(0, lastColon),
    requestId: rest.slice(lastColon + 1),
  };
}

async function trainOnFal(
  zipUrl: string,
  triggerWord: string,
  persistJobId: (jobId: string) => Promise<void>
): Promise<string> {
  const publicZip = await resolvePublicMediaUrl(zipUrl);
  if (!publicZip) {
    throw new Error("ZIP dataset inaccessible pour l'entraînement LoRA.");
  }

  const result = await falQueueSubscribe(
    FAL_LORA_TRAINER_MODEL,
    {
      images_data_url: publicZip,
      trigger_word: triggerWord,
      create_masks: true,
      steps: LORA_TRAINING_STEPS_RESOLVED,
      is_style: false,
    },
    900_000,
    async (requestId) => {
      await persistJobId(encodeFalJobId(requestId));
    }
  );

  const loraUrl = extractLoraWeightsUrl(result);
  if (!loraUrl) {
    throw new Error("Entraînement LoRA terminé sans URL de poids.");
  }
  return loraUrl;
}

async function trainOnReplicate(zipUrl: string, triggerWord: string): Promise<string> {
  const replicate = getReplicate();
  if (!replicate || !REPLICATE_LORA_TRAINER) {
    throw new Error("Aucun provider LoRA configuré (FAL_KEY ou REPLICATE_LORA_TRAINER).");
  }

  const publicZip = await resolvePublicMediaUrl(zipUrl);
  if (!publicZip) {
    throw new Error("ZIP dataset inaccessible pour l'entraînement LoRA.");
  }

  const output = await withReplicateRetry(
    () =>
      replicate.run(REPLICATE_LORA_TRAINER as `${string}/${string}`, {
        input: {
          input_images: publicZip,
          trigger_word: triggerWord,
          lora_type: "subject",
        },
      }),
    REPLICATE_LORA_TRAINER
  );

  const loraUrl = extractLoraWeightsUrl(output) ?? (typeof output === "string" ? output : null);
  if (!loraUrl?.startsWith("http")) {
    throw new Error("Replicate LoRA trainer returned no weights URL.");
  }
  return loraUrl;
}

async function runTraining(
  zipUrl: string,
  triggerWord: string,
  persistJobId: (jobId: string) => Promise<void>
): Promise<string> {
  if (isFalKeyConfigured()) {
    try {
      return await trainOnFal(zipUrl, triggerWord, persistJobId);
    } catch (err) {
      const replicate = getReplicate();
      if (!replicate) throw err;
      console.warn("[lora-training] FAL failed, trying Replicate:", err);
    }
  }
  // Replicate runs in-process (no external request id to recover from).
  await persistJobId("replicate:running");
  return trainOnReplicate(zipUrl, triggerWord);
}

/**
 * Atomically flip TRAINING → READY and deduct the training credits exactly
 * once. The conditional `updateMany` guarantees that whichever path finishes
 * first (background subscribe loop OR poll-on-read recovery) wins, so credits
 * are never deducted twice.
 */
async function markLoraReady(
  userId: string,
  influencerId: string,
  loraUrl: string,
  complimentary: boolean
): Promise<void> {
  const res = await db.influencer.updateMany({
    where: { id: influencerId, loraStatus: "TRAINING" },
    data: {
      loraUrl,
      loraStatus: "READY",
      loraTrainedAt: new Date(),
      loraTrainingJobId: null,
    },
  });
  if (res.count === 1 && !complimentary) {
    await deductCredits(userId, CREDIT_COSTS.LORA_TRAINING);
  }
}

/**
 * Poll-on-read recovery: if a FAL training job was started but its worker
 * died before finalizing, advance/close the job on the next status read.
 * Safe to call repeatedly — finalization is idempotent.
 */
export async function recoverFalLoraTraining(
  userId: string,
  influencer: { id: string; loraTrainingJobId: string | null }
): Promise<void> {
  const parsed = parseFalJobId(influencer.loraTrainingJobId);
  if (!parsed || !isFalKeyConfigured()) return;

  let check;
  try {
    check = await falQueueCheck(parsed.modelId, parsed.requestId);
  } catch (err) {
    console.warn(
      "[lora-training] recovery poll failed:",
      err instanceof Error ? err.message : err
    );
    return;
  }

  if (check.state === "COMPLETED") {
    const loraUrl = extractLoraWeightsUrl(check.result);
    if (!loraUrl) {
      await db.influencer.updateMany({
        where: { id: influencer.id, loraStatus: "TRAINING" },
        data: { loraStatus: "FAILED", loraTrainingJobId: null },
      });
      return;
    }
    await markLoraReady(userId, influencer.id, loraUrl, false);
  } else if (check.state === "FAILED") {
    await db.influencer.updateMany({
      where: { id: influencer.id, loraStatus: "TRAINING" },
      data: { loraStatus: "FAILED", loraTrainingJobId: null },
    });
  }
}

export async function trainAndPersistLora(
  userId: string,
  influencerId: string,
  options?: { complimentary?: boolean; skipDataset?: boolean }
): Promise<{ loraUrl: string; triggerWord: string }> {
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId },
  });
  if (!influencer) throw new Error("Influenceuse introuvable.");
  if (influencer.isNsfw) {
    throw new Error("Le LoRA personnage n'est pas disponible en mode NSFW.");
  }

  const complimentary = options?.complimentary === true;
  const trainingCost = CREDIT_COSTS.LORA_TRAINING;
  if (!complimentary) {
    const hasCredits = await checkCredits(userId, trainingCost);
    if (!hasCredits) {
      throw new Error(
        `Crédits insuffisants. Coût entraînement LoRA : ${trainingCost} crédits.`
      );
    }
  }

  const triggerWord =
    influencer.loraTriggerWord?.trim() ||
    buildLoraTriggerWord(influencerId, influencer.name);

  await db.influencer.update({
    where: { id: influencerId },
    data: {
      loraStatus: "TRAINING",
      loraTriggerWord: triggerWord,
      // Real provider request id is written by `persistJobId` once the job
      // is accepted; null until then so recovery never targets a phantom job.
      loraTrainingJobId: null,
    },
  });

  const persistJobId = async (jobId: string) => {
    await db.influencer.updateMany({
      where: { id: influencerId, loraStatus: "TRAINING" },
      data: { loraTrainingJobId: jobId },
    });
  };

  let dataset: LoraDatasetRecord;
  const existing = parseLoraDataset(influencer.loraDataset);
  if (!options?.skipDataset && existing?.status === "ready" && existing.zipUrl) {
    dataset = existing;
  } else {
    dataset = await generateLoraDataset(userId, influencerId, { complimentary });
  }

  if (!dataset.zipUrl) {
    throw new Error("Dataset LoRA sans archive ZIP.");
  }

  try {
    const loraUrl = await runTraining(dataset.zipUrl, triggerWord, persistJobId);

    await markLoraReady(userId, influencerId, loraUrl, complimentary);

    return { loraUrl, triggerWord };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await db.influencer.update({
      where: { id: influencerId },
      data: {
        loraStatus: "FAILED",
        loraTrainingJobId: null,
        loraDataset: {
          ...dataset,
          status: "failed",
          error: msg.slice(0, 500),
          updatedAt: new Date().toISOString(),
        } as object,
      },
    });
    throw error;
  }
}

export async function scheduleLoraTraining(
  userId: string,
  influencerId: string,
  options?: { complimentary?: boolean }
): Promise<void> {
  try {
    await trainAndPersistLora(userId, influencerId, options);
    console.log(`[lora-training] Ready for influencer ${influencerId}`);
  } catch (err) {
    console.error(
      "[lora-training] Failed:",
      err instanceof Error ? err.message : err
    );
    throw err;
  }
}
