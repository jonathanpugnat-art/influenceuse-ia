import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { processNextBatchSlice, getBatchStatus } from "@/server/services/batch.service";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  listBatchesInputSchema,
  batchIdInputSchema,
  processBatchSliceInputSchema,
} from "@/server/trpc/schemas/content";

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
      const user = await getDbUser(ctx.userId);

      const batch = await db.contentBatch.findUnique({
        where: { id: input.batchId },
        select: {
          id: true,
          influencer: { select: { userId: true } },
        },
      });
      if (!batch || batch.influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }

      const status = await getBatchStatus(input.batchId);
      if (!status) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }
      return status;
    }),

  processBatchSlice: protectedProcedure
    .input(processBatchSliceInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const batch = await db.contentBatch.findUnique({
        where: { id: input.batchId },
        select: { id: true, influencer: { select: { userId: true } } },
      });
      if (!batch || batch.influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }

      const result = await processNextBatchSlice({ sliceSize: input.sliceSize });
      return result;
    }),

  retryBatchFailures: protectedProcedure
    .input(batchIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const batch = await db.contentBatch.findUnique({
        where: { id: input.batchId },
        select: { id: true, influencer: { select: { userId: true } } },
      });
      if (!batch || batch.influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }

      const { count } = await db.content.updateMany({
        where: { batchId: input.batchId, status: "FAILED" },
        data: { status: "DRAFT" },
      });

      return { reset: count };
    }),
});
