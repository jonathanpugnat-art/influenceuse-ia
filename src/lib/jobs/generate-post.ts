import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";

import { getBlobStore } from "@/lib/blob";
import { postKey } from "@/lib/blob/keys";
import { getDb } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { inngest, type PostRequestedData } from "@/lib/jobs/inngest";
import { track } from "@/lib/observability/analytics";
import { formatById } from "@/lib/formats";
import { isFaceAngle, pickReference, type FaceAngle } from "@/lib/identity/angles";
import { buildLoraPrompt, shouldUseLoraForGeneration } from "@/lib/identity/lora";
import { decideIdentityOutcome } from "@/lib/identity/similarity";
import {
  ensureCharacterCentroid,
  scoreOutputAgainstCentroid,
} from "@/lib/jobs/steps/score-identity";
import { listRefs } from "@/lib/repositories/db/face-refs";
import { getActiveLora } from "@/lib/repositories/db/loras";
import { sceneById } from "@/lib/scenes";
import {
  getJobForOwner,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
  markPostFailed,
  markPostIdentity,
  markPostSucceeded,
  refundCredits,
} from "@/lib/repositories/db/jobs";
import {
  cancelPrediction,
  createPrediction,
  createVersionPrediction,
  fetchOutput,
  getPrediction,
  ReplicateError,
  type ReplicatePrediction,
} from "@/lib/replicate/client";
import { getOwnedCharacter, readCharacterFace, readNiche, savePost } from "@/lib/storage";
import { writeCaption } from "@/lib/voice";

const MODEL = "black-forest-labs/flux-kontext-pro";

async function startImagePrediction(input: {
  prompt: string;
  faceDataUri: string;
  webhook?: string;
  lora: { version: string; triggerWord: string } | null;
}): Promise<ReplicatePrediction> {
  if (input.lora) {
    return createVersionPrediction({
      version: input.lora.version,
      webhook: input.webhook,
      body: {
        prompt: buildLoraPrompt(input.lora.triggerWord, input.prompt),
        aspect_ratio: "3:4",
        output_format: "jpg",
        output_quality: 90,
      },
    });
  }
  return createPrediction({
    model: MODEL,
    webhook: input.webhook,
    body: {
      prompt: input.prompt,
      input_image: input.faceDataUri,
      aspect_ratio: "3:4",
      output_format: "jpg",
      output_quality: 90,
    },
  });
}

