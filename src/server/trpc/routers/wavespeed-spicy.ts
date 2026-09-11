import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";
import {
  clampWavespeedSpicyDuration,
  clampWavespeedSpicyResolution,
  estimateWavespeedSpicyCredits,
  getWavespeedSpicyPricingSnapshot,
  isWavespeedApiConfigured,
  isWavespeedSpicyReachable,
  NSFW_ENGINE_UNREACHABLE_MESSAGE,
  WAVESPEED_SPICY_ALLOWED_RESOLUTIONS,
} from "@/lib/wavespeed-spicy-config";
import {
  createWavespeedSpicyJob,
  reconcileWavespeedSpicyJob,
} from "@/server/services/wavespeed-spicy.service";
import {
  failStaleVideoJobs,
  isOpenVideoJobStatus,
  settleOpenWavespeedSpicyJobIfStale,
} from "@/server/services/stale-video-job.service";

const durationSchema = z.union([z.literal(5), z.literal(8)]);
const resolutionSchema = z.enum(WAVESPEED_SPICY_ALLOWED_RESOLUTIONS);

const createInputSchema = z.object({
  influencerId: z.string().min(1),
  prompt: z.string().min(1).max(1200),
  duration: durationSchema.default(5),
  resolution: resolutionSchema.default("720p"),
  consentAccepted: z
    .literal(true)
    .refine((v) => v === true, "Consentement obligatoire."),
  quotedCredits: z.number().int().min(0).max(10_000).optional(),
});

function assertReachable() {
  if (!isWavespeedSpicyReachable()) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: NSFW_ENGINE_UNREACHABLE_MESSAGE,
    });
  }
}

export const wavespeedSpicyRouter = createTRPCRouter({
  /**
   * Visibility + pricing. Flag off → reachable=false (UI hidden).
   * Flag on without key → reachable=true, configured=false (fail-closed toast).
   */
  availability: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    const planConfig = PLANS[user.plan as Plan];
    const reachable = isWavespeedSpicyReachable();
    const configured = isWavespeedApiConfigured();
    const planAllowed = planConfig.hasNsfw;
    if (!reachable) {
      return {
        reachable: false as const,
        configured: false,
        planAllowed,
        pricing: null,
      };
    }
    return {
      reachable: true as const,
      configured,
      planAllowed,
      pricing: getWavespeedSpicyPricingSnapshot(),
    };
  }),

  estimate: protectedProcedure
    .input(
      z.object({
        duration: durationSchema,
        resolution: resolutionSchema.optional(),
      })
    )
    .query(({ input }) => {
      assertReachable();
      const duration = clampWavespeedSpicyDuration(input.duration);
      const resolution = clampWavespeedSpicyResolution(input.resolution);
      return {
        duration,
        resolution,
        credits: estimateWavespeedSpicyCredits(resolution, duration),
      };
    }),

  createJob: protectedProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertReachable();
      const user = await getDbUser(ctx.userId);
      const duration = clampWavespeedSpicyDuration(input.duration);
      const resolution = clampWavespeedSpicyResolution(input.resolution);
      const cost = estimateWavespeedSpicyCredits(resolution, duration);
      if (
        typeof input.quotedCredits === "number" &&
        input.quotedCredits !== cost
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Le prix a changé (${input.quotedCredits} → ${cost} crédits). Relance la génération pour confirmer.`,
        });
      }
      return createWavespeedSpicyJob({
        userId: user.id,
        plan: user.plan as Plan,
        influencerId: input.influencerId,
        prompt: input.prompt,
        requestedDuration: duration,
        requestedResolution: resolution,
        consentAccepted: input.consentAccepted,
      });
    }),

  getJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertReachable();
      const user = await getDbUser(ctx.userId);
      const job = await db.wavespeedSpicyJob.findFirst({
        where: { id: input.jobId, userId: user.id },
      });
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Génération adulte introuvable.",
        });
      }
      const settled = await settleOpenWavespeedSpicyJobIfStale(job);
      if (
        isOpenVideoJobStatus(settled.status) &&
        settled.wavespeedPredictionId
      ) {
        void reconcileWavespeedSpicyJob(settled.id);
      }
      return serializeJob(settled);
    }),

  listJobs: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      assertReachable();
      const user = await getDbUser(ctx.userId);
      await failStaleVideoJobs({ userId: user.id }).catch((err) => {
        console.warn("[wavespeed-spicy.listJobs] stale sweep failed:", err);
      });
      const jobs = await db.wavespeedSpicyJob.findMany({
        where: {
          userId: user.id,
          ...(input.influencerId
            ? { influencerId: input.influencerId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      return jobs.map(serializeJob);
    }),
});

function serializeJob(job: {
  id: string;
  influencerId: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  status: string;
  creditsHeld: number;
  outputVideoUrl: string | null;
  error: string | null;
  prompt: string;
  isSynthetic: boolean;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: job.id,
    influencerId: job.influencerId,
    durationSec: job.durationSec,
    resolution: job.resolution,
    aspectRatio: job.aspectRatio,
    status: job.status,
    creditsCharged: job.creditsHeld,
    outputVideoUrl: job.outputVideoUrl,
    error: job.error,
    prompt: job.prompt,
    isSynthetic: job.isSynthetic,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}
