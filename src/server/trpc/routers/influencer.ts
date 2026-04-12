import { z } from "zod";
import { TRPCError } from "@trpc/server";
import slugify from "slugify";
import { nanoid } from "nanoid";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";

import { getDbUser } from "@/server/helpers/get-db-user";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function verifyOwnership(influencerId: string, clerkId: string) {
  const user = await getDbUser(clerkId);
  const influencer = await db.influencer.findUnique({
    where: { id: influencerId },
  });
  if (!influencer || influencer.userId !== user.id) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Influencer not found",
    });
  }
  return { user, influencer };
}

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const nicheValues = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
] as const;

const statusValues = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

const styleSchema = z.object({
  ethnicity: z.string().optional(),
  hairColor: z.string().optional(),
  hairStyle: z.string().optional(),
  bodyType: z.string().optional(),
  fashionStyle: z.string().optional(),
});

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const influencerRouter = createTRPCRouter({
  /**
   * getAll – Liste paginée des influenceuses de l'utilisateur
   */
  getAll: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        niche: z.enum(nicheValues).optional(),
        status: z.enum(statusValues).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(12),
        sortBy: z.string().default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const { search, niche, status, page, limit, sortBy, sortOrder } = input;

      const where = {
        userId: user.id,
        ...(status ? { status } : { status: { not: "ARCHIVED" as const } }),
        ...(niche ? { niche } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { bio: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [influencers, total] = await Promise.all([
        db.influencer.findMany({
          where,
          include: {
            socialAccounts: true,
            analytics: true,
            _count: { select: { contents: true } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.influencer.count({ where }),
      ]);

      return {
        influencers,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * getById – Détail complet d'une influenceuse
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const influencer = await db.influencer.findUnique({
        where: { id: input.id },
        include: {
          socialAccounts: true,
          analytics: true,
          contents: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          _count: { select: { contents: true } },
        },
      });

      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Influencer not found",
        });
      }

      return influencer;
    }),

  /**
   * create – Crée une nouvelle influenceuse
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50),
        bio: z.string().min(10).max(2000),
        personality: z.string().min(10).max(2000),
        niche: z.enum(nicheValues),
        age: z.number().int().min(18).max(80),
        style: styleSchema,
        isNsfw: z.boolean().default(false),
        baseImageUrl: z.string().min(1).optional().nullable(),
        avatarUrl: z.string().min(1).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      // Check plan limit
      const planConfig = PLANS[user.plan as Plan];
      const currentCount = await db.influencer.count({
        where: { userId: user.id, status: { not: "ARCHIVED" } },
      });

      if (currentCount >= planConfig.maxInfluencers) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Your ${planConfig.name} plan allows max ${planConfig.maxInfluencers} influencer(s). Upgrade to create more.`,
        });
      }

      // Generate unique slug
      const baseSlug = slugify(input.name, { lower: true, strict: true });
      const slug = `${baseSlug}-${nanoid(6)}`;

      // Create influencer + analytics in transaction
      const influencer = await db.influencer.create({
        data: {
          userId: user.id,
          name: input.name,
          slug,
          bio: input.bio,
          personality: input.personality,
          niche: input.niche,
          age: input.age,
          style: input.style as object,
          isNsfw: input.isNsfw,
          baseImageUrl: input.baseImageUrl ?? undefined,
          avatarUrl: input.avatarUrl ?? input.baseImageUrl ?? undefined,
        },
        include: {
          socialAccounts: true,
          analytics: true,
        },
      });

      // Create empty analytics
      await db.influencerAnalytics.create({
        data: { influencerId: influencer.id },
      });

      return influencer;
    }),

  /**
   * update – Met à jour une influenceuse
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(50).optional(),
        bio: z.string().min(10).max(2000).optional(),
        personality: z.string().min(10).max(2000).optional(),
        niche: z.enum(nicheValues).optional(),
        age: z.number().int().min(18).max(80).optional(),
        style: styleSchema.optional(),
        isNsfw: z.boolean().optional(),
        avatarUrl: z.string().min(1).optional().nullable(),
        baseImageUrl: z.string().min(1).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await verifyOwnership(id, ctx.userId);

      const influencer = await db.influencer.update({
        where: { id },
        data: {
          ...data,
          ...(data.style
            ? { style: data.style as object }
            : {}),
        },
        include: {
          socialAccounts: true,
          analytics: true,
        },
      });

      return influencer;
    }),

  /**
   * delete – Soft delete (archive)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyOwnership(input.id, ctx.userId);

      await db.influencer.update({
        where: { id: input.id },
        data: { status: "ARCHIVED" },
      });

      return { success: true };
    }),

  /**
   * updateStatus – Change le statut
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(statusValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyOwnership(input.id, ctx.userId);

      const influencer = await db.influencer.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      return influencer;
    }),
});
