import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { CREDIT_COSTS } from "@/lib/constants";
import { generateBaseImage as genBaseImage, generateContentImage } from "@/server/services/ai-image.service";
import { generateVideo } from "@/server/services/ai-video.service";
import { generateCaption as genCaption, generateHashtags as genHashtags } from "@/server/services/ai-text.service";
import { createZipBundleFromUrls } from "@/server/services/storage.service";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";

import { getDbUser } from "@/server/helpers/get-db-user";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function verifyContentOwnership(contentId: string, clerkId: string) {
  const user = await getDbUser(clerkId);
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { influencer: { select: { userId: true } } },
  });
  if (!content || content.influencer.userId !== user.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
  }
  return { user, content };
}

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const platformValues = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;
const contentTypeValues = ["PHOTO", "CAROUSEL", "REEL", "STORY"] as const;
const contentStatusValues = ["DRAFT", "GENERATING", "READY", "SCHEDULED", "PUBLISHED", "FAILED"] as const;
const contentModeValues = ["SFW", "NSFW"] as const;

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

const styleInputSchema = z.object({
  ethnicity: z.string().optional(),
  hairColor: z.string().optional(),
  hairStyle: z.string().optional(),
  bodyType: z.string().optional(),
  fashionStyle: z.string().optional(),
});

