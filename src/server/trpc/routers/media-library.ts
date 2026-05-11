import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";

const kindSchema = z.enum(["IMAGE", "VIDEO", "AUDIO", "PRESET"]);

/**
 * Sprint 9 — Media Library.
 *
 * A reusable catalog of assets (uploaded media, generated images, presets).
 * Lets users group assets by tags, scope them to an influencer or keep them
 * global, and reuse them in any future content creation flow.
 */
export const mediaLibraryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          kind: kindSchema.optional(),
          influencerId: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const where: Parameters<typeof db.mediaAsset.findMany>[0] = {
        where: {
          userId: user.id,
          ...(input?.kind ? { kind: input.kind } : {}),
          ...(input?.influencerId ? { influencerId: input.influencerId } : {}),
          ...(input?.search
            ? {
                OR: [
                  { name: { contains: input.search, mode: "insensitive" } },
                  { tags: { has: input.search.toLowerCase() } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
      };
      return db.mediaAsset.findMany(where);
    }),

  add: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        kind: kindSchema,
        url: z.string().url(),
        thumbnailUrl: z.string().url().optional(),
        influencerId: z.string().optional(),
        tags: z.array(z.string()).max(20).default([]),
        sizeBytes: z.number().int().nonnegative().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      if (input.influencerId) {
        const inf = await db.influencer.findUnique({
          where: { id: input.influencerId },
          select: { userId: true },
        });
        if (!inf || inf.userId !== user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Influencer not yours" });
        }
      }

      return db.mediaAsset.create({
        data: {
          userId: user.id,
          name: input.name,
          kind: input.kind,
          url: input.url,
          thumbnailUrl: input.thumbnailUrl ?? null,
          influencerId: input.influencerId ?? null,
          tags: input.tags.map((t) => t.toLowerCase().trim()).filter(Boolean),
          sizeBytes: input.sizeBytes ?? null,
          // Prisma's JSON input type doesn't accept Record<string, unknown> directly.
          metadata: input.metadata
            ? (input.metadata as Parameters<typeof db.mediaAsset.create>[0]["data"]["metadata"])
            : undefined,
        },
      });
    }),

  updateTags: protectedProcedure
    .input(
      z.object({
        assetId: z.string(),
        tags: z.array(z.string()).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const asset = await db.mediaAsset.findUnique({
        where: { id: input.assetId },
      });
      if (!asset || asset.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }
      return db.mediaAsset.update({
        where: { id: asset.id },
        data: { tags: input.tags.map((t) => t.toLowerCase().trim()).filter(Boolean) },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ assetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const asset = await db.mediaAsset.findUnique({
        where: { id: input.assetId },
      });
      if (!asset || asset.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }
      await db.mediaAsset.delete({ where: { id: asset.id } });
      return { ok: true as const };
    }),

  /** Aggregated stats for the library landing card. */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    const grouped = await db.mediaAsset.groupBy({
      by: ["kind"],
      where: { userId: user.id },
      _count: true,
      _sum: { sizeBytes: true },
    });
    return grouped.map((g) => ({
      kind: g.kind,
      count: g._count,
      totalSize: g._sum.sizeBytes ?? 0,
    }));
  }),
});
