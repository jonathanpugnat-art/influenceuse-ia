import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";

import { getBlobStore } from "@/lib/blob";
import { refKey } from "@/lib/blob/keys";
import { getDb } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { anglePrompt } from "@/lib/identity/angle-prompts";
import type { FaceAngle } from "@/lib/identity/angles";
import { pickAngleSources } from "@/lib/identity/angles";
import { inngest, type IdentityRefsRequestedData } from "@/lib/jobs/inngest";
import { upsertRef } from "@/lib/repositories/db/face-refs";
import {
  createPrediction,
  fetchOutput,
  getPrediction,
  ReplicateError,
} from "@/lib/replicate/client";
import type { ImageContentType } from "@/lib/storage-ids";

const KONTEXT = "black-forest-labs/flux-kontext-pro";
const ANGLES: FaceAngle[] = ["front", "three_quarter_left", "three_quarter_right"];

export const buildIdentityRefs = inngest.createFunction(
  {
    id: "build-identity-refs",
    triggers: [{ event: "ofmia/identity.refs.requested" }],
    retries: 1,
    timeouts: { start: "30s", finish: "8m" },
  },
  async ({ event, step }) => {
    const { characterId, userId } = event.data as IdentityRefsRequestedData;
    if (!getEnv().IDENTITY_REFS_ENABLED) {
      return { ok: true, skipped: true };
    }

    const character = await step.run("load-character", async () => {
      const db = getDb();
      const rows = await db
        .select()
        .from(characters)
        .where(eq(characters.id, characterId))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!character || character.ownerId !== userId) {
      throw new NonRetriableError("character manquant");
    }

    const blob = getBlobStore();
    await step.run("ensure-face", async () => {
      const faceBytes = await blob.get(character.faceKey);
      if (!faceBytes) throw new NonRetriableError("visage manquant");
    });

    await step.run("upsert-front", async () => {
      await upsertRef({
        characterId,
        ownerId: userId,
        angle: "front",
        key: character.faceKey,
        contentType: character.faceContentType,
        origin: "face",
      });
    });

    if (character.door === "clone" && character.sources.length > 0) {
      await step.run("pick-clone-sources", async () => {
        const candidates = character.sources.map((source, index) => ({
          key: source.key,
          contentType: source.contentType,
          yaw: index === 0 ? 0 : index % 2 === 0 ? 0.25 : -0.25,
        }));
        const picked = pickAngleSources(candidates);
        for (const angle of ANGLES) {
          if (angle === "front") continue;
          const candidate = picked[angle];
          if (!candidate) continue;
          await upsertRef({
            characterId,
            ownerId: userId,
            angle,
            key: candidate.key,
            contentType: candidate.contentType as ImageContentType,
            origin: "source",
          });
        }
        // Fill gaps from remaining sources
        for (const angle of ANGLES) {
          if (angle === "front") continue;
          const existing = picked[angle];
          if (existing) continue;
          const fallback = character.sources[angle === "three_quarter_left" ? 1 : 2];
          if (!fallback) continue;
          await upsertRef({
            characterId,
            ownerId: userId,
            angle,
            key: fallback.key,
            contentType: fallback.contentType,
            origin: "source",
          });
        }
      });
      return { ok: true, door: "clone" };
    }

    // Builder: generate missing three-quarter angles via Kontext when possible
    const faceUrl = await step.run("face-url", async () => {
      try {
        return await blob.presignGet(character.faceKey, { expiresInSeconds: 600 });
      } catch {
        const bytes = await blob.get(character.faceKey);
        if (!bytes) throw new NonRetriableError("visage manquant");
        return `data:${character.faceContentType};base64,${bytes.toString("base64")}`;
      }
    });

    for (const angle of ["three_quarter_left", "three_quarter_right"] as const) {
      await step.run(`generate-${angle}`, async () => {
        try {
          let prediction = await createPrediction({
            model: KONTEXT,
            body: {
              prompt: anglePrompt(angle),
              input_image: faceUrl,
              aspect_ratio: "3:4",
              output_format: "jpg",
              output_quality: 90,
            },
            waitSeconds: 60,
          });
          for (let i = 0; i < 20 && prediction.status !== "succeeded"; i += 1) {
            if (
              prediction.status === "failed" ||
              prediction.status === "canceled" ||
              !prediction.id
            ) {
              throw new Error("prediction failed");
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
            prediction = await getPrediction(prediction.id);
          }
          if (prediction.status !== "succeeded") throw new Error("timeout");
          const bytes = await fetchOutput(
            Array.isArray(prediction.output) ? prediction.output[0] : prediction.output,
          );
          const key = refKey(userId, characterId, angle, "image/jpeg");
          await blob.put({ key, body: bytes, contentType: "image/jpeg" });
          await upsertRef({
            characterId,
            ownerId: userId,
            angle,
            key,
            contentType: "image/jpeg",
            origin: "generated",
          });
        } catch (error) {
          if (error instanceof ReplicateError) {
            console.error("angle generation failed", angle, error.code);
          } else {
            console.error("angle generation failed", angle, error);
          }
          // Fallback: reuse face
          await upsertRef({
            characterId,
            ownerId: userId,
            angle,
            key: character.faceKey,
            contentType: character.faceContentType,
            origin: "face",
          });
        }
      });
    }

    return { ok: true, door: "builder" };
  },
);
