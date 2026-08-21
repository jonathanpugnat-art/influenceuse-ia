import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  createSeedanceJob,
  reconcileSeedanceJob,
} from "@/server/services/seedance.service";
import {
  clampSeedanceDuration,
  clampSeedanceResolution,
  estimateSeedanceCredits,
  getSeedancePricingSnapshot,
  SEEDANCE_ALLOWED_DURATIONS,
  SEEDANCE_ALLOWED_RESOLUTIONS,
  type SeedanceDuration,
  type SeedanceResolution,
} from "@/lib/seedance-config";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const durationSchema = z.union([
  z.literal(10),
  z.literal(15),
  z.literal(30),
]);
const resolutionSchema = z.enum(SEEDANCE_ALLOWED_RESOLUTIONS);

const createSceneInputSchema = z.object({
  influencerId: z.string().min(1),
  scenePrompt: z.string().min(1).max(1200),
  extraPromptTail: z.string().max(300).optional().nullable(),
  duration: durationSchema.default(15),
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
   * Static pricing table. The client renders the full duration×resolution
   * matrix under the picker so the credit cost is visible BEFORE the
   * user opens the dropdown. Numbers here are the source of truth — the
   * mutation validates against the exact same estimator.
   */
  pricing: protectedProcedure.query(() => {
    return getSeedancePricingSnapshot();
  }),

  /**
   * Live cost quote. Cheap — no DB lookup. Used by the studio page for
   * the CTA label ("Générer — 540 crédits") and for the confirmation
   * modal on 30s picks.
   */
  estimate: protectedProcedure
    .input(
      z.object({
        duration: durationSchema,
        resolution: resolutionSchema,
      })
    )
    .query(({ input }) => {
      const duration = clampSeedanceDuration(input.duration);
      const resolution = clampSeedanceResolution(input.resolution);
      return {
        duration,
        resolution,
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

      // Video-tier feature — same gating as remix / talking-head.
      const planConfig = PLANS[user.plan as Plan];
      if (!planConfig.hasVideo) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "La vidéo scène Seedance nécessite le plan Pro ou Agency (accès vidéo).",
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

      const result = await createSeedanceJob({
        userId: user.id,
        influencerId: input.influencerId,
        scenePrompt: input.scenePrompt,
        extraPromptTail: input.extraPromptTail ?? null,
        requestedDuration: duration,
        requestedResolution: resolution,
        generateAudio: input.generateAudio,
      });

      return result;
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
      // Poll-on-read recovery: if the webhook was missed, nudge FAL.
      if (
        (job.status === "IN_PROGRESS" || job.status === "PENDING") &&
        job.falRequestId
      ) {
        void reconcileSeedanceJob(job.id);
      }
      return serializeSeedanceJob(job);
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
  return {
    id: job.id,
    influencerId: job.influencerId,
    mode: job.mode,
    durationSec: job.durationSec as SeedanceDuration,
    resolution: job.resolution as SeedanceResolution,
    aspectRatio: job.aspectRatio,
    generateAudio: job.generateAudio,
    status: job.status,
    creditsCharged: job.creditsHeld,
    outputVideoUrl: job.outputVideoUrl,
    error: job.error,
    prompt: job.prompt,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    // Echoed for the UI so a JobRow can render matching filters without
    // re-computing.
    allowedDurations: [...SEEDANCE_ALLOWED_DURATIONS] as number[],
    allowedResolutions: [...SEEDANCE_ALLOWED_RESOLUTIONS] as string[],
  };
}
