import { z } from "zod";
import { TRPCError } from "@trpc/server";
import slugify from "slugify";
import { nanoid } from "nanoid";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { PLANS } from "@/lib/constants";
import {
  estimateLoraCreditCost,
  LORA_MONTHLY_CAP_PER_USER,
  parseLoraDataset,
} from "@/lib/lora";
import type { Plan } from "@/generated/prisma/client";

import { getDbUser } from "@/server/helpers/get-db-user";
import { parseIdentityPack } from "@/lib/identity-pack";
import { nicheProfileSchema } from "@/lib/niche-profile";

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

import { extendedStyleSchema } from "@/lib/appearance-v2";

const styleSchema = extendedStyleSchema;

/** Brief is server-only context for agents — never expose via tRPC reads. */
function stripInfluencerBrief<T extends { brief?: string | null }>(
  row: T
): Omit<T, "brief"> {
  const { brief: _brief, ...rest } = row;
  return rest;
}

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
        influencers: influencers.map(stripInfluencerBrief),
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

      return stripInfluencerBrief(influencer);
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
        brief: z.string().max(1000).optional(),
        nicheProfile: nicheProfileSchema.optional(),
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
          brief: input.brief?.trim() || undefined,
          nicheProfile: input.nicheProfile
            ? (input.nicheProfile as object)
            : undefined,
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

      return stripInfluencerBrief(influencer);
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
   * getIdentityPackStatus — Poll wizard wait screen + photo studio banner.
   */
  getIdentityPackStatus: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { influencer } = await verifyOwnership(
        input.influencerId,
        ctx.userId
      );
      const pack = parseIdentityPack(influencer.identityPack);
      return {
        status: pack?.status ?? ("pending" as const),
        shotsReady: pack?.shots?.length ?? 0,
        totalShots: 4 as const,
      };
    }),

  /**
   * regenerateIdentityPack — Relance le kit identité en arrière-plan (wizard retry).
   */
  regenerateIdentityPack: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user, influencer } = await verifyOwnership(
        input.influencerId,
        ctx.userId
      );
      if (!influencer.baseImageUrl?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pas de portrait de base",
        });
      }
      if (influencer.isNsfw) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le kit identité n'est pas disponible en mode NSFW.",
        });
      }

      const baseUrl = influencer.baseImageUrl.trim();
      ctx.scheduleAfter(async () => {
        const { scheduleIdentityPackGeneration } = await import(
          "@/server/services/identity-pack.service"
        );
        await scheduleIdentityPackGeneration(user.id, input.influencerId, baseUrl, {
          complimentary: true,
        });
      });

      return { started: true as const };
    }),

  /** Poll LoRA training status for an influencer. */
  getLoraStatus: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { user, influencer } = await verifyOwnership(
        input.influencerId,
        ctx.userId
      );

      // Poll-on-read recovery: finalize a FAL training whose background
      // worker died (common on serverless) so the status never gets stuck
      // on TRAINING forever. No-op for in-process / already-finished jobs.
      let current = influencer;
      if (
        influencer.loraStatus === "TRAINING" &&
        influencer.loraTrainingJobId?.startsWith("fal:")
      ) {
        try {
          const { recoverFalLoraTraining } = await import(
            "@/server/services/lora-training.service"
          );
          await recoverFalLoraTraining(user.id, influencer);
          current =
            (await db.influencer.findUnique({
              where: { id: input.influencerId },
            })) ?? influencer;
        } catch (err) {
          console.warn(
            "[influencer.getLoraStatus] recovery failed:",
            err instanceof Error ? err.message : err
          );
        }
      }

      const dataset = parseLoraDataset(current.loraDataset);
      const datasetReady =
        dataset?.status === "ready" && Boolean(dataset?.zipUrl);
      return {
        status: current.loraStatus,
        loraUrl: current.loraUrl,
        triggerWord: current.loraTriggerWord,
        trainedAt: current.loraTrainedAt,
        datasetStatus: dataset?.status ?? null,
        datasetImageCount: dataset?.imageUrls.length ?? 0,
        creditCost: estimateLoraCreditCost(datasetReady),
      };
    }),

  /** Start character LoRA dataset + training (async, long-running). */
  trainCharacterLora: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user, influencer } = await verifyOwnership(
        input.influencerId,
        ctx.userId
      );
      if (influencer.isNsfw) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le LoRA personnage n'est pas disponible en mode NSFW.",
        });
      }
      if (!influencer.baseImageUrl?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ajoute d'abord un portrait de base.",
        });
      }
      if (influencer.loraStatus === "TRAINING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Un entraînement LoRA est déjà en cours.",
        });
      }

      const planConfig = PLANS[user.plan as Plan];
      if (!planConfig.hasCharacterLora) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "UPGRADE_REQUIRED:character_lora_required",
        });
      }

      const rollingSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentTrainCount = await db.influencer.count({
        where: {
          userId: user.id,
          id: { not: input.influencerId },
          OR: [
            { loraStatus: "TRAINING" },
            { loraTrainedAt: { gte: rollingSince } },
          ],
        },
      });
      if (
        recentTrainCount >= LORA_MONTHLY_CAP_PER_USER &&
        influencer.loraStatus !== "FAILED"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite atteinte : ${LORA_MONTHLY_CAP_PER_USER} entraînements LoRA max par mois.`,
        });
      }

      // Verify credits UP FRONT so the user gets an immediate, explicit
      // error instead of a silent background failure. The dataset step is
      // skipped (and not charged) when a ready dataset already exists.
      const existingDataset = parseLoraDataset(influencer.loraDataset);
      const datasetReady =
        existingDataset?.status === "ready" && Boolean(existingDataset.zipUrl);
      const requiredCredits = estimateLoraCreditCost(datasetReady);

      const { checkCredits } = await import(
        "@/server/services/credits.service"
      );
      if (!(await checkCredits(user.id, requiredCredits))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants : l'entraînement LoRA nécessite ${requiredCredits} crédits.`,
        });
      }

      ctx.scheduleAfter(async () => {
        const { scheduleLoraTraining } = await import(
          "@/server/services/lora-training.service"
        );
        await scheduleLoraTraining(user.id, input.influencerId);
      });

      return { started: true as const };
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
        brief: z.string().max(1000).optional().nullable(),
        nicheProfile: nicheProfileSchema.optional(),
        niche: z.enum(nicheValues).optional(),
        age: z.number().int().min(18).max(80).optional(),
        style: styleSchema.optional(),
        isNsfw: z.boolean().optional(),
        // Sprint — when the influencer was created early (Instagram OAuth at
        // step 3) the wizard's step-4 "update" must still be able to attach
        // the social handles declared after that early create.
        socialAccounts: z
          .array(
            z.object({
              platform: z.enum(["INSTAGRAM", "TIKTOK", "ONLYFANS"]),
              username: z.string().trim().min(1).max(60),
            })
          )
          .max(3)
          .optional(),
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
      const { id, appearanceVariations, nicheProfile, socialAccounts, ...rest } =
        input;
      const data = rest;
      await verifyOwnership(id, ctx.userId);

      // Sync declared social handles (de-duped per platform). Done before the
      // influencer update so the `include` below returns the fresh rows.
      if (socialAccounts && socialAccounts.length > 0) {
        const deduped = new Map<string, string>();
        for (const acc of socialAccounts) {
          const handle = acc.username.replace(/^@+/, "").trim();
          if (handle) deduped.set(acc.platform, handle);
        }
        for (const [platform, username] of deduped) {
          await db.socialAccount.upsert({
            where: {
              influencerId_platform: {
                influencerId: id,
                platform: platform as "INSTAGRAM" | "TIKTOK" | "ONLYFANS",
              },
            },
            create: {
              influencerId: id,
              platform: platform as "INSTAGRAM" | "TIKTOK" | "ONLYFANS",
              username,
              isConnected: false,
            },
            update: { username },
          });
        }
      }

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
          ...(nicheProfile
            ? { nicheProfile: nicheProfile as object }
            : {}),
        },
        include: {
          socialAccounts: true,
          analytics: true,
        },
      });

      return stripInfluencerBrief(influencer);
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
