import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { PLANS } from "@/lib/constants";
import {
  getFeedForInfluencer,
  personalizeFeedForInfluencer,
  recommendationToPhotoParams,
  trendAnalysisCost,
} from "@/server/services/trends.service";
import { resolveTrendsProvider } from "@/server/services/trend-provider";
import type { Plan } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const platformValues = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;

async function loadOwnedInfluencer(clerkId: string, influencerId: string) {
  const user = await getDbUser(clerkId);
  const influencer = await db.influencer.findUnique({
    where: { id: influencerId },
  });
  if (!influencer || influencer.userId !== user.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
  }
  return { user, influencer };
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const trendsRouter = createTRPCRouter({
  /**
   * config — Surface basic configuration to the UI so it can render a
   * "Trends not configured" banner instead of an empty feed.
   */
  config: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    const planCfg = PLANS[user.plan as Plan];
    const provider = resolveTrendsProvider();
    return {
      providerConfigured: provider !== null,
      providerId: provider?.id ?? null,
      planHasTrends: planCfg.hasTrends,
      planMaxFeed: planCfg.trendsMaxFeed,
      planName: planCfg.name,
      analysisCost: trendAnalysisCost(),
    };
  }),

  /**
   * getFeed — Niche/NSFW/locale-filtered trend cards for one influencer.
   * If LLM recommendations already exist for a card, they're returned
   * alongside the raw trend so the UI can render the personalized hook.
   */
  getFeed: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        platform: z.enum(platformValues).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, influencer } = await loadOwnedInfluencer(
        ctx.userId,
        input.influencerId
      );
      const planCfg = PLANS[user.plan as Plan];

      // FREE plan: hard cap to teaser size, even if the client asks for more.
      const effectiveLimit = planCfg.hasTrends
        ? input.limit
        : Math.min(input.limit ?? planCfg.trendsMaxFeed, planCfg.trendsMaxFeed);

      const { items, nextCursor } = await getFeedForInfluencer(
        influencer,
        {
          limit: effectiveLimit,
          cursor: input.cursor,
          platform: input.platform,
          userPlan: user.plan as Plan,
          userLocale: user.locale,
        }
      );

      // Pull existing recommendations for these items in one go.
      const recs =
        items.length === 0
          ? []
          : await db.trendRecommendation.findMany({
              where: {
                influencerId: influencer.id,
                trendItemId: { in: items.map((i) => i.id) },
                userDismissed: false,
              },
              select: {
                id: true,
                trendItemId: true,
                generatedHook: true,
                generatedFields: true,
                llmModel: true,
                createdAt: true,
              },
            });
      const byTrendId = new Map(recs.map((r) => [r.trendItemId, r]));

      return {
        feature: {
          planLocked: !planCfg.hasTrends,
          planName: planCfg.name,
        },
        items: items.map((t) => ({
          id: t.id,
          platform: t.platform,
          title: t.title,
          description: t.description,
          hashtags: t.hashtags,
          soundName: t.soundName,
          growthScore: t.growthScore,
          sourceUrl: t.sourceUrl,
          nicheTags: t.nicheTags,
          locale: t.locale,
          region: t.region,
          fetchedAt: t.fetchedAt,
          recommendation: byTrendId.get(t.id) ?? null,
        })),
        nextCursor,
      };
    }),

  /**
   * refreshForInfluencer — Trigger a fresh LLM personalization pass over the
   * current feed for one influencer. Costs `CREDIT_COSTS.TREND_ANALYSIS`.
   * Plan-locked: FREE can't refresh.
   */
  refreshForInfluencer: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        platform: z.enum(platformValues).optional(),
        language: z.enum(["fr", "en"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user, influencer } = await loadOwnedInfluencer(
        ctx.userId,
        input.influencerId
      );
      const planCfg = PLANS[user.plan as Plan];

      if (!planCfg.hasTrends) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "UPGRADE_REQUIRED:feature:trends_refresh — passe au plan Creator pour personnaliser les tendances.",
        });
      }

      const cost = trendAnalysisCost();
      const hasCredits = await checkCredits(user.id, cost);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost} crédits.`,
        });
      }

      const { items } = await getFeedForInfluencer(influencer, {
        limit: planCfg.trendsMaxFeed,
        platform: input.platform,
        userPlan: user.plan as Plan,
        userLocale: user.locale,
      });

      if (items.length === 0) {
        return { created: 0, recommendationIds: [], cost: 0 };
      }

      const language: "fr" | "en" =
        input.language ?? (user.locale === "en" ? "en" : "fr");

      try {
        const result = await personalizeFeedForInfluencer(
          influencer,
          items,
          language
        );
        if (cost > 0) {
          await deductCredits(user.id, cost);
        }
        return {
          created: result.created,
          recommendationIds: result.recommendationIds,
          cost,
        };
      } catch (error) {
        console.error("[trends.refreshForInfluencer] LLM error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "La personnalisation des tendances a échoué. Réessaie dans un instant.",
        });
      }
    }),

  /**
   * applyToPhotoParams — Return a creator-ready blob for one recommendation.
   * The UI calls this just before navigating to /content/photo so the
   * Zustand store can be primed in one step.
   */
  applyToPhotoParams: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        recommendationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { influencer } = await loadOwnedInfluencer(
        ctx.userId,
        input.influencerId
      );

      const rec = await db.trendRecommendation.findUnique({
        where: { id: input.recommendationId },
        include: {
          trendItem: {
            select: { id: true, hashtags: true, platform: true },
          },
        },
      });
      if (!rec || rec.influencerId !== influencer.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recommendation not found",
        });
      }

      const blob = recommendationToPhotoParams(
        {
          id: rec.id,
          trendItemId: rec.trendItemId,
          generatedFields: rec.generatedFields,
        },
        influencer.id,
        rec.trendItem.hashtags
      );

      return blob;
    }),

  /**
   * dismiss — Hide a recommendation from the feed. Soft delete so we keep
   * the row for analytics ("what did users skip?").
   */
  dismiss: protectedProcedure
    .input(z.object({ recommendationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const rec = await db.trendRecommendation.findUnique({
        where: { id: input.recommendationId },
        include: { influencer: { select: { userId: true } } },
      });
      if (!rec || rec.influencer.userId !== user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recommendation not found",
        });
      }
      await db.trendRecommendation.update({
        where: { id: rec.id },
        data: { userDismissed: true },
      });
      return { ok: true };
    }),
});
