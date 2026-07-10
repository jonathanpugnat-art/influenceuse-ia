import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  generateCaption as genCaption,
  generateHashtags as genHashtags,
  generateContentPlan as genContentPlan,
  generateIdeas as genIdeas,
} from "@/server/services/ai-text.service";
import { checkCredits } from "@/server/services/credits.service";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  generateCaptionInputSchema,
  generateHashtagsInputSchema,
  generateContentPlanInputSchema,
  generateIdeasInputSchema,
  generateCaptionVariantsInputSchema,
} from "@/server/trpc/schemas/content";

export const contentTextRouter = createTRPCRouter({
  generateCaption: protectedProcedure
    .input(generateCaptionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      const caption = await genCaption(user.id, {
        influencerName: influencer.name,
        personality: influencer.personality,
        niche: influencer.niche,
        platform: input.platform,
        contentDescription: input.contentDescription,
        language: input.language,
        influencerId: influencer.id,
      });

      return { caption };
    }),

  generateHashtags: protectedProcedure
    .input(generateHashtagsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const hashtags = await genHashtags(user.id, {
        niche: input.niche,
        platform: input.platform,
        description: input.description,
        count: input.count,
      });

      return { hashtags };
    }),

  generateContentPlan: protectedProcedure
    .input(generateContentPlanInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      const totalPosts = input.days * input.postsPerDay;
      const cost = +(CREDIT_COSTS.CONTENT_PLAN_PER_POST * totalPosts).toFixed(2);
      const hasCredits = await checkCredits(user.id, cost);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost} crédits.`,
        });
      }

      const plan = await genContentPlan(user.id, {
        influencerName: influencer.name,
        influencerGender:
          (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
        niche: influencer.niche,
        personality: influencer.personality,
        bio: influencer.bio,
        language: input.language,
        platforms: input.platforms,
        days: input.days,
        postsPerDay: input.postsPerDay,
        goals: input.goals,
        postingHours: input.postingHours,
      });

      const start = input.startDate ? new Date(input.startDate) : new Date();
      const hours =
        input.postingHours && input.postingHours.length > 0
          ? input.postingHours
          : [10, 18, 21].slice(0, input.postsPerDay);

      const batch = await db.contentBatch.create({
        data: {
          influencerId: influencer.id,
          name:
            `${input.days}d × ${input.postsPerDay}/d — ` +
            new Date().toISOString().slice(0, 10),
        },
      });

      const created = await Promise.all(
        plan.posts.slice(0, totalPosts).map((post) => {
          const day = Math.min(Math.max(post.dayIndex, 0), input.days - 1);
          const slot = Math.min(Math.max(post.slotIndex, 0), input.postsPerDay - 1);
          const hour = hours[slot] ?? hours[0] ?? 10;
          const scheduledAt = new Date(start);
          scheduledAt.setDate(scheduledAt.getDate() + day);
          scheduledAt.setHours(hour, 0, 0, 0);

          return db.content.create({
            data: {
              influencerId: influencer.id,
              batchId: batch.id,
              type: post.type,
              contentMode: "SFW",
              status: "DRAFT",
              caption: post.caption,
              hashtags: post.hashtags,
              mediaUrls: [],
              platforms: [post.platform],
              scheduledAt,
              promptUsed: post.concept,
              generationParams: {
                source: "content_plan",
                hook: post.hook,
                concept: post.concept,
                sceneDescription: post.sceneDescription,
                scene: post.scene,
                pose: post.pose,
                expression: post.expression,
                outfit: post.outfit,
                cta: post.cta,
                dayIndex: day,
                slotIndex: slot,
              } as object,
            },
            select: { id: true, scheduledAt: true, type: true },
          });
        })
      );

      return {
        batchId: batch.id,
        cost,
        summary: plan.summary,
        postsCreated: created.length,
        posts: created,
      };
    }),

  generateIdeas: protectedProcedure
    .input(generateIdeasInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      const ideas = await genIdeas(user.id, {
        influencerName: influencer.name,
        niche: influencer.niche,
        personality: influencer.personality,
        language: input.language,
        platform: input.platform,
        count: input.count,
      });

      return { ideas };
    }),

  generateCaptionVariants: protectedProcedure
    .input(generateCaptionVariantsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      const [a, b] = await Promise.all([
        genCaption(user.id, {
          influencerName: influencer.name,
          personality: influencer.personality,
          niche: influencer.niche,
          platform: input.platform,
          contentDescription: input.contentDescription,
          language: input.language,
          influencerId: influencer.id,
        }),
        genCaption(user.id, {
          influencerName: influencer.name,
          personality: influencer.personality,
          niche: influencer.niche,
          platform: input.platform,
          contentDescription: `${input.contentDescription} (variante alternative, angle différent, ouvre par autre chose)`,
          language: input.language,
          influencerId: influencer.id,
        }),
      ]);

      return { variants: [a, b] };
    }),
});
