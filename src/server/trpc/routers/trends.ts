import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { PLANS } from "@/lib/constants";
import {
  getFeedForInfluencer,
  getGlobalTrendFeed,
  getWizardTrendInspiration,
  personalizeFeedForInfluencer,
  personalizeSingleTrendForInfluencer,
  recommendationToCreatorParams,
  recommendationToPhotoParams,
  ensureTrendFormatAnalyzed,
  runTrendsFetch,
  trendAnalysisCost,
  trendAnalysisOneCost,
  trendFormatAnalyzeCost,
} from "@/server/services/trends.service";
import { parseTrendFormatBrief } from "@/lib/trends/trend-format-brief";
import {
  pickPosterUrlFromTrend,
  resolveTrendInlinePreview,
} from "@/lib/trends/trend-video-items";
import { resolveTrendsProvider } from "@/server/services/trend-provider";
import type { Plan, TrendItem } from "@/generated/prisma/client";

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

type TrendRecRow = {
  id: string;
  trendItemId: string;
  generatedHook: string;
  generatedFields: unknown;
  llmModel: string | null;
  createdAt: Date;
};

async function loadRecommendationsForTrends(
  influencerId: string,
  trendItemIds: string[]
): Promise<Map<string, TrendRecRow>> {
  if (trendItemIds.length === 0) return new Map();
  const recs = await db.trendRecommendation.findMany({
    where: {
      influencerId,
      trendItemId: { in: trendItemIds },
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
  return new Map(recs.map((r) => [r.trendItemId, r]));
}

function mapTrendItemsForUi(items: TrendItem[], byTrendId: Map<string, TrendRecRow>) {
  const itemsWithFormat = items.map((item) => ({
    ...item,
    formatBrief: parseTrendFormatBrief(item.formatBrief),
    hasMedia: item.mediaUrls.length > 0 || Boolean(item.thumbnailUrl),
  }));

  return itemsWithFormat.map((trendItem) => {
    const posterUrl = pickPosterUrlFromTrend({
      thumbnailUrl: trendItem.thumbnailUrl,
      thumbnailUrlAlt: trendItem.thumbnailUrlAlt,
      mediaUrls: trendItem.mediaUrls,
    });
    const inlinePreview = resolveTrendInlinePreview({
      platform: trendItem.platform,
      sourceUrl: trendItem.sourceUrl,
      embedUrl: trendItem.embedUrl,
      mediaUrls: trendItem.mediaUrls,
    });

    return {
      id: trendItem.id,
      platform: trendItem.platform,
      title: trendItem.title,
      description: trendItem.description,
      hashtags: trendItem.hashtags,
      soundName: trendItem.soundName,
      growthScore: trendItem.growthScore,
      sourceUrl: trendItem.sourceUrl,
      thumbnailUrl: trendItem.thumbnailUrl ?? posterUrl,
      thumbnailUrlAlt: trendItem.thumbnailUrlAlt,
      embedUrl: trendItem.embedUrl,
      mediaUrls: trendItem.mediaUrls,
      inlinePreview,
      authorHandle: trendItem.authorHandle,
      nicheTags: trendItem.nicheTags,
      locale: trendItem.locale,
      region: trendItem.region,
      fetchedAt: trendItem.fetchedAt,
      mediaKind: trendItem.mediaKind,
      hasMedia: trendItem.hasMedia,
      formatBrief: trendItem.formatBrief,
      formatAnalyzedAt: trendItem.formatAnalyzedAt,
      recommendation: byTrendId.get(trendItem.id) ?? null,
    };
  });
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const trendsRouter = createTRPCRouter({
  /**
   * config — Surface basic configuration to the UI so it can render a
   * "Trends not configured" banner instead of an empty feed.
   */
  /**
   * wizardInspiration — Trend format chips for the creation wizard (step 2).
   * Does not require an existing influencer.
   */
  wizardInspiration: protectedProcedure
    .input(
      z.object({
        niche: z.string().min(1),
        isNsfw: z.boolean().default(false),
        limit: z.number().int().min(1).max(8).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const items = await getWizardTrendInspiration({
        niche: input.niche,
        isNsfw: input.isNsfw,
        locale: user.locale ?? undefined,
        limit: input.limit,
      });
      return { items };
    }),

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
      analysisOneCost: trendAnalysisOneCost(),
      formatAnalyzeCost: trendFormatAnalyzeCost(),
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
        limit: z.coerce.number().int().min(1).max(200).optional(),
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

      const byTrendId = await loadRecommendationsForTrends(
        influencer.id,
        items.map((i) => i.id)
      );

      return {
        feature: {
          planLocked: !planCfg.hasTrends,
          planName: planCfg.name,
        },
        items: mapTrendItemsForUi(items, byTrendId),
        nextCursor,
      };
    }),

  /**
   * getGlobalFeed — All niches, sorted by growth. NSFW gate from influencer only.
   */
  getGlobalFeed: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        platform: z.enum(platformValues).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user, influencer } = await loadOwnedInfluencer(
        ctx.userId,
        input.influencerId
      );
      const planCfg = PLANS[user.plan as Plan];
      const effectiveLimit = planCfg.hasTrends
        ? input.limit
        : Math.min(input.limit ?? planCfg.trendsMaxFeed, planCfg.trendsMaxFeed);

      const { items, nextCursor } = await getGlobalTrendFeed({
        limit: effectiveLimit,
        cursor: input.cursor,
        platform: input.platform,
        isNsfw: influencer.isNsfw,
        userPlan: user.plan as Plan,
        userLocale: user.locale,
      });

      const byTrendId = await loadRecommendationsForTrends(
        influencer.id,
        items.map((i) => i.id)
      );

      return {
        feature: {
          planLocked: !planCfg.hasTrends,
          planName: planCfg.name,
        },
        items: mapTrendItemsForUi(items, byTrendId),
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
            select: {
              id: true,
              hashtags: true,
              platform: true,
              formatBrief: true,
              mediaKind: true,
            },
          },
        },
      });
      if (!rec || rec.influencerId !== influencer.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recommendation not found",
        });
      }

      return recommendationToCreatorParams(
        {
          id: rec.id,
          trendItemId: rec.trendItemId,
          generatedFields: rec.generatedFields,
        },
        influencer.id,
        rec.trendItem.hashtags,
        rec.trendItem,
        { isNsfw: influencer.isNsfw, gender: influencer.gender }
      );
    }),

  /**
   * analyzeFormat — Vision/text analysis of scraped media for one trend.
   */
  analyzeFormat: protectedProcedure
    .input(
      z.object({
        trendItemId: z.string(),
        force: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const trendItem = await db.trendItem.findUnique({
        where: { id: input.trendItemId },
      });
      if (!trendItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trend not found",
        });
      }

      const cost = trendFormatAnalyzeCost();
      if (cost > 0) {
        const hasCredits = await checkCredits(user.id, cost);
        if (!hasCredits) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Crédits insuffisants. Coût : ${cost} crédit.`,
          });
        }
      }

      try {
        const result = await ensureTrendFormatAnalyzed(
          input.trendItemId,
          { force: input.force }
        );
        if (cost > 0) await deductCredits(user.id, cost);
        return {
          brief: result.brief,
          model: result.model,
          cost,
        };
      } catch (error) {
        console.error("[trends.analyzeFormat]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "L'analyse du format a échoué. Vérifie ANTHROPIC_API_KEY pour la vision, ou réessaie.",
        });
      }
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

  /**
   * personalizeOne — Generate a recommendation for ONE trend card. Cheaper
   * than the bulk `refreshForInfluencer` path (0.1 cr vs 0.5 cr) so users
   * can explore the feed and only spend credits on cards they like.
   */
  personalizeOne: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        trendItemId: z.string(),
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
            "UPGRADE_REQUIRED:feature:trends_personalize_one — passe au plan Creator pour personnaliser les tendances.",
        });
      }

      const trendItem = await db.trendItem.findUnique({
        where: { id: input.trendItemId },
      });
      if (!trendItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trend not found (it may have expired from the feed).",
        });
      }

      const cost = trendAnalysisOneCost();
      const hasCredits = await checkCredits(user.id, cost);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost} crédit.`,
        });
      }

      const language: "fr" | "en" =
        input.language ?? (user.locale === "en" ? "en" : "fr");

      try {
        const result = await personalizeSingleTrendForInfluencer(
          influencer,
          trendItem,
          language
        );
        if (cost > 0) await deductCredits(user.id, cost);
        return { recommendationId: result.recommendationId, cost };
      } catch (error) {
        console.error("[trends.personalizeOne] LLM error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "La personnalisation de cette tendance a échoué. Réessaie dans un instant.",
        });
      }
    }),

  /**
   * triggerInitialFetch — Bootstrap the trend cache the first time a user
   * lands on an empty Trends page. Cheap (the curated provider has no
   * external cost) and idempotent (the service-level cache prevents abuse).
   *
   * Surfaced as a button in the empty state — the cron also runs daily but
   * a user shouldn't have to wait 24h for their first feed.
   */
  triggerInitialFetch: protectedProcedure
    .input(
      z
        .object({ force: z.boolean().optional() })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      // Even though the curated provider is free, we still gate this behind
      // a basic "is the feed actually empty?" check so we don't hammer the
      // service when the user spam-clicks the button.
      const existing = await db.trendItem.count({
        where: {
          fetchedAt: {
            gte: new Date(Date.now() - 24 * 3600 * 1000),
          },
        },
      });
      if (existing > 0 && !input?.force) {
        return {
          ok: true,
          provider: null,
          snapshotsCreated: 0,
          itemsCreated: 0,
          skipped: "already-have-fresh-trends",
        };
      }

      const result = await runTrendsFetch({
        force: input?.force ?? false,
      });
      return result;
    }),
});
