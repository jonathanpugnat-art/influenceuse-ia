import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import { processNextBatchSlice, getBatchStatus } from "@/server/services/batch.service";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  listBatchesInputSchema,
  batchIdInputSchema,
  processBatchSliceInputSchema,
  approveBatchInputSchema,
  discardBatchContentsInputSchema,
} from "@/server/trpc/schemas/content";

async function assertBatchOwnership(batchId: string, userId: string) {
  const user = await getDbUser(userId);
  const batch = await db.contentBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      influencer: { select: { userId: true, id: true, name: true } },
    },
  });
  if (!batch || batch.influencer.userId !== user.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
  }
  return { user, batch };
}

function asParamsRecord(
  value: unknown
): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

export const contentBatchRouter = createTRPCRouter({
  listBatches: protectedProcedure
    .input(listBatchesInputSchema)
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const batches = await db.contentBatch.findMany({
        where: {
          influencer: { userId: user.id },
          ...(input.influencerId ? { influencerId: input.influencerId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          influencer: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { contents: true } },
        },
      });

      const statuses = await Promise.all(
        batches.map((b) => getBatchStatus(b.id))
      );

      return batches.map((b, i) => ({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt,
        influencer: b.influencer,
        total: b._count.contents,
        status: statuses[i],
      }));
    }),

  getBatchStatus: protectedProcedure
    .input(batchIdInputSchema)
    .query(async ({ ctx, input }) => {
      await assertBatchOwnership(input.batchId, ctx.userId);
      const status = await getBatchStatus(input.batchId);
      if (!status) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }
      return status;
    }),

  /** List draft posts in a batch for lot validation (S5). */
  listBatchContents: protectedProcedure
    .input(batchIdInputSchema)
    .query(async ({ ctx, input }) => {
      const { batch } = await assertBatchOwnership(input.batchId, ctx.userId);

      const contents = await db.content.findMany({
        where: { batchId: input.batchId },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          status: true,
          caption: true,
          hashtags: true,
          platforms: true,
          scheduledAt: true,
          generationParams: true,
        },
      });

      return {
        batchId: batch.id,
        name: batch.name,
        influencer: {
          id: batch.influencer.id,
          name: batch.influencer.name,
        },
        contents: contents.map((c) => {
          const params = asParamsRecord(c.generationParams);
          return {
            id: c.id,
            type: c.type,
            status: c.status,
            caption: c.caption,
            hashtags: c.hashtags,
            platforms: c.platforms,
            scheduledAt: c.scheduledAt,
            hook: typeof params.hook === "string" ? params.hook : null,
            concept: typeof params.concept === "string" ? params.concept : null,
            trendItemId:
              typeof params.trendItemId === "string"
                ? params.trendItemId
                : null,
            approvedForBatch: params.approvedForBatch !== false,
            dayIndex:
              typeof params.dayIndex === "number" ? params.dayIndex : null,
            slotIndex:
              typeof params.slotIndex === "number" ? params.slotIndex : null,
          };
        }),
      };
    }),

  /**
   * Approve selected (or all) DRAFT posts in a batch for image generation.
   * Sets generationParams.approvedForBatch = true.
   */
  approveBatch: protectedProcedure
    .input(approveBatchInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBatchOwnership(input.batchId, ctx.userId);

      const drafts = await db.content.findMany({
        where: {
          batchId: input.batchId,
          status: "DRAFT",
          ...(input.contentIds ? { id: { in: input.contentIds } } : {}),
        },
        select: { id: true, generationParams: true },
      });

      if (drafts.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aucun brouillon à approuver dans ce lot.",
        });
      }

      await Promise.all(
        drafts.map((d) => {
          const params = asParamsRecord(d.generationParams);
          return db.content.update({
            where: { id: d.id },
            data: {
              generationParams: {
                ...params,
                approvedForBatch: true,
                approvedAt: new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
          });
        })
      );

      // Kick off a first image slice for this batch only.
      const slice = await processNextBatchSlice({
        batchId: input.batchId,
        sliceSize: 3,
      });

      return {
        approved: drafts.length,
        slice,
      };
    }),

  /** Soft-delete rejected posts from a pending lot (status → FAILED). */
  discardBatchContents: protectedProcedure
    .input(discardBatchContentsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBatchOwnership(input.batchId, ctx.userId);

      const { count } = await db.content.updateMany({
        where: {
          batchId: input.batchId,
          id: { in: input.contentIds },
          status: "DRAFT",
        },
        data: { status: "FAILED" },
      });

      return { discarded: count };
    }),

  processBatchSlice: protectedProcedure
    .input(processBatchSliceInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBatchOwnership(input.batchId, ctx.userId);

      const result = await processNextBatchSlice({
        sliceSize: input.sliceSize,
        batchId: input.batchId,
      });
      return result;
    }),

  retryBatchFailures: protectedProcedure
    .input(batchIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBatchOwnership(input.batchId, ctx.userId);

      const failed = await db.content.findMany({
        where: { batchId: input.batchId, status: "FAILED" },
        select: { id: true, generationParams: true },
      });

      await Promise.all(
        failed.map((d) => {
          const params = asParamsRecord(d.generationParams);
          return db.content.update({
            where: { id: d.id },
            data: {
              status: "DRAFT",
              generationParams: {
                ...params,
                // Retries stay approved so cron can pick them up.
                approvedForBatch: true,
              } as Prisma.InputJsonValue,
            },
          });
        })
      );

      return { reset: failed.length };
    }),
});
