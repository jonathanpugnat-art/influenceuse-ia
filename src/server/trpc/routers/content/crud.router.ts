import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { createZipBundleFromUrls } from "@/server/services/storage.service";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  updateContentInputSchema,
  getAllContentInputSchema,
  contentIdInputSchema,
} from "@/server/trpc/schemas/content";
import { verifyContentOwnership } from "@/server/trpc/helpers/content/verify-content-ownership";

export const contentCrudRouter = createTRPCRouter({
  updateContent: protectedProcedure
    .input(updateContentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { contentId, ...data } = input;
      await verifyContentOwnership(contentId, ctx.userId);

      const content = await db.content.update({
        where: { id: contentId },
        data,
      });

      return content;
    }),

  deleteContent: protectedProcedure
    .input(contentIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyContentOwnership(input.contentId, ctx.userId);

      await db.content.delete({ where: { id: input.contentId } });

      return { success: true };
    }),

  getAll: protectedProcedure
    .input(getAllContentInputSchema)
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const { influencerId, type, status, platform, page, limit } = input;

      const where = {
        influencer: { userId: user.id },
        ...(influencerId ? { influencerId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(platform ? { platforms: { has: platform } } : {}),
      };

      const [contents, total] = await Promise.all([
        db.content.findMany({
          where,
          include: {
            influencer: {
              select: { id: true, name: true, slug: true, niche: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.content.count({ where }),
      ]);

      return { contents, total, page, totalPages: Math.ceil(total / limit) };
    }),

  getById: protectedProcedure
    .input(contentIdInputSchema)
    .query(async ({ ctx, input }) => {
      const { content } = await verifyContentOwnership(input.contentId, ctx.userId);

      const full = await db.content.findUnique({
        where: { id: content.id },
        include: {
          influencer: true,
          publishResults: true,
          contentAnalytics: true,
        },
      });

      return full;
    }),

  prepareOnlyFansBundle: protectedProcedure
    .input(contentIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { content } = await verifyContentOwnership(input.contentId, ctx.userId);

      const full = await db.content.findUnique({
        where: { id: content.id },
        select: { mediaUrls: true, caption: true, hashtags: true },
      });

      if (!full || full.mediaUrls.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No media to bundle" });
      }

      const files = full.mediaUrls.map((url, i) => ({
        url,
        filename: `photo-${i + 1}.webp`,
      }));

      const captionText = [
        full.caption ?? "",
        "",
        full.hashtags.length > 0 ? full.hashtags.map((h) => `#${h}`).join(" ") : "",
      ].join("\n");

      const zipUrl = await createZipBundleFromUrls(files, captionText);

      return { downloadUrl: zipUrl };
    }),
});
