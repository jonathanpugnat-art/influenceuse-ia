import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import * as instagram from "@/server/services/instagram.service";
import * as tiktok from "@/server/services/tiktok.service";

import { getDbUser } from "@/server/helpers/get-db-user";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function verifyContentOwnership(contentId: string, userId: string) {
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { influencer: { select: { userId: true } } },
  });
  if (!content || content.influencer.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
  }
  return content;
}

async function verifyInfluencerOwnership(influencerId: string, clerkId: string) {
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
// Zod
// ──────────────────────────────────────────────

const platformValues = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const publishRouter = createTRPCRouter({
  /**
   * scheduleContent — Schedule a content for future publication
   */
  scheduleContent: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        platforms: z.array(z.enum(platformValues)).min(1),
        scheduledAt: z.string().transform((s) => new Date(s)),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const content = await verifyContentOwnership(input.contentId, user.id);

      if (content.status !== "READY" && content.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seuls les contenus prêts ou en brouillon peuvent être programmés.",
        });
      }

      if (input.scheduledAt <= new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La date de programmation doit être dans le futur.",
        });
      }

      const updated = await db.content.update({
        where: { id: input.contentId },
        data: {
          status: "SCHEDULED",
          platforms: input.platforms,
          scheduledAt: input.scheduledAt,
        },
      });

      return updated;
    }),

  /**
   * cancelSchedule — Cancel a scheduled publication
   */
  cancelSchedule: protectedProcedure
    .input(z.object({ contentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const content = await verifyContentOwnership(input.contentId, user.id);

      if (content.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce contenu n'est pas programmé.",
        });
      }

      const updated = await db.content.update({
        where: { id: input.contentId },
        data: {
          status: "READY",
          scheduledAt: null,
        },
      });

      return updated;
    }),

  /**
   * publishNow — Trigger immediate publication
   */
  publishNow: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        platforms: z.array(z.enum(platformValues)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const content = await verifyContentOwnership(input.contentId, user.id);

      if (content.status !== "READY" && content.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce contenu ne peut pas être publié dans son état actuel.",
        });
      }

      const contentWithInfluencer = await db.content.findUnique({
        where: { id: input.contentId },
        include: {
          influencer: {
            include: {
              socialAccounts: {
                select: {
                  id: true,
                  platform: true,
                  accessToken: true,
                  refreshToken: true,
                  platformUserId: true,
                  isConnected: true,
                },
              },
            },
          },
        },
      });

      if (!contentWithInfluencer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      }

      const { publishContent: doPublish, savePublishResults } = await import(
        "@/server/services/publisher.service"
      );
      const results = await doPublish({
        ...contentWithInfluencer,
        platforms: input.platforms as ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[],
      });
      await savePublishResults(input.contentId, results);

      const created = await db.publishResult.findMany({
        where: { contentId: input.contentId },
        orderBy: { createdAt: "desc" },
        take: results.length,
      });

      return { results: created };
    }),

  /**
   * connectInstagram — Retourne l'URL d'autorisation OAuth Instagram.
   * Le client redirige l'utilisateur vers cette URL. state = influencerId.
   */
  connectInstagram: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyInfluencerOwnership(input.influencerId, ctx.userId);
      const redirectUri = `${APP_URL}/api/auth/instagram`;
      const url = instagram.getAuthUrl(redirectUri, input.influencerId);
      return { url };
    }),

  /**
   * connectTiktok — Retourne l'URL d'autorisation OAuth TikTok.
   */
  connectTiktok: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyInfluencerOwnership(input.influencerId, ctx.userId);
      const redirectUri = `${APP_URL}/api/auth/tiktok`;
      const url = tiktok.getAuthUrl(redirectUri, input.influencerId);
      return { url };
    }),

  /**
   * disconnectAccount — Supprime le token et met isConnected à false.
   */
  disconnectAccount: protectedProcedure
    .input(z.object({ socialAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const account = await db.socialAccount.findUnique({
        where: { id: input.socialAccountId },
        include: { influencer: { select: { userId: true } } },
      });
      if (!account || account.influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Compte social non trouvé" });
      }
      await db.socialAccount.update({
        where: { id: input.socialAccountId },
        data: {
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isConnected: false,
        },
      });
      return { ok: true };
    }),

  /**
   * getConnectedAccounts — Comptes connectés pour une influenceuse.
   */
  getConnectedAccounts: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyInfluencerOwnership(input.influencerId, ctx.userId);
      const accounts = await db.socialAccount.findMany({
        where: { influencerId: input.influencerId },
        select: {
          id: true,
          platform: true,
          username: true,
          isConnected: true,
          tokenExpiresAt: true,
          followers: true,
        },
      });
      return accounts;
    }),

  /**
   * getUpcoming — Next 5 scheduled contents, ordered by scheduledAt ASC (for dashboard)
   */
  getUpcoming: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    const contents = await db.content.findMany({
      where: {
        influencer: { userId: user.id },
        status: "SCHEDULED",
        scheduledAt: { gte: new Date() },
      },
      include: {
        influencer: { select: { id: true, name: true, slug: true, niche: true, avatarUrl: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    });
    return contents;
  }),

  /**
   * getScheduled — All scheduled content for the user
   */
  getScheduled: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    const contents = await db.content.findMany({
      where: {
        influencer: { userId: user.id },
        status: "SCHEDULED",
      },
      include: {
        influencer: { select: { id: true, name: true, slug: true, niche: true, avatarUrl: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return contents;
  }),

  /**
   * getCalendarEvents — Content for a date range (for calendar view)
   */
  getCalendarEvents: protectedProcedure
    .input(
      z.object({
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const contents = await db.content.findMany({
        where: {
          influencer: { userId: user.id },
          OR: [
            {
              status: "SCHEDULED",
              scheduledAt: { gte: input.startDate, lte: input.endDate },
            },
            {
              status: "PUBLISHED",
              publishedAt: { gte: input.startDate, lte: input.endDate },
            },
            {
              status: "FAILED",
              scheduledAt: { gte: input.startDate, lte: input.endDate },
            },
          ],
        },
        include: {
          influencer: { select: { id: true, name: true, slug: true, niche: true, avatarUrl: true } },
        },
        orderBy: { scheduledAt: "asc" },
      });

      // Format as calendar events
      const events = contents.map((c) => ({
        id: c.id,
        type: c.type,
        status: c.status,
        date: (c.scheduledAt ?? c.publishedAt ?? c.createdAt).toISOString(),
        platforms: c.platforms,
        thumbnailUrl: c.thumbnailUrl,
        caption: c.caption,
        hashtags: c.hashtags,
        mediaUrls: c.mediaUrls,
        influencer: c.influencer,
      }));

      return events;
    }),
});