export const generatePost = inngest.createFunction(
  {
    id: "generate-post",
    triggers: [{ event: "ofmia/post.requested" }],
    retries: 2,
    concurrency: [
      { key: "event.data.userId", limit: 2 },
      { limit: 10 },
    ],
    timeouts: { start: "30s", finish: "5m" },
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as PostRequestedData | undefined;
      if (!data?.jobId) {
        console.error("onFailure: jobId manquant", error);
        return;
      }
      await markJobFailed({
        jobId: data.jobId,
        status: "failed",
        errorCode: "generation_failed",
        errorMessage: error.message,
      });
      await markPostFailed(data.postId);
      await refundCredits({ userId: data.userId, jobId: data.jobId });
      await track(data.userId, {
        name: "post_failed",
        props: { errorCode: "generation_failed" },
      });
    },
  },
  async ({ event, step }) => {
    const { jobId, postId, characterId, userId } = event.data as PostRequestedData;

    const postRow = await step.run("load-post", async () => {
      const db = getDb();
      const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      return rows[0] ?? null;
    });
    if (!postRow) throw new NonRetriableError("post manquant");

    const character = await step.run("load-character", async () =>
      getOwnedCharacter(characterId, userId),
    );
    if (!character) throw new NonRetriableError("character manquant");

    const faceDataUri = await step.run("load-reference", async () => {
      const blob = getBlobStore();
      let desired: FaceAngle = "front";
      if (postRow.sourceKind === "format") {
        desired = formatById(postRow.sourceRef)?.angle ?? "front";
      } else if (postRow.sourceKind === "scene") {
        desired = sceneById(postRow.sourceRef)?.angle ?? "front";
      }

      let refKeyPath = character.face.file;
      let contentType = character.face.contentType;
      if (getEnv().IDENTITY_REFS_ENABLED && getEnv().METADATA_DRIVER === "db") {
        const refs = await listRefs(characterId, userId);
        const picked = pickReference(
          refs.map((ref) => ({
            angle: isFaceAngle(ref.angle) ? ref.angle : ("front" as const),
            key: ref.key,
            contentType: ref.contentType,
          })),
          desired,
        );
        if (picked) {
          refKeyPath = picked.key;
          contentType = picked.contentType;
        }
      }

      if (refKeyPath.includes("/")) {
        try {
          return await blob.presignGet(refKeyPath, { expiresInSeconds: 600 });
        } catch {
          /* fall through */
        }
      }

      const face =
        refKeyPath === character.face.file
          ? await readCharacterFace(character)
          : await blob.get(refKeyPath);
      if (!face) throw new NonRetriableError("visage manquant");
      const tempKey = `tmp/${userId}/${postId}/face.jpg`;
      await blob.put({ key: tempKey, body: face, contentType });
      try {
        return await blob.presignGet(tempKey, { expiresInSeconds: 600 });
      } catch {
        return `data:${contentType};base64,${face.toString("base64")}`;
      }
    });

    const loraTarget = await step.run("resolve-lora", async () => {
      const env = getEnv();
      if (env.METADATA_DRIVER !== "db" || !env.LORA_ENABLED || !character.loraEnabled) {
        return null;
      }
      const active = await getActiveLora(characterId, userId);
      if (
        !shouldUseLoraForGeneration({
          loraEnabledFlag: env.LORA_ENABLED,
          characterLoraEnabled: Boolean(character.loraEnabled),
          replicateVersion: active?.replicateVersion,
          status: active?.status,
        })
      ) {
        return null;
      }
      return {
        version: active!.replicateVersion!,
        triggerWord: active!.triggerWord,
      };
    });

    const prediction = await step.run("create-prediction", async () => {
      try {
        const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
        const webhook =
          base && /^https:\/\//i.test(base)
            ? `${base}/api/webhooks/replicate`
            : undefined;
        const created = await startImagePrediction({
          prompt: postRow.prompt,
          faceDataUri,
          webhook,
          lora: loraTarget,
        });
        await markJobRunning(jobId, created.id);
        return created;
      } catch (error) {
        if (error instanceof ReplicateError && !error.retriable) {
          throw new NonRetriableError(error.code);
        }
        throw error;
      }
    });

    let final = prediction;
    for (let cycle = 0; cycle < 6; cycle += 1) {
      if (final.status === "succeeded" || final.status === "failed" || final.status === "canceled") {
        break;
      }
      const completed = await step.waitForEvent(`wait-prediction-${cycle}`, {
        event: "ofmia/replicate.prediction.completed",
        if: `async.data.predictionId == "${prediction.id}"`,
        timeout: "15s",
      });
      if (completed) {
        final = {
          id: prediction.id,
          status: completed.data.status,
          output: completed.data.output ?? undefined,
          error: completed.data.error ?? undefined,
          metrics: completed.data.metrics,
        };
        break;
      }
      final = await step.run(`poll-prediction-${cycle}`, async () => {
        if (!prediction.id) throw new NonRetriableError("prediction_id manquant");
        return getPrediction(prediction.id);
      });
    }

    if (final.status !== "succeeded") {
      if (prediction.id) {
        await step.run("cancel-prediction", async () => cancelPrediction(prediction.id!));
      }
      await step.run("mark-timeout", async () => {
        await markJobFailed({ jobId, status: "timed_out", errorCode: "timeout" });
        await markPostFailed(postId);
        await refundCredits({ userId, jobId });
      });
      await track(userId, { name: "post_failed", props: { errorCode: "timeout" } });
      return { ok: false };
    }

    const imageKey = postKey(userId, characterId, postId);
    let generationAttempts = 1;
    await step.run("persist-output", async () => {
      const bytes = await fetchOutput(
        Array.isArray(final.output) ? final.output[0] : final.output,
      );
      await getBlobStore().put({ key: imageKey, body: bytes, contentType: "image/jpeg" });
      if (getEnv().BLOB_DRIVER === "fs") {
        await savePost(characterId, bytes, postId);
      }
    });

    let identityScore = await step.run("score-identity", async () => {
      const env = getEnv();
      if (!env.IDENTITY_SCORING_ENABLED) {
        return {
          score: null as number | null,
          status: "non_mesure" as const,
          model: null as string | null,
        };
      }
      const centroid = await ensureCharacterCentroid({
        characterId,
        faceImageUrl: faceDataUri,
      });
      return scoreOutputAgainstCentroid({ imageKey, centroid });
    });

    const decision = decideIdentityOutcome({
      band: identityScore.status,
      attempt: 0,
      maxRetries: getEnv().IDENTITY_AUTO_RETRY_MAX,
    });

    if (decision === "retry") {
      await track(userId, {
        name: "identity_auto_retry",
        props: { previousStatus: identityScore.status, score: identityScore.score ?? -1 },
      });
      generationAttempts = 2;
      const retryPrediction = await step.run("create-prediction-retry", async () => {
        const created = await startImagePrediction({
          prompt: postRow.prompt,
          faceDataUri,
          lora: loraTarget,
        });
        await markJobRunning(jobId, created.id);
        return created;
      });
      let retryFinal = retryPrediction;
      for (let cycle = 0; cycle < 6; cycle += 1) {
        if (
          retryFinal.status === "succeeded" ||
          retryFinal.status === "failed" ||
          retryFinal.status === "canceled"
        ) {
          break;
        }
        const completed = await step.waitForEvent(`wait-prediction-retry-${cycle}`, {
          event: "ofmia/replicate.prediction.completed",
          if: `async.data.predictionId == "${retryPrediction.id}"`,
          timeout: "15s",
        });
        if (completed) {
          retryFinal = {
            id: retryPrediction.id,
            status: completed.data.status,
            output: completed.data.output ?? undefined,
            error: completed.data.error ?? undefined,
            metrics: completed.data.metrics,
          };
          break;
        }
        retryFinal = await step.run(`poll-prediction-retry-${cycle}`, async () => {
          if (!retryPrediction.id) throw new NonRetriableError("prediction_id manquant");
          return getPrediction(retryPrediction.id);
        });
      }
      if (retryFinal.status === "succeeded") {
        await step.run("persist-output-retry", async () => {
          const bytes = await fetchOutput(
            Array.isArray(retryFinal.output) ? retryFinal.output[0] : retryFinal.output,
          );
          await getBlobStore().put({ key: imageKey, body: bytes, contentType: "image/jpeg" });
          if (getEnv().BLOB_DRIVER === "fs") {
            await savePost(characterId, bytes, postId);
          }
        });
        const retryScore = await step.run("score-identity-retry", async () => {
          const centroid = await ensureCharacterCentroid({
            characterId,
            faceImageUrl: faceDataUri,
          });
          return scoreOutputAgainstCentroid({ imageKey, centroid });
        });
        if ((retryScore.score ?? -1) >= (identityScore.score ?? -1) || identityScore.score === null) {
          identityScore = retryScore;
          final = retryFinal;
        }
      }
    }

    await step.run("mark-identity", async () => {
      await markPostIdentity({
        postId,
        score: identityScore.score,
        status: identityScore.status,
        model: identityScore.model,
        attempts: generationAttempts,
      });
      await track(userId, {
        name: "identity_scored",
        props: {
          score: identityScore.score ?? -1,
          status: identityScore.status,
          model: identityScore.model ?? "",
          attempt: generationAttempts,
        },
      });
    });

    const caption = await step.run("write-caption", async () => {
      try {
        const niche = (await readNiche(characterId)) ?? {
          subject: "",
          audience: "",
          promise: "",
          tone: "",
        };
        return await writeCaption({
          name: character.name,
          formatLabel: postRow.sourceLabel,
          niche,
        });
      } catch {
        return "";
      }
    });

    const durationMs = await step.run("mark-succeeded", async () => {
      const jobRow = await getJobForOwner(jobId, userId);
      const started = jobRow?.queuedAt?.getTime() ?? Date.now();
      const ms = Math.max(0, Date.now() - started);
      await markPostSucceeded({ postId, imageKey, caption });
      await markJobSucceeded({
        jobId,
        durationMs: ms,
        providerMetrics: { predictTime: final.metrics?.predict_time },
      });
      return ms;
    });

    const job = await getJobForOwner(jobId, userId);
    await track(userId, {
      name: "post_generated",
      props: {
        durationMs,
        model: loraTarget?.version ?? MODEL,
        attempts: job?.attempts ?? 1,
      },
    });

    return { ok: true, postId, durationMs };
  },
);
