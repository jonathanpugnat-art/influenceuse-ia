import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import {
  listRecycleCandidates,
  recyclePost,
} from "@/server/services/content-recycler.service";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  listRecycleCandidatesInputSchema,
  recyclePostInputSchema,
} from "@/server/trpc/schemas/content";

export const contentRecycleRouter = createTRPCRouter({
  listRecycleCandidates: protectedProcedure
    .input(listRecycleCandidatesInputSchema)
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      return await listRecycleCandidates(user.id, input?.influencerId);
    }),

  recyclePost: protectedProcedure
    .input(recyclePostInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const newContentId = await recyclePost({
        userId: user.id,
        sourceContentId: input.sourceContentId,
        scheduledFor: input.scheduledFor,
        language: input.language,
      });
      return { contentId: newContentId };
    }),
});
