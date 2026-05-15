import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { CREDIT_COSTS } from "@/lib/constants";

const periodSchema = z.enum(["7d", "30d", "90d", "all"]);
const metricSchema = z.enum(["followers", "engagement", "views", "likes"]);

type Period = z.infer<typeof periodSchema>;

function getDateRange(period: Period): { start: Date; end: Date } | null {
  const end = new Date();
  let start: Date;
  switch (period) {
    case "7d":
      start = new Date(end);
      start.setDate(start.getDate() - 7);
      return { start, end };
    case "30d":
      start = new Date(end);
      start.setDate(start.getDate() - 30);
      return { start, end };
    case "90d":
      start = new Date(end);
      start.setDate(start.getDate() - 90);
      return { start, end };
    case "all":
      return null;
  }
}

import { getDbUser } from "@/server/helpers/get-db-user";
import { suggestSlots as smartSuggestSlots } from "@/server/services/smart-scheduler.service";

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    const [totalInfluencers, totalContents, analyticsAgg, userCredits] =
      await Promise.all([
        db.influencer.count({
          where: { userId: user.id, status: "ACTIVE" },
        }),
        db.content.count({
          where: {
            influencer: { userId: user.id },
            status: "PUBLISHED" as const,
          },
        }),
        db.contentAnalytics.aggregate({
          where: {
            content: {
              influencer: { userId: user.id },
              status: "PUBLISHED" as const,
            },
          },
          _avg: { engagementRate: true },
          _sum: { views: true, likes: true },
        }),
        db.user.findUnique({
          where: { id: user.id },
          select: { creditsUsed: true, creditsLimit: true },
        }),
      ]);

    const credits = userCredits
      ? {
          total: userCredits.creditsLimit,
          used: userCredits.creditsUsed,
          remaining: Math.max(0, userCredits.creditsLimit - userCredits.creditsUsed),
        }
      : { total: 0, used: 0, remaining: 0 };

    const totalViews = analyticsAgg._sum.views ?? 0;
    const totalLikes = analyticsAgg._sum.likes ?? 0;
    const avgEngagement = analyticsAgg._avg.engagementRate ?? 0;

    return {
      totalInfluencers,
      totalContents,
      totalViews,
      totalLikes,
      avgEngagement,
      credits,
    };
  }),

  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    const [recentContents, recentInfluencers] = await Promise.all([
      db.content.findMany({
        where: {
          influencer: { userId: user.id },
          status: { in: ["PUBLISHED", "READY"] },
        },
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          influencer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.influencer.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    type ActivityItem = {
      id: string;
      type: "content_published" | "content_ready" | "influencer_created";
      text: string;
      timestamp: Date;
    };

    const activities: ActivityItem[] = [];

    for (const c of recentContents) {
      const date = c.publishedAt ?? c.createdAt;
      const typeLabel = c.type === "REEL" ? "Reel" : c.type === "PHOTO" ? "Photo" : "Contenu";
      activities.push({
        id: `content-${c.id}`,
        type: c.status === "PUBLISHED" ? "content_published" : "content_ready",
        text:
          c.status === "PUBLISHED"
            ? `${typeLabel} publié pour ${c.influencer.name}`
            : `${typeLabel} prêt pour ${c.influencer.name}`,
        timestamp: date,
      });
    }
    for (const inf of recentInfluencers) {
      activities.push({
        id: `influencer-${inf.id}`,
        type: "influencer_created",
        text: `Influenceuse "${inf.name}" créée`,
        timestamp: inf.createdAt,
      });
    }

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return activities.slice(0, 10);
  }),

  getOverviewStats: protectedProcedure
    .input(z.object({ influencerId: z.string().optional(), period: periodSchema }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);

      const contentWhere = {
        influencer: { userId: user.id, ...(input.influencerId ? { id: input.influencerId } : {}) },
        status: "PUBLISHED" as const,
        ...(range ? { publishedAt: { gte: range.start, lte: range.end } } : {}),
      };

      const prevRange = range
        ? {
            start: new Date(range.start.getTime() - (range.end.getTime() - range.start.getTime())),
            end: range.start,
          }
        : null;

      const prevContentWhere = prevRange
        ? {
            influencer: { userId: user.id, ...(input.influencerId ? { id: input.influencerId } : {}) },
            status: "PUBLISHED" as const,
            publishedAt: { gte: prevRange.start, lt: prevRange.end },
          }
        : null;

      const [contentsInPeriod, contentsPrev, analyticsInPeriod, analyticsPrev, influencers] =
        await Promise.all([
          db.content.findMany({
            where: contentWhere,
            select: { id: true },
          }),
          prevContentWhere
            ? db.content.findMany({
                where: prevContentWhere,
                select: { id: true },
              })
            : Promise.resolve([]),
          db.contentAnalytics.groupBy({
            by: ["contentId"],
            where: {
              content: contentWhere,
            },
            _sum: { views: true, likes: true },
            _avg: { engagementRate: true },
          }),
          prevContentWhere
            ? db.contentAnalytics.groupBy({
                by: ["contentId"],
                where: { content: prevContentWhere },
                _sum: { views: true, likes: true },
                _avg: { engagementRate: true },
              })
            : Promise.resolve([]),
          db.influencer.findMany({
            where: { userId: user.id, ...(input.influencerId ? { id: input.influencerId } : {}) },
            include: { socialAccounts: true },
          }),
        ]);

      const contentIds = contentsInPeriod.map((c) => c.id);
      const prevContentIds = contentsPrev.map((c) => c.id);

      const totalFollowers = influencers.reduce(
        (acc, inf) => acc + inf.socialAccounts.reduce((a, s) => a + s.followers, 0),
        0
      );

      const sum = (arr: { _sum: { views: number | null; likes: number | null }; _avg: { engagementRate: number | null } }[]) => ({
        views: arr.reduce((a, x) => a + (x._sum.views ?? 0), 0),
        likes: arr.reduce((a, x) => a + (x._sum.likes ?? 0), 0),
        engagement: arr.length ? arr.reduce((a, x) => a + (x._avg.engagementRate ?? 0), 0) / arr.length : 0,
      });

      const curr = sum(analyticsInPeriod);
      const prev = sum(analyticsPrev);

      const delta = (current: number, previous: number) =>
        previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;

      return {
        totalFollowers,
        newFollowers: totalFollowers,
        contentsPublished: contentIds.length,
        totalViews: curr.views,
        totalLikes: curr.likes,
        avgEngagement: curr.engagement,
        totalFollowersChange: 0,
        newFollowersChange: 0,
        contentsPublishedChange: delta(contentIds.length, prevContentIds.length),
        totalViewsChange: delta(curr.views, prev.views),
        totalLikesChange: delta(curr.likes, prev.likes),
        avgEngagementChange: delta(curr.engagement, prev.engagement),
      };
    }),

  getInfluencerStats: protectedProcedure
    .input(z.object({ influencerId: z.string(), period: periodSchema }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);

      const contentWhere = {
        influencerId: input.influencerId,
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        ...(range ? { publishedAt: { gte: range.start, lte: range.end } } : {}),
      };

      const [influencer, analytics, socialAccounts] = await Promise.all([
        db.influencer.findUnique({
          where: { id: input.influencerId, userId: user.id },
          include: { socialAccounts: true },
        }),
        db.contentAnalytics.aggregate({
          where: { content: contentWhere },
          _sum: { views: true, likes: true },
          _avg: { engagementRate: true },
        }),
        db.socialAccount.findMany({
          where: { influencerId: input.influencerId },
        }),
      ]);

      if (!influencer) return null;

      const totalFollowers = socialAccounts.reduce((a, s) => a + s.followers, 0);
      const contentsCount = await db.content.count({
        where: { influencerId: input.influencerId, status: "PUBLISHED" as const },
      });

      const platformBreakdown = socialAccounts.map((s) => ({
        platform: s.platform,
        followers: s.followers,
        views: 0,
      }));

      const views = analytics._sum.views ?? 0;
      for (const p of platformBreakdown) {
        const agg = await db.contentAnalytics.aggregate({
          where: {
            content: contentWhere,
            platform: p.platform,
          },
          _sum: { views: true },
        });
        p.views = agg._sum.views ?? 0;
      }

      return {
        influencerId: input.influencerId,
        totalFollowers,
        newFollowers: totalFollowers,
        contentsPublished: contentsCount,
        totalViews: views,
        totalLikes: analytics._sum.likes ?? 0,
        avgEngagement: analytics._avg.engagementRate ?? 0,
        platformBreakdown,
      };
    }),

  getContentPerformance: protectedProcedure
    .input(z.object({ influencerId: z.string().optional(), period: periodSchema }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);

      const contentWhere = {
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        ...(input.influencerId ? { influencerId: input.influencerId } : {}),
        ...(range ? { publishedAt: { gte: range.start, lte: range.end } } : {}),
      };

      const analytics = await db.contentAnalytics.findMany({
        where: { content: contentWhere },
        include: {
          content: {
            select: {
              id: true,
              type: true,
              thumbnailUrl: true,
              publishedAt: true,
              influencer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { engagementRate: "desc" },
      });

      const items = analytics.map((a) => ({
        id: a.content.id,
        influencerId: a.content.influencer.id,
        influencerName: a.content.influencer.name,
        type: a.content.type,
        platform: a.platform,
        views: a.views,
        likes: a.likes,
        comments: a.comments,
        shares: a.shares,
        engagement: a.engagementRate,
        thumbnailUrl: a.content.thumbnailUrl,
        publishedAt: a.content.publishedAt,
      }));

      const sorted = [...items].sort((a, b) => b.engagement - a.engagement);
      return {
        top: sorted.slice(0, 10),
        worst: sorted.slice(-5).reverse(),
      };
    }),

  getGrowthData: protectedProcedure
    .input(z.object({ influencerId: z.string(), metric: metricSchema, period: periodSchema }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);
      if (!range) return [];

      const contentWhere = {
        influencerId: input.influencerId,
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        publishedAt: { gte: range.start, lte: range.end },
      };

      const analytics = await db.contentAnalytics.findMany({
        where: { content: contentWhere },
        select: {
          platform: true,
          views: true,
          likes: true,
          engagementRate: true,
          fetchedAt: true,
        },
      });

      const byDate: Record<string, { TIKTOK: number; INSTAGRAM: number; ONLYFANS: number }> = {};
      const days: string[] = [];
      for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        days.push(key);
        byDate[key] = { TIKTOK: 0, INSTAGRAM: 0, ONLYFANS: 0 };
      }

      for (const a of analytics) {
        const key = a.fetchedAt.toISOString().slice(0, 10);
        if (!byDate[key]) byDate[key] = { TIKTOK: 0, INSTAGRAM: 0, ONLYFANS: 0 };
        const val =
          input.metric === "views"
            ? a.views
            : input.metric === "likes"
              ? a.likes
              : input.metric === "engagement"
                ? a.engagementRate
                : 0;
        byDate[key][a.platform] = (byDate[key][a.platform] ?? 0) + val;
      }

      return days.map((date) => ({ date, ...byDate[date] }));
    }),

  getPlatformBreakdown: protectedProcedure
    .input(z.object({ influencerId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const [accounts, analytics] = await Promise.all([
        db.socialAccount.findMany({
          where: {
            influencer: {
              userId: user.id,
              ...(input.influencerId ? { id: input.influencerId } : {}),
            },
          },
          select: { platform: true, followers: true },
        }),
        db.contentAnalytics.groupBy({
          by: ["platform"],
          where: {
            content: {
              influencer: { userId: user.id, ...(input.influencerId ? { id: input.influencerId } : {}) },
            },
          },
          _sum: { views: true },
        }),
      ]);

      const totalViews = analytics.reduce((a, x) => a + (x._sum.views ?? 0), 0);
      const result = ["TIKTOK", "INSTAGRAM", "ONLYFANS"] as const;
      return result.map((platform) => {
        const acc = accounts.find((a) => a.platform === platform);
        const agg = analytics.find((a) => a.platform === platform);
        const views = agg?._sum.views ?? 0;
        const followers = acc?.followers ?? 0;
        return {
          platform,
          followers,
          views,
          percentage: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
        };
      });
    }),

  getPerformanceTable: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        period: periodSchema,
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(10),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);

      const contentWhere = {
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        ...(input.influencerId ? { influencerId: input.influencerId } : {}),
        ...(range ? { publishedAt: { gte: range.start, lte: range.end } } : {}),
      };

      const analytics = await db.contentAnalytics.findMany({
        where: { content: contentWhere },
        include: {
          content: {
            select: {
              id: true,
              type: true,
              thumbnailUrl: true,
              publishedAt: true,
              influencer: { select: { id: true, name: true } },
            },
          },
        },
      });

      const rows = analytics.map((a) => ({
        id: a.content.id,
        influencerId: a.content.influencer.id,
        influencerName: a.content.influencer.name,
        type: a.content.type,
        platform: a.platform,
        date: a.content.publishedAt,
        views: a.views,
        likes: a.likes,
        comments: a.comments,
        shares: a.shares,
        engagement: a.engagementRate,
        thumbnailUrl: a.content.thumbnailUrl,
      }));

      const sortBy = input.sortBy ?? "engagement";
      const sortOrder = input.sortOrder ?? "desc";
      const key = sortBy as keyof (typeof rows)[0];
      rows.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (typeof aVal === "number" && typeof bVal === "number")
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        if (aVal instanceof Date && bVal instanceof Date)
          return sortOrder === "asc"
            ? aVal.getTime() - bVal.getTime()
            : bVal.getTime() - aVal.getTime();
        return 0;
      });

      const total = rows.length;
      const start = (input.page - 1) * input.limit;
      const pageRows = rows.slice(start, start + input.limit);

      return { rows: pageRows, total };
    }),

  // ──────────────────────────────────────────────
  // Sprint 8 — Advanced analytics
  // ──────────────────────────────────────────────

  /**
   * getCreditROI — Crédits dépensés vs vues/engagement obtenus.
   * Permet à l'utilisateur de juger la rentabilité de chaque influenceur·se.
   */
  getCreditROI: protectedProcedure
    .input(z.object({ period: periodSchema }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);

      const contentWhere = {
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        ...(range ? { publishedAt: { gte: range.start, lte: range.end } } : {}),
      };

      const influencers = await db.influencer.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          contents: {
            where: contentWhere,
            select: {
              id: true,
              type: true,
              contentAnalytics: { select: { views: true, likes: true } },
            },
          },
        },
      });

      // Cost model mirrors CREDIT_COSTS in src/lib/constants.ts.
      const COST_PER_TYPE: Record<string, number> = {
        PHOTO: CREDIT_COSTS.PHOTO,
        REEL: CREDIT_COSTS.REEL,
      };

      return influencers
        .map((inf) => {
          const credits = inf.contents.reduce(
            (acc, c) => acc + (COST_PER_TYPE[c.type] ?? 1),
            0
          );
          const views = inf.contents.reduce(
            (acc, c) => acc + c.contentAnalytics.reduce((v, a) => v + a.views, 0),
            0
          );
          const likes = inf.contents.reduce(
            (acc, c) => acc + c.contentAnalytics.reduce((v, a) => v + a.likes, 0),
            0
          );
          return {
            influencerId: inf.id,
            influencerName: inf.name,
            postsCount: inf.contents.length,
            creditsSpent: credits,
            views,
            likes,
            viewsPerCredit: credits > 0 ? Math.round(views / credits) : 0,
            likesPerCredit: credits > 0 ? Math.round(likes / credits) : 0,
          };
        })
        .filter((row) => row.postsCount > 0)
        .sort((a, b) => b.viewsPerCredit - a.viewsPerCredit);
    }),

  /**
   * getBestPostingHours — Heatmap engagement (jour × heure).
   * Aide au choix des slots dans le planner.
   */
  getBestPostingHours: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        period: periodSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);

      const contentWhere = {
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        ...(input.influencerId ? { influencerId: input.influencerId } : {}),
        ...(range ? { publishedAt: { gte: range.start, lte: range.end } } : {}),
      };

      const contents = await db.content.findMany({
        where: contentWhere,
        select: {
          publishedAt: true,
          contentAnalytics: { select: { engagementRate: true } },
        },
      });

      // grid[day=0..6 (Mon..Sun)][hour=0..23] = { sum, count }
      const grid: { sum: number; count: number }[][] = Array.from(
        { length: 7 },
        () => Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
      );

      for (const c of contents) {
        if (!c.publishedAt) continue;
        const day = (c.publishedAt.getDay() + 6) % 7; // make Monday=0
        const hour = c.publishedAt.getHours();
        const er = c.contentAnalytics.length
          ? c.contentAnalytics.reduce((a, x) => a + x.engagementRate, 0) /
            c.contentAnalytics.length
          : 0;
        grid[day][hour].sum += er;
        grid[day][hour].count += 1;
      }

      const cells: { day: number; hour: number; engagement: number; count: number }[] =
        [];
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const cell = grid[d][h];
          cells.push({
            day: d,
            hour: h,
            engagement: cell.count > 0 ? cell.sum / cell.count : 0,
            count: cell.count,
          });
        }
      }

      const top = [...cells]
        .filter((c) => c.count > 0)
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5);

      return { cells, top };
    }),

  /**
   * getEngagementTimeline — Série temporelle quotidienne views/likes/engagement
   * agrégée tous influenceurs / plateformes confondus (avec breakdown par
   * plateforme pour le graphique stacked).
   */
  getEngagementTimeline: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        period: periodSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);
      if (!range) return [];

      const contentWhere = {
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        ...(input.influencerId ? { influencerId: input.influencerId } : {}),
        publishedAt: { gte: range.start, lte: range.end },
      };

      const analytics = await db.contentAnalytics.findMany({
        where: { content: contentWhere },
        select: {
          views: true,
          likes: true,
          comments: true,
          engagementRate: true,
          fetchedAt: true,
          platform: true,
        },
      });

      const days: string[] = [];
      const byDate: Record<
        string,
        { views: number; likes: number; comments: number; engagement: number; count: number }
      > = {};

      for (let d = new Date(range.start); d <= range.end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        days.push(key);
        byDate[key] = { views: 0, likes: 0, comments: 0, engagement: 0, count: 0 };
      }

      for (const a of analytics) {
        const key = a.fetchedAt.toISOString().slice(0, 10);
        if (!byDate[key]) {
          byDate[key] = { views: 0, likes: 0, comments: 0, engagement: 0, count: 0 };
        }
        byDate[key].views += a.views;
        byDate[key].likes += a.likes;
        byDate[key].comments += a.comments;
        byDate[key].engagement += a.engagementRate;
        byDate[key].count += 1;
      }

      return days.map((date) => {
        const day = byDate[date];
        return {
          date,
          views: day.views,
          likes: day.likes,
          comments: day.comments,
          engagement: day.count > 0 ? day.engagement / day.count : 0,
        };
      });
    }),

  /**
   * suggestSlots — Sprint 10: data-driven scheduler.
   * Reuses the same heatmap query as `getBestPostingHours` and runs the pure
   * `suggestSlots` helper on top of it. Used by the calendar UI to pre-fill
   * upcoming scheduled timestamps when generating a content plan or batch.
   */
  suggestSlots: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        period: periodSchema.default("90d"),
        count: z.number().int().min(1).max(30).default(7),
        startsFrom: z.date().optional(),
        alreadyScheduledAt: z.array(z.date()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const range = getDateRange(input.period);

      const contentWhere = {
        influencer: { userId: user.id },
        status: "PUBLISHED" as const,
        ...(input.influencerId ? { influencerId: input.influencerId } : {}),
        ...(range ? { publishedAt: { gte: range.start, lte: range.end } } : {}),
      };

      const contents = await db.content.findMany({
        where: contentWhere,
        select: {
          publishedAt: true,
          contentAnalytics: { select: { engagementRate: true } },
        },
      });

      // Build the same 7×24 grid used by getBestPostingHours.
      const grid: { sum: number; count: number }[][] = Array.from(
        { length: 7 },
        () => Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
      );
      for (const c of contents) {
        if (!c.publishedAt) continue;
        const day = (c.publishedAt.getDay() + 6) % 7;
        const hour = c.publishedAt.getHours();
        const er = c.contentAnalytics.length
          ? c.contentAnalytics.reduce((a, x) => a + x.engagementRate, 0) /
            c.contentAnalytics.length
          : 0;
        grid[day][hour].sum += er;
        grid[day][hour].count += 1;
      }
      const cells: { day: number; hour: number; engagement: number; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const cell = grid[d][h];
          cells.push({
            day: d,
            hour: h,
            engagement: cell.count > 0 ? cell.sum / cell.count : 0,
            count: cell.count,
          });
        }
      }

      return smartSuggestSlots({
        cells,
        count: input.count,
        startsFrom: input.startsFrom ?? new Date(),
        alreadyScheduledAt: input.alreadyScheduledAt,
      });
    }),
});
