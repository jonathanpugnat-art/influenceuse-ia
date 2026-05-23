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
   * Sprint 12 — suggestPersona
   * Returns 3 distinct {bio, personality} drafts so the wizard can offer a
   * "magic" autofill button. Free of charge: we don't deduct credits to keep
   * the friction at zero (LLM cost is negligible vs the activation gain).
   */
  suggestPersona: protectedProcedure
    .input(
      z.object({
        name: z.string().max(50).optional(),
        niche: z.enum(nicheValues),
        gender: z.enum(["female", "male", "nonbinary"]).default("female"),
        language: z.enum(["fr", "en"]).default("fr"),
        tone: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { generatePersonaIdeas } = await import(
        "@/server/services/ai-text.service"
      );
      try {
        const ideas = await generatePersonaIdeas({
          name: input.name,
          niche: input.niche,
          gender: input.gender,
          language: input.language,
          tone: input.tone,
        });
        return ideas;
      } catch (err) {
        console.error("[influencer.suggestPersona]", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Impossible de générer des suggestions pour le moment. Réessaie dans quelques secondes.",
        });
      }
    }),

  /**
   * create – Crée une nouvelle influenceuse
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50),
        gender: z.enum(["female", "male", "nonbinary"]).default("female"),
        bio: z.string().min(10).max(2000),
        personality: z.string().min(10).max(2000),
        niche: z.enum(nicheValues),
        age: z.number().int().min(18).max(80),
        style: styleSchema,
        isNsfw: z.boolean().default(false),
        baseImageUrl: z.string().min(1).optional().nullable(),
        avatarUrl: z.string().min(1).optional().nullable(),
        // Sprint 13 — appearance uniqueness guard. The wizard's
        // `generateBaseImage` mutation returns these alongside imageUrls;
        // the client forwards them here so we can persist + index them.
        // Both are optional: the wizard may not have called generateBaseImage
        // (e.g. user uploaded their own portrait) in which case they remain
        // NULL and just won't participate in the duplicate-detection index.
        appearanceVariations: z
          .object({
            faceShape: z.number().int().min(0),
            eyeShape: z.number().int().min(0),
            eyeColor: z.number().int().min(0),
            nose: z.number().int().min(0),
            distinctiveFeature: z.number().int().min(0),
            expression: z.number().int().min(0),
          })
          .optional(),
        appearanceFingerprint: z.string().length(8).optional(),
        // Sprint 14 — Grok flagged that the wizard "Réseaux" step had no
        // backend wiring: toggles + handles lived only in the Zustand
        // store and were silently dropped on submit. We now accept an
        // optional list of social accounts and persist them as
        // SocialAccount rows so they appear on the influencer profile
        // immediately. Empty/blank handles are filtered out before insert.
        socialAccounts: z
          .array(
            z.object({
              platform: z.enum(["INSTAGRAM", "TIKTOK", "ONLYFANS"]),
              username: z.string().trim().min(1).max(60),
            })
          )
          .max(3)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const scheduleAfter = ctx.scheduleAfter;

      // Check plan limit
      const planConfig = PLANS[user.plan as Plan];
      const currentCount = await db.influencer.count({
        where: { userId: user.id, status: { not: "ARCHIVED" } },
      });

      if (currentCount >= planConfig.maxInfluencers) {
        throw new TRPCError({
          code: "FORBIDDEN",
          // Tag prefix consumed by `useUpgradeOnLimitError` on the client to
          // open the contextual upgrade modal (Phase 6).
          message: `UPGRADE_REQUIRED:max_influencers:${planConfig.name}:${planConfig.maxInfluencers}`,
        });
      }

      // Generate unique slug
      const baseSlug = slugify(input.name, { lower: true, strict: true });
      const slug = `${baseSlug}-${nanoid(6)}`;

      // Sprint 14 — de-dupe social accounts (the @@unique [influencerId,
      // platform] index would throw otherwise) and normalize the handle by
      // stripping the optional leading '@'.
      const dedupedSocials = new Map<string, string>();
      for (const acc of input.socialAccounts ?? []) {
        const handle = acc.username.replace(/^@+/, "").trim();
        if (handle) dedupedSocials.set(acc.platform, handle);
      }

      // Create influencer + nested socials in a single roundtrip
      const influencer = await db.influencer.create({
        data: {
          userId: user.id,
          name: input.name,
          gender: input.gender,
          slug,
          bio: input.bio,
          personality: input.personality,
          niche: input.niche,
          age: input.age,
          style: input.style as object,
          isNsfw: input.isNsfw,
          baseImageUrl: input.baseImageUrl ?? undefined,
          avatarUrl: input.avatarUrl ?? input.baseImageUrl ?? undefined,
          appearanceVariations: input.appearanceVariations
            ? (input.appearanceVariations as object)
            : undefined,
          appearanceFingerprint: input.appearanceFingerprint ?? undefined,
          ...(dedupedSocials.size > 0
            ? {
                socialAccounts: {
                  create: Array.from(dedupedSocials.entries()).map(
                    ([platform, username]) => ({
                      platform: platform as "INSTAGRAM" | "TIKTOK" | "ONLYFANS",
                      username,
                      // isConnected stays false — these are just declared
                      // handles, not actual OAuth-connected accounts.
                      isConnected: false,
                    })
                  ),
                },
              }
            : {}),
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

      // IG-realism: multi-angle 2D identity pack (free on first create).
      if (input.baseImageUrl?.trim() && !input.isNsfw) {
        const baseUrl = input.baseImageUrl.trim();
        const influencerId = influencer.id;
        const userId = user.id;
        scheduleAfter(async () => {
          try {
            const { scheduleIdentityPackGeneration } = await import(
              "@/server/services/identity-pack.service"
            );
            await scheduleIdentityPackGeneration(userId, influencerId, baseUrl, {
              complimentary: true,
            });
          } catch (err) {
            console.error(
              "[influencer.create] identity pack failed:",
              err instanceof Error ? err.message : err
            );
          }
        });
      }

      return influencer;
    }),

  /**
   * generateIdentityPack — (re)build multi-angle refs from base portrait.
   */
  generateIdentityPack: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user, influencer } = await verifyOwnership(
        input.influencerId,
        ctx.userId
      );
      if (influencer.isNsfw) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le kit identité n'est pas disponible en mode NSFW.",
        });
      }
      if (!influencer.baseImageUrl?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ajoute d'abord un portrait de base.",
        });
      }
      const { generateAndPersistIdentityPack } = await import(
        "@/server/services/identity-pack.service"
      );
      return generateAndPersistIdentityPack(user.id, influencer.id);
    }),

  /**
   * update – Met à jour une influenceuse
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(50).optional(),
        gender: z.enum(["female", "male", "nonbinary"]).optional(),
        bio: z.string().min(10).max(2000).optional(),
        personality: z.string().min(10).max(2000).optional(),
        niche: z.enum(nicheValues).optional(),
        age: z.number().int().min(18).max(80).optional(),
        style: styleSchema.optional(),
        isNsfw: z.boolean().optional(),
        avatarUrl: z.string().min(1).optional().nullable(),
        baseImageUrl: z.string().min(1).optional().nullable(),
        // Sprint 13 — when the user regenerates the base image from the edit
        // page, the new portrait carries fresh appearance variations and a
        // new fingerprint. Persist them so the duplicate-detection index
        // tracks the live identity, not the original wizard one.
        appearanceVariations: z
          .object({
            faceShape: z.number().int().min(0),
            eyeShape: z.number().int().min(0),
            eyeColor: z.number().int().min(0),
            nose: z.number().int().min(0),
            distinctiveFeature: z.number().int().min(0),
            expression: z.number().int().min(0),
          })
          .optional(),
        appearanceFingerprint: z.string().length(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, appearanceVariations, ...rest } = input;
      const data = rest;
      await verifyOwnership(id, ctx.userId);

      const influencer = await db.influencer.update({
        where: { id },
        data: {
          ...data,
          ...(data.style
            ? { style: data.style as object }
            : {}),
          ...(appearanceVariations
            ? { appearanceVariations: appearanceVariations as object }
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

  /**
   * checkAppearanceCollision — Sprint 13 uniqueness guard.
   *
   * Given a fingerprint (returned by `content.generateBaseImage`), counts
   * how many OTHER active influencers across the platform share the same
   * visual identity tuple. Used by the wizard's summary step to surface
   * a soft warning ("Hey, 2 other creators picked these exact traits, want
   * to regenerate for a more unique look?") without blocking creation.
   *
   * Returns a count rather than the actual rows so we never leak other
   * users' influencer data — privacy-by-design.
   */
  checkAppearanceCollision: protectedProcedure
    .input(z.object({ fingerprint: z.string().length(8) }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const count = await db.influencer.count({
        where: {
          appearanceFingerprint: input.fingerprint,
          status: { not: "ARCHIVED" },
          // Don't count the user's OWN influencers (they may have intentionally
          // regenerated and we don't want to scare them off their own draft).
          NOT: { userId: user.id },
        },
      });
      return { count, hasCollision: count > 0 };
    }),
});
