import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  createSeedanceJob,
  reconcileSeedanceJob,
} from "@/server/services/seedance.service";
import { createKlingSceneJob } from "@/server/services/kling-scene.service";
import {
  failStaleVideoJobs,
  isOpenVideoJobStatus,
  settleOpenSeedanceJobIfStale,
} from "@/server/services/stale-video-job.service";
import {
  clampSeedanceDuration,
  clampSeedanceResolution,
  estimateSeedanceCredits,
  SEEDANCE_ALLOWED_RESOLUTIONS,
  type SeedanceDuration,
  type SeedanceResolution,
} from "@/lib/seedance-config";
import {
  clampKlingSceneDuration,
  estimateKlingSceneCredits,
  getSceneEngine,
  getScenePricingSnapshot,
  KLING_SCENE_ALLOWED_DURATIONS,
  type KlingSceneDuration,
} from "@/lib/scene-engine";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const durationSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(30),
]);
const resolutionSchema = z.enum(SEEDANCE_ALLOWED_RESOLUTIONS);

const createSceneInputSchema = z.object({
  influencerId: z.string().min(1),
  scenePrompt: z.string().min(1).max(1200),
  extraPromptTail: z.string().max(300).optional().nullable(),
  duration: durationSchema.default(10),
  resolution: resolutionSchema.default("720p"),
  generateAudio: z.boolean().default(true),
  /**
   * Client-side reconciliation: the UI captures the price shown to the
   * user just before pressing Generate. If our server-side estimate does
   * not match (rare — happens when a duration/resolution shift lands
   * between quote and submit) we refuse the mutation to keep the "price
   * you saw = price billed" invariant.
   */
  quotedCredits: z.number().int().min(0).max(10_000).optional(),
});

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const seedanceRouter = createTRPCRouter({
  /**
   * Static pricing table. Kling O3 I2V by default (`SCENE_ENGINE`);
   * Seedance snapshot only when the pause flag is flipped back on.
   */
  pricing: protectedProcedure.query(() => {
    return getScenePricingSnapshot();
  }),

  /**
   * Live cost quote. Cheap — no DB lookup. Used by the studio page for
   * the CTA label ("Générer — 80 crédits").
   */
  estimate: protectedProcedure
    .input(
      z.object({
        duration: durationSchema,
        resolution: resolutionSchema.optional(),
        generateAudio: z.boolean().optional(),
      })
    )
    .query(({ input }) => {
      if (getSceneEngine() === "kling_o3_i2v") {
        const duration = clampKlingSceneDuration(input.duration);
        const generateAudio = input.generateAudio ?? true;
        return {
          engine: "kling_o3_i2v" as const,
          duration,
          resolution: null,
          generateAudio,
          credits: estimateKlingSceneCredits(duration, generateAudio),
        };
      }
      const duration = clampSeedanceDuration(input.duration);
      const resolution = clampSeedanceResolution(input.resolution);
      return {
        engine: "seedance" as const,
        duration,
        resolution,
        generateAudio: input.generateAudio ?? true,
        credits: estimateSeedanceCredits(resolution, duration),
      };
    }),

  /**
   * Kick off a scene render. Returns the job id + real cost so the UI
   * can start polling `getScene` on a short interval until the webhook
   * updates the row.
   */
  createScene: protectedProcedure
    .input(createSceneInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const planConfig = PLANS[user.plan as Plan];
      if (!planConfig.hasVideo) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "La vidéo scène nécessite le plan Pro ou Agency (accès vidéo).",
        });
      }

      if (getSceneEngine() === "kling_o3_i2v") {
        if (
          !(KLING_SCENE_ALLOWED_DURATIONS as readonly number[]).includes(
            input.duration
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Durée non supportée. Choisis 5, 10 ou 15 secondes.",
          });
        }
        const duration = clampKlingSceneDuration(input.duration);
        const cost = estimateKlingSceneCredits(duration, input.generateAudio);
        if (
          typeof input.quotedCredits === "number" &&
          input.quotedCredits !== cost
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Le prix a changé (${input.quotedCredits} → ${cost} crédits). Relance la génération pour confirmer.`,
          });
        }
        return createKlingSceneJob({
          userId: user.id,
          influencerId: input.influencerId,
          scenePrompt: input.scenePrompt,
          extraPromptTail: input.extraPromptTail ?? null,
          requestedDuration: duration,
          generateAudio: input.generateAudio,
        });
      }

      const duration = clampSeedanceDuration(input.duration);
      const resolution = clampSeedanceResolution(input.resolution);
      const cost = estimateSeedanceCredits(resolution, duration);
      if (
        typeof input.quotedCredits === "number" &&
        input.quotedCredits !== cost
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Le prix a changé (${input.quotedCredits} → ${cost} crédits). Relance la génération pour confirmer.`,
        });
      }

      return createSeedanceJob({
        userId: user.id,
        influencerId: input.influencerId,
        scenePrompt: input.scenePrompt,
        extraPromptTail: input.extraPromptTail ?? null,
        requestedDuration: duration,
        requestedResolution: resolution,
        generateAudio: input.generateAudio,
      });
    }),

  getScene: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const job = await db.seedanceJob.findFirst({
        where: { id: input.jobId, userId: user.id },
      });
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scène introuvable.",
        });
      }
      const settled = await settleOpenSeedanceJobIfStale(job);
      if (isOpenVideoJobStatus(settled.status) && settled.falRequestId) {
        void reconcileSeedanceJob(settled.id);
      }
      return serializeSeedanceJob(settled);
    }),

  listScenes: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      await failStaleVideoJobs({ userId: user.id }).catch((err) => {
        console.warn("[seedance.listScenes] stale sweep failed:", err);
      });
      const jobs = await db.seedanceJob.findMany({
        where: {
          userId: user.id,
          ...(input.influencerId
            ? { influencerId: input.influencerId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      return jobs.map(serializeSeedanceJob);
    }),
});

// ──────────────────────────────────────────────
// Serialisation
// ──────────────────────────────────────────────

function serializeSeedanceJob(job: {
  id: string;
  influencerId: string;
  mode: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  generateAudio: boolean;
  status: string;
  creditsHeld: number;
  outputVideoUrl: string | null;
  error: string | null;
  prompt: string;
  createdAt: Date;
  completedAt: Date | null;
}) {
  const snapshot = getScenePricingSnapshot();
  return {
    id: job.id,
    influencerId: job.influencerId,
    mode: job.mode,
    durationSec: job.durationSec as SeedanceDuration | KlingSceneDuration,
    resolution: job.resolution as SeedanceResolution | "standard",
    aspectRatio: job.aspectRatio,
    generateAudio: job.generateAudio,
    status: job.status,
    creditsCharged: job.creditsHeld,
    outputVideoUrl: job.outputVideoUrl,
    error: job.error,
    prompt: job.prompt,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    allowedDurations: snapshot.allowedDurations,
    allowedResolutions: snapshot.allowedResolutions,
  };
}