export const contentRouter = createTRPCRouter({
  /**
   * generateBaseImage — Generate 4 base portrait variants for new influencer (wizard).
   * Cost: CREDIT_COSTS.BASE_IMAGE per call.
   */
  generateBaseImage: protectedProcedure
    .input(
      z.object({
        age: z.number().int().min(18).max(80),
        style: styleInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const result = await genBaseImage(user.id, input.age, {
        ethnicity: input.style.ethnicity,
        hairColor: input.style.hairColor,
        hairStyle: input.style.hairStyle,
        bodyType: input.style.bodyType,
        fashionStyle: input.style.fashionStyle,
      });
      return result;
    }),

  /**
   * generatePhoto — Start AI photo generation
   */
  generatePhoto: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        scene: z.string(),
        pose: z.string(),
        outfit: z.string().default(""),
        expression: z.string().default("natural"),
        photoStyle: z.string().default("natural"),
        timeOfDay: z.string().default("natural"),
        customPrompt: z.string().optional(),
        numberOfImages: z.number().int().min(1).max(4).default(1),
        contentMode: z.enum(contentModeValues).default("SFW"),
        nsfwLevel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      // Verify influencer ownership
      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      // Check credits
      const cost = input.numberOfImages * CREDIT_COSTS.PHOTO;
      const hasCredits = await checkCredits(user.id, cost);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost}, Restant : calculé.`,
        });
      }

      // Create content in DB with GENERATING status
      const content = await db.content.create({
        data: {
          influencerId: influencer.id,
          type: "PHOTO",
          contentMode: input.contentMode,
          status: "GENERATING",
          platforms: [],
          mediaUrls: [],
          hashtags: [],
          promptUsed: "",
          generationParams: {
            scene: input.scene,
            pose: input.pose,
            outfit: input.outfit,
            expression: input.expression,
            photoStyle: input.photoStyle,
            timeOfDay: input.timeOfDay,
            customPrompt: input.customPrompt,
            numberOfImages: input.numberOfImages,
          } as object,
        },
      });

      // Create generation job
      await db.generationJob.create({
        data: {
          userId: user.id,
          influencerId: influencer.id,
          contentId: content.id,
          type: "IMAGE",
          status: "PENDING",
          prompt: "",
          creditsUsed: cost,
        },
      });

      // Start async generation (fire and forget — status will be polled)
      const style = influencer.style as Record<string, string> | null;
      generateContentImage(user.id, influencer.age, {
        ethnicity: style?.ethnicity,
        hairColor: style?.hairColor,
        hairStyle: style?.hairStyle,
        bodyType: style?.bodyType,
        fashionStyle: style?.fashionStyle,
      }, {
        influencerId: influencer.id,
        baseImageUrl: influencer.baseImageUrl ?? undefined,
        scene: input.scene,
        pose: input.pose,
        outfit: input.outfit,
        expression: input.expression,
        style: input.photoStyle,
        lighting: input.timeOfDay,
        isNsfw: input.contentMode === "NSFW",
        nsfwLevel: input.nsfwLevel,
        customPrompt: input.customPrompt,
        numberOfImages: input.numberOfImages,
      })
        .then(async (result) => {
          // Update content with results
          await db.content.update({
            where: { id: content.id },
            data: {
              status: "READY",
              mediaUrls: result.imageUrls,
              thumbnailUrl: result.imageUrls[0] ?? null,
              promptUsed: result.promptUsed,
              negativePrompt: result.negativePrompt,
              generationParams: result.parameters as object,
            },
          });
          await db.generationJob.updateMany({
            where: { contentId: content.id },
            data: { status: "COMPLETED", completedAt: new Date(), resultUrl: result.imageUrls[0] },
          });
        })
        .catch(async (error) => {
          console.error("[content.generatePhoto] Generation failed:", error);
          await db.content.update({
            where: { id: content.id },
            data: { status: "FAILED" },
          });
          await db.generationJob.updateMany({
            where: { contentId: content.id },
            data: { status: "FAILED", error: String(error) },
          });
        });

      return { contentId: content.id, cost };
    }),

  /**
   * generateReel — Start AI video/reel generation
   */
  generateReel: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        duration: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(15),
        format: z.enum(["VERTICAL", "SQUARE"]).default("VERTICAL"),
        videoType: z.string(),
        script: z.string().min(10),
        music: z.string().optional(),
        effects: z.array(z.string()).optional(),
        textOverlay: z.string().optional(),
        contentMode: z.enum(contentModeValues).default("SFW"),
        nsfwLevel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      // Verify plan — video requires Pro or Enterprise
      const planConfig = PLANS[user.plan as Plan];
      if (!planConfig.hasVideo) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "La génération de vidéo nécessite le plan Pro ou Enterprise.",
        });
      }

      // Verify influencer ownership
      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      if (!influencer.baseImageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "L'influenceuse doit avoir une image de base pour générer des reels. Génère d'abord une photo.",
        });
      }

      // Check credits
      const cost = CREDIT_COSTS.REEL;
      const hasCredits = await checkCredits(user.id, cost);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost} crédits.`,
        });
      }

      // Create content in DB
      const content = await db.content.create({
        data: {
          influencerId: influencer.id,
          type: "REEL",
          contentMode: input.contentMode,
          status: "GENERATING",
          platforms: [],
          mediaUrls: [],
          hashtags: [],
          promptUsed: input.script,
          generationParams: {
            duration: input.duration,
            format: input.format,
            videoType: input.videoType,
            script: input.script,
            music: input.music,
            effects: input.effects,
            textOverlay: input.textOverlay,
          } as object,
        },
      });

      // Create generation job
      await db.generationJob.create({
        data: {
          userId: user.id,
          influencerId: influencer.id,
          contentId: content.id,
          type: "VIDEO",
          status: "PENDING",
          prompt: input.script,
          creditsUsed: cost,
        },
      });

      // Start async generation
      const durationMap: Record<number, 5 | 10> = { 15: 5, 30: 10, 60: 10 };
      generateVideo(user.id, {
        influencerId: influencer.id,
        baseImageUrl: influencer.baseImageUrl,
        duration: durationMap[input.duration] ?? 5,
        script: input.script,
        videoType: input.videoType,
        effects: input.effects?.[0],
        isNsfw: input.contentMode === "NSFW",
      })
        .then(async (result) => {
          await db.content.update({
            where: { id: content.id },
            data: {
              status: "READY",
              mediaUrls: [result.videoUrl],
              thumbnailUrl: result.thumbnailUrl ?? null,
              generationParams: result.parameters as object,
            },
          });
          await db.generationJob.updateMany({
            where: { contentId: content.id },
            data: { status: "COMPLETED", completedAt: new Date(), resultUrl: result.videoUrl },
          });
        })
        .catch(async (error) => {
          console.error("[content.generateReel] Generation failed:", error);
          await db.content.update({
            where: { id: content.id },
            data: { status: "FAILED" },
          });
          await db.generationJob.updateMany({
            where: { contentId: content.id },
            data: { status: "FAILED", error: String(error) },
          });
        });

      return { contentId: content.id, cost };
    }),

  /**
   * getGenerationStatus — Poll generation progress
   */
  getGenerationStatus: protectedProcedure
    .input(z.object({ contentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifyContentOwnership(input.contentId, ctx.userId);

      const content = await db.content.findUnique({
        where: { id: input.contentId },
        select: { status: true, mediaUrls: true, thumbnailUrl: true },
      });

      return content;
    }),

  /**
   * generateCaption — AI caption generation
   */
  generateCaption: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        contentDescription: z.string(),
        platform: z.enum(platformValues),
        language: z.enum(["fr", "en"]).default("fr"),
      })
    )
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
      });

      return { caption };
    }),

  /**
   * generateHashtags — AI hashtag generation
   */
  generateHashtags: protectedProcedure
    .input(
      z.object({
        niche: z.string(),
        platform: z.enum(platformValues),
        description: z.string(),
        count: z.number().int().min(5).max(30).default(15),
      })
    )
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

  /**
   * updateContent — Update content fields
   */
  updateContent: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        caption: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        platforms: z.array(z.enum(platformValues)).optional(),
        scheduledAt: z.date().optional().nullable(),
        status: z.enum(contentStatusValues).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { contentId, ...data } = input;
      await verifyContentOwnership(contentId, ctx.userId);

      const content = await db.content.update({
        where: { id: contentId },
        data,
      });

      return content;
    }),

  /**
   * deleteContent — Remove content
   */
  deleteContent: protectedProcedure
    .input(z.object({ contentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyContentOwnership(input.contentId, ctx.userId);

      await db.content.delete({ where: { id: input.contentId } });

      return { success: true };
    }),

  /**
   * getAll — List contents with filters and pagination
   */
  getAll: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        type: z.enum(contentTypeValues).optional(),
        status: z.enum(contentStatusValues).optional(),
        platform: z.enum(platformValues).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const { influencerId, type, status, platform, page, limit } = input;

      const where = {
        influencer: { userId: user.id },
        ...(influencerId ? { influencerId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(platform ? { platforms: { has: platform } } : {}),
      };

      const [contents, total] = await Promise.all([
        db.content.findMany({
          where,
          include: { influencer: { select: { id: true, name: true, slug: true, niche: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.content.count({ where }),
      ]);

      return { contents, total, page, totalPages: Math.ceil(total / limit) };
    }),

  /**
   * getById — Content detail
   */
  getById: protectedProcedure
    .input(z.object({ contentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { content } = await verifyContentOwnership(input.contentId, ctx.userId);

      const full = await db.content.findUnique({
        where: { id: content.id },
        include: {
          influencer: true,
          publishResults: true,
          contentAnalytics: true,
        },
      });

      return full;
    }),

  /**
   * prepareOnlyFansBundle — Create ZIP for OF download
   */
  prepareOnlyFansBundle: protectedProcedure
    .input(z.object({ contentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { content } = await verifyContentOwnership(input.contentId, ctx.userId);

      const full = await db.content.findUnique({
        where: { id: content.id },
        select: { mediaUrls: true, caption: true, hashtags: true },
      });

      if (!full || full.mediaUrls.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No media to bundle" });
      }

      const files = full.mediaUrls.map((url, i) => ({
        url,
        filename: `photo-${i + 1}.webp`,
      }));

      const captionText = [
        full.caption ?? "",
        "",
        full.hashtags.length > 0 ? full.hashtags.map((h) => `#${h}`).join(" ") : "",
      ].join("\n");

      const zipUrl = await createZipBundleFromUrls(files, captionText);

      return { downloadUrl: zipUrl };
    }),
});
