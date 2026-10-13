import { zipSync } from "fflate";
import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";

import { getBlobStore } from "@/lib/blob";
import { loraZipKey } from "@/lib/blob/keys";
import { getDb } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { decideLoraActivation, makeTriggerWord } from "@/lib/identity/lora";
import { inngest, type LoraRequestedData } from "@/lib/jobs/inngest";
import {
  ensureCharacterCentroid,
  scoreOutputAgainstCentroid,
} from "@/lib/jobs/steps/score-identity";
import {
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
  refundCredits,
} from "@/lib/repositories/db/jobs";
import {
  getCharacterIdentityBaseline,
  setCharacterLoraEnabled,
  updateLora,
} from "@/lib/repositories/db/loras";
import {
  createTraining,
  createVersionPrediction,
  fetchOutput,
  getPrediction,
  getTraining,
  parseTrainingOutput,
  ReplicateError,
} from "@/lib/replicate/client";
import { track } from "@/lib/observability/analytics";

export const trainLora = inngest.createFunction(
  {
    id: "train-lora",
    triggers: [{ event: "ofmia/lora.requested" }],
    retries: 1,
    timeouts: { start: "30s", finish: "30m" },
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as LoraRequestedData | undefined;
      if (!data?.jobId) return;
      await updateLora(data.loraId, {
        status: "failed",
        errorCode: "generation_failed",
        completedAt: new Date(),
      });
      await markJobFailed({
        jobId: data.jobId,
        status: "failed",
        errorCode: "generation_failed",
        errorMessage: error.message,
      });
      await refundCredits({ userId: data.userId, jobId: data.jobId });
    },
  },
  async ({ event, step }) => {
    const { jobId, characterId, userId, loraId } = event.data as LoraRequestedData;
    const env = getEnv();
    if (!env.LORA_ENABLED) throw new NonRetriableError("lora_disabled");

    const character = await step.run("load-character", async () => {
      const db = getDb();
      const rows = await db
        .select()
        .from(characters)
        .where(eq(characters.id, characterId))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!character || character.ownerId !== userId || character.door !== "clone") {
      throw new NonRetriableError("character invalide");
    }

    const zipUrl = await step.run("pack-zip", async () => {
      const blob = getBlobStore();
      const files: Record<string, Uint8Array> = {};
      let index = 0;
      for (const source of character.sources) {
        const bytes = await blob.get(source.key);
        if (!bytes) continue;
        const ext = source.contentType === "image/png" ? "png" : "jpg";
        files[`${index}.${ext}`] = new Uint8Array(bytes);
        index += 1;
      }
      if (index < 8) throw new NonRetriableError("photos_insuffisantes");
      const zipped = zipSync(files);
      const key = loraZipKey(userId, characterId, loraId);
      await blob.put({
        key,
        body: Buffer.from(zipped),
        contentType: "application/zip",
      });
      return blob.presignGet(key, { expiresInSeconds: 3600 });
    });

    const training = await step.run("start-training", async () => {
      await updateLora(loraId, { status: "training" });
      const trigger = makeTriggerWord(characterId);
      const created = await createTraining({
        version: env.REPLICATE_FAST_FLUX_TRAINER_VERSION!,
        destination: env.REPLICATE_LORA_DESTINATION!,
        body: {
          input_images: zipUrl,
          trigger_word: trigger,
          lora_type: "subject",
        },
      });
      if (!created.id) throw new NonRetriableError("training_id manquant");
      await updateLora(loraId, { trainingId: created.id });
      await markJobRunning(jobId, created.id);
      return created;
    });

    let final = training;
    for (let cycle = 0; cycle < 40; cycle += 1) {
      if (final.status === "succeeded" || final.status === "failed" || final.status === "canceled") {
        break;
      }
      await step.sleep(`lora-wait-${cycle}`, "30s");
      final = await step.run(`lora-poll-${cycle}`, async () => {
        if (!training.id) throw new NonRetriableError("training_id manquant");
        return getTraining(training.id);
      });
    }

    if (final.status !== "succeeded") {
      await step.run("mark-failed", async () => {
        await updateLora(loraId, {
          status: "failed",
          errorCode: "timeout",
          completedAt: new Date(),
        });
        await markJobFailed({ jobId, status: "timed_out", errorCode: "timeout" });
        await refundCredits({ userId, jobId });
      });
      return { ok: false };
    }

    const parsed = parseTrainingOutput(final.output);
    const version = parsed.version ?? final.version ?? null;
    if (!version) {
      throw new NonRetriableError("version_manquante");
    }

    await step.run("store-version", async () => {
      await updateLora(loraId, {
        status: "validating",
        replicateVersion: version,
      });
    });

    const validation = await step.run("validate-lora", async () => {
      try {
        let prediction = await createVersionPrediction({
          version,
          body: {
            prompt: `${makeTriggerWord(characterId)}, portrait photo`,
            aspect_ratio: "3:4",
            output_format: "jpg",
          },
          waitSeconds: 60,
        });
        for (let i = 0; i < 15 && prediction.status !== "succeeded"; i += 1) {
          if (!prediction.id || prediction.status === "failed") {
            return { succeeded: false, score: null as number | null };
          }
          await new Promise((r) => setTimeout(r, 2000));
          prediction = await getPrediction(prediction.id);
        }
        if (prediction.status !== "succeeded") {
          return { succeeded: false, score: null as number | null };
        }

        const bytes = await fetchOutput(
          Array.isArray(prediction.output) ? prediction.output[0] : prediction.output,
        );
        if (!env.IDENTITY_SCORING_ENABLED || !env.FACE_EMBED_MODEL) {
          return { succeeded: true, score: null as number | null };
        }

        const blob = getBlobStore();
        const validateKey = `tmp/${userId}/${loraId}/lora-validate.jpg`;
        await blob.put({ key: validateKey, body: bytes, contentType: "image/jpeg" });
        const faceUrl = await blob.presignGet(character.faceKey, { expiresInSeconds: 600 });
        const centroid = await ensureCharacterCentroid({
          characterId,
          faceImageUrl: faceUrl,
        });
        const scored = await scoreOutputAgainstCentroid({
          imageKey: validateKey,
          centroid,
        });
        return { succeeded: true, score: scored.score };
      } catch (error) {
        if (error instanceof ReplicateError) console.error("lora validate", error.code);
        return { succeeded: false, score: null as number | null };
      }
    });

    const referenceMean = await step.run("reference-baseline", async () =>
      getCharacterIdentityBaseline(characterId),
    );

    await step.run("finalize", async () => {
      const enable = decideLoraActivation({
        predictionSucceeded: validation.succeeded,
        scoringEnabled: env.IDENTITY_SCORING_ENABLED,
        loraMean: validation.score,
        referenceMean,
      });
      await updateLora(loraId, {
        status: enable ? "ready" : "failed",
        validationScore: validation.score,
        errorCode: enable ? null : "validation_low",
        completedAt: new Date(),
      });
      if (enable) {
        await setCharacterLoraEnabled(characterId, userId, true);
        await markJobSucceeded({
          jobId,
          durationMs: 0,
          providerMetrics: {},
        });
      } else {
        await markJobFailed({
          jobId,
          status: "failed",
          errorCode: "validation_low",
          errorMessage: "LoRA sous le seuil de ressemblance",
        });
        await refundCredits({ userId, jobId });
      }
      await track(userId, {
        name: "lora_training_completed",
        props: { enabled: enable, score: validation.score ?? -1 },
      });
    });

    return { ok: true, version, validationScore: validation.score };
  },
);
