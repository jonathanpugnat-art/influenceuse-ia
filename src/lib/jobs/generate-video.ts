import { NonRetriableError } from "inngest";

import { getBlobStore } from "@/lib/blob";
import { detectVideoType, postKey, videoKey } from "@/lib/blob/keys";
import { getEnv } from "@/lib/env";
import { inngest, type VideoRequestedData } from "@/lib/jobs/inngest";
import { track } from "@/lib/observability/analytics";
import {
  getJobForOwner,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
  markPostFailed,
  markPostSucceeded,
  refundCredits,
} from "@/lib/repositories/db/jobs";
import { getOwnedPost } from "@/lib/repositories/db/posts";
import {
  cancelPrediction,
  fetchOutput,
  getPrediction,
  ReplicateError,
} from "@/lib/replicate/client";
import { getOwnedCharacter, readPost, saveVideoPost } from "@/lib/storage";
import { createVideoPrediction, KLING_MODEL } from "@/lib/video/provider";

export const generateVideo = inngest.createFunction(
  {
    id: "generate-video",
    triggers: [{ event: "ofmia/video.requested" }],
    retries: 2,
    concurrency: [
      { key: "event.data.userId", limit: 1 },
      { limit: 5 },
    ],
    timeouts: { start: "30s", finish: "12m" },
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as VideoRequestedData | undefined;
      if (!data?.jobId) {
        console.error("onFailure video: jobId manquant", error);
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
        name: "video_failed",
        props: { errorCode: "generation_failed" },
      });
    },
  },
  async ({ event, step }) => {
    const { jobId, postId, characterId, userId, parentPostId } =
      event.data as VideoRequestedData;

    const postRow = await step.run("load-video-post", async () =>
      getOwnedPost(userId, characterId, postId),
    );
    if (!postRow) throw new NonRetriableError("post manquant");

    const parent = await step.run("load-parent-post", async () =>
      getOwnedPost(userId, characterId, parentPostId),
    );
    if (!parent || parent.status !== "succeeded" || parent.mediaKind !== "image") {
      throw new NonRetriableError("parent image manquant");
    }

    const character = await step.run("load-character", async () =>
      getOwnedCharacter(characterId, userId),
    );
    if (!character) throw new NonRetriableError("character manquant");

    const startImage = await step.run("resolve-start-image", async () => {
      const store = getBlobStore();
      const key = parent.imageKey ?? postKey(userId, characterId, parentPostId);
      try {
        const signed = await store.presignGet(key, { expiresInSeconds: 900 });
        if (signed.startsWith("https://")) return signed;
      } catch {
        // fall through to bytes
      }
      const fromBlob = await store.get(key);
      const bytes = fromBlob ?? (await readPost(characterId, parentPostId));
      if (!bytes) throw new NonRetriableError("image source manquante");
      return `data:image/jpeg;base64,${bytes.toString("base64")}`;
    });

    const created = await step.run("create-video-prediction", async () => {
      try {
        const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
        const webhook =
          base && /^https:\/\//i.test(base)
            ? `${base}/api/webhooks/replicate`
            : undefined;
        const result = await createVideoPrediction({
          startImageUrl: startImage,
          prompt: postRow.prompt,
          webhook,
          prefer: KLING_MODEL,
        });
        if (!result.prediction.id) throw new NonRetriableError("prediction_id manquant");
        await markJobRunning(jobId, result.prediction.id);
        return {
          id: result.prediction.id,
          status: result.prediction.status ?? "starting",
          output: result.prediction.output,
          error: result.prediction.error,
          metrics: result.prediction.metrics,
          model: result.model,
        };
      } catch (error) {
        if (error instanceof ReplicateError && !error.retriable) {
          throw new NonRetriableError(error.code);
        }
        throw error;
      }
    });

    // Poll inside one step — local Inngest step.sleep wakes were stalling after a few cycles.
    const final = await step.run("await-video-prediction", async () => {
      const deadline = Date.now() + 10 * 60_000;
      let latest = {
        id: created.id,
        status: created.status,
        output: created.output,
        error: created.error,
        metrics: created.metrics,
        model: created.model,
      };
      while (Date.now() < deadline) {
        if (
          latest.status === "succeeded" ||
          latest.status === "failed" ||
          latest.status === "canceled"
        ) {
          return latest;
        }
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        const polled = await getPrediction(created.id);
        latest = {
          id: created.id,
          status: polled.status ?? "starting",
          output: polled.output,
          error: polled.error,
          metrics: polled.metrics,
          model: created.model,
        };
      }
      return latest;
    });

    if (final.status !== "succeeded") {
      if (created.id) {
        await step.run("cancel-video-prediction", async () => cancelPrediction(created.id));
      }
      await step.run("mark-video-timeout", async () => {
        await markJobFailed({ jobId, status: "timed_out", errorCode: "timeout" });
        await markPostFailed(postId);
        await refundCredits({ userId, jobId });
      });
      await track(userId, { name: "video_failed", props: { errorCode: "timeout" } });
      return { ok: false };
    }

    const mediaKey = videoKey(userId, characterId, postId);
    await step.run("persist-video", async () => {
      const bytes = await fetchOutput(
        Array.isArray(final.output) ? final.output[0] : final.output,
        { timeoutMs: 120_000 },
      );
      if (!detectVideoType(bytes)) {
        throw new NonRetriableError("output_not_mp4");
      }
      await getBlobStore().put({ key: mediaKey, body: bytes, contentType: "video/mp4" });
      if (getEnv().BLOB_DRIVER === "fs") {
        await saveVideoPost(characterId, bytes, postId);
      }
    });

    const durationMs = await step.run("mark-video-succeeded", async () => {
      const jobRow = await getJobForOwner(jobId, userId);
      const started = jobRow?.queuedAt?.getTime() ?? Date.now();
      const ms = Math.max(0, Date.now() - started);
      await markPostSucceeded({
        postId,
        imageKey: mediaKey,
        contentType: "video/mp4",
        mediaKind: "video",
        caption: parent.caption ?? undefined,
      });
      await markJobSucceeded({
        jobId,
        durationMs: ms,
        providerMetrics: { predictTime: final.metrics?.predict_time },
      });
      return ms;
    });

    const job = await getJobForOwner(jobId, userId);
    await track(userId, {
      name: "video_generated",
      props: { durationMs, model: created.model, attempts: job?.attempts ?? 1 },
    });

    return { ok: true, postId, durationMs, model: created.model };
  },
);
