import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  createRemixJob,
  reconcileRemixJob,
} from "@/server/services/remix.service";
import {
  clampRemixDuration,
  estimateRemixCreditsForTier,
  REMIX_ALLOWED_DURATIONS,
  REMIX_TIER_VALUES,
  REMIX_TIERS,
  resolveRemixOembedProvider,
  validateRemixSource,
  type RemixDuration,
} from "@/lib/remix-config";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const durationSchema = z.union([z.literal(5), z.literal(10), z.literal(15)]);

const createRemixInputSchema = z.object({
  influencerId: z.string().min(1),
  tier: z.enum(REMIX_TIER_VALUES).default("standard"),
  sourceVideoUrl: z.string().url(),
  /**
   * Duration reported by the browser via the `<video>` element. Optional
   * because some browsers block metadata on cross-origin sources; the server
   * clamps against it when present and falls back to the requested value.
   */
  sourceDurationSec: z.number().positive().max(30).nullable().optional(),
  sourceMimeType: z.string().optional(),
  sourceSizeBytes: z.number().int().positive().optional(),
  duration: durationSchema.default(10),
  keepAudio: z.boolean().default(true),
  extraPromptTail: z.string().max(300).optional().nullable(),
  oembedPreview: z
    .object({
      title: z.string().max(300).optional(),
      authorName: z.string().max(200).optional(),
      providerName: z.string().max(80).optional(),
      thumbnailUrl: z.string().url().optional(),
      url: z.string().url().optional(),
    })
    .partial()
    .optional(),
});

const oembedInputSchema = z.object({
  url: z.string().url(),
});

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const remixRouter = createTRPCRouter({
  /**
   * Static pricing info for the UI — surfaces credits/s per tier so the
   * client can preview the cost before submitting the mutation.
   */
  pricing: protectedProcedure.query(() => {
    return {
      tiers: REMIX_TIER_VALUES.map((tier) => ({
        id: tier,
        label: REMIX_TIERS[tier].label,
        creditsPerSec: REMIX_TIERS[tier].creditsPerSec,
      })),
      allowedDurations: [...REMIX_ALLOWED_DURATIONS] as number[],
    };
  }),

  estimate: protectedProcedure
    .input(
      z.object({
        tier: z.enum(REMIX_TIER_VALUES),
        duration: durationSchema,
        sourceDurationSec: z.number().positive().nullable().optional(),
      })
    )
    .query(({ input }) => {
      const duration = clampRemixDuration(
        input.duration,
        input.sourceDurationSec ?? null
      );
      return {
        duration,
        credits: estimateRemixCreditsForTier(input.tier, duration),
      };
    }),

  /**
   * Cheap oEmbed preview — TITLE / COVER only. We never scrape media.
   * Only TikTok public oEmbed is called; Instagram requires a Meta App
   * token so we short-circuit with a "not supported" hint.
   */
  oembedPreview: protectedProcedure
    .input(oembedInputSchema)
    .query(async ({ input }) => {
      const provider = resolveRemixOembedProvider(input.url);
      if (!provider) {
        return {
          available: false,
          reason: "unsupported_provider" as const,
        };
      }
      if (provider.provider !== "tiktok") {
        return {
          available: false,
          provider: provider.provider,
          reason: "provider_requires_auth" as const,
        };
      }
      try {
        const res = await fetch(provider.endpoint(input.url), {
          method: "GET",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(6_000),
        });
        if (!res.ok) {
          return { available: false, reason: "upstream_error" as const };
        }
        const body = (await res.json()) as {
          title?: string;
          author_name?: string;
          provider_name?: string;
          thumbnail_url?: string;
        };
        return {
          available: true,
          provider: provider.provider,
          preview: {
            title: body.title ?? undefined,
            authorName: body.author_name ?? undefined,
            providerName: body.provider_name ?? provider.provider,
            thumbnailUrl: body.thumbnail_url ?? undefined,
            url: input.url,
          },
        };
      } catch {
        return { available: false, reason: "upstream_error" as const };
      }
    }),

  createRemix: protectedProcedure
    .input(createRemixInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      // Remix is a video-tier feature. FREE / STARTER don't see the page,
      // but tRPC is the source of truth so we gate here too.
      const planConfig = PLANS[user.plan as Plan];
      if (!planConfig.hasVideo) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Le remix viral nécessite le plan Pro ou Agency (accès vidéo).",
        });
      }

      const sourceIssue = validateRemixSource({
        mimeType: input.sourceMimeType ?? null,
        sizeBytes: input.sourceSizeBytes ?? null,
        durationSec: input.sourceDurationSec ?? null,
        url: input.sourceVideoUrl,
      });
      if (sourceIssue) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: sourceIssue.message,
        });
      }

      const result = await createRemixJob({
        userId: user.id,
        influencerId: input.influencerId,
        tier: input.tier,
        sourceVideoUrl: input.sourceVideoUrl,
        sourceDurationSec: input.sourceDurationSec ?? null,
        requestedDuration: input.duration,
        keepAudio: input.keepAudio,
        extraPromptTail: input.extraPromptTail ?? null,
        oembedPreview: input.oembedPreview,
      });

      return result;
    }),

  getRemix: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const job = await db.remixJob.findFirst({
        where: { id: input.jobId, userId: user.id },
      });
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job introuvable" });
      }
      // Poll-on-read recovery: if the webhook was missed, nudge FAL forward.
      if (job.status === "IN_PROGRESS" && job.falRequestId) {
        void reconcileRemixJob(job.id);
      }
      return serializeRemixJob(job);
    }),

  listRemixes: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const jobs = await db.remixJob.findMany({
        where: {
          userId: user.id,
          ...(input.influencerId
            ? { influencerId: input.influencerId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      return jobs.map(serializeRemixJob);
    }),
});

function serializeRemixJob(job: {
  id: string;
  influencerId: string;
  tier: string;
  durationSec: number;
  sourceDurationSec: number | null;
  sourceVideoUrl: string;
  keepAudio: boolean;
  status: string;
  creditsHeld: number;
  outputVideoUrl: string | null;
  error: string | null;
  oembedPreview: unknown;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: job.id,
    influencerId: job.influencerId,
    tier: job.tier as (typeof REMIX_TIER_VALUES)[number],
    durationSec: job.durationSec as RemixDuration,
    sourceDurationSec: job.sourceDurationSec,
    sourceVideoUrl: job.sourceVideoUrl,
    keepAudio: job.keepAudio,
    status: job.status,
    creditsCharged: job.creditsHeld,
    outputVideoUrl: job.outputVideoUrl,
    error: job.error,
    oembedPreview: job.oembedPreview,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}
