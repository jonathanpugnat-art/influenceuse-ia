import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";

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
});
