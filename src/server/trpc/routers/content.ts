import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { CREDIT_COSTS } from "@/lib/constants";
import { generateBaseImage as genBaseImage, generateContentImage } from "@/server/services/ai-image.service";
import type { AppearanceVariation } from "@/lib/prompts/image-prompts";
import { normalizeAppearanceVariation } from "@/lib/prompts/appearance-variation-ui";
import { generateVideo } from "@/server/services/ai-video.service";
import { generateCaption as genCaption, generateHashtags as genHashtags, generateContentPlan as genContentPlan, generateIdeas as genIdeas } from "@/server/services/ai-text.service";
import { processNextBatchSlice, getBatchStatus } from "@/server/services/batch.service";
import {
  listRecycleCandidates,
  recyclePost,
} from "@/server/services/content-recycler.service";
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
        gender: z.enum(["female", "male", "nonbinary"]).default("female"),
        style: styleInputSchema,
        /** Wizard expert mode — optional fixed trait indices from UI chips. */
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const result = await genBaseImage(
        user.id,
        input.age,
        {
          gender: input.gender,
          ethnicity: input.style.ethnicity,
          hairColor: input.style.hairColor,
          hairStyle: input.style.hairStyle,
          bodyType: input.style.bodyType,
          fashionStyle: input.style.fashionStyle,
        },
        input.appearanceVariations
          ? normalizeAppearanceVariation(input.appearanceVariations)
          : undefined
      );
      // The wizard surfaces `appearanceVariations` + `appearanceFingerprint`
      // back to the client so the create-influencer mutation can persist
      // them on the same Influencer row that ends up with this baseImageUrl.
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
        location: z.string().optional(),
        customPrompt: z.string().optional(),
        numberOfImages: z.number().int().min(1).max(4).default(1),
        contentMode: z.enum(contentModeValues).default("SFW"),
        nsfwLevel: z.string().optional(),
        /** Lock face to base/avatar reference (SFW Flux only; NSFW model has no image conditioning). */
        useFaceReference: z.boolean().default(true),
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

      const hasRef =
        Boolean(influencer.baseImageUrl?.trim()) ||
        Boolean(influencer.avatarUrl?.trim());
      const useFaceLock = input.useFaceReference && hasRef;
      const referenceImageUrl = useFaceLock
        ? (influencer.baseImageUrl?.trim() || influencer.avatarUrl?.trim() || undefined)
        : undefined;

      const initialGenerationParams = {
        scene: input.scene,
        pose: input.pose,
        outfit: input.outfit,
        expression: input.expression,
        photoStyle: input.photoStyle,
        timeOfDay: input.timeOfDay,
        location: input.location,
        customPrompt: input.customPrompt,
        numberOfImages: input.numberOfImages,
        useFaceReference: input.useFaceReference,
        hasReferenceImage: Boolean(referenceImageUrl),
      } as object;

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
          generationParams: initialGenerationParams,
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
      // Sprint 14 — read the per-influencer visual DNA (Sprint 13 row) and
      // forward it so the content prompt re-uses the same facial trait
      // keywords as the portrait wizard. NULL on legacy rows is fine —
      // buildFullPrompt just skips the trait block.
      const appearanceVariations =
        (influencer.appearanceVariations as AppearanceVariation | null) ?? undefined;
      generateContentImage(user.id, influencer.age, {
        gender: (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
        ethnicity: style?.ethnicity,
        hairColor: style?.hairColor,
        hairStyle: style?.hairStyle,
        bodyType: style?.bodyType,
        fashionStyle: style?.fashionStyle,
      }, {
        influencerId: influencer.id,
        baseImageUrl: referenceImageUrl,
        useReferenceFace: input.useFaceReference,
        scene: input.scene,
        pose: input.pose,
        outfit: input.outfit,
        expression: input.expression,
        style: input.photoStyle,
        lighting: input.timeOfDay,
        location: input.location,
        isNsfw: input.contentMode === "NSFW",
        nsfwLevel: input.nsfwLevel,
        customPrompt: input.customPrompt,
        numberOfImages: input.numberOfImages,
        appearanceVariations,
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
              generationParams: {
                ...initialGenerationParams,
                modelParams: result.parameters as object,
              } as object,
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
        /** stable_face: max identity; natural_motion: balanced; creative: prompt optimizer on */
        reelStylePreset: z
          .enum(["stable_face", "natural_motion", "creative"])
          .default("stable_face"),
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

      const baseImage = influencer.baseImageUrl.trim();
      const avatarImage = influencer.avatarUrl?.trim();
      // Only forward the avatar as a *separate* subject reference when it
      // actually differs from the base image. The previous fallback
      // (`avatarImage ?? baseImage`) caused the MiniMax E006 error
      // ("cannot use both first_frame_image and subject_reference") whenever
      // the wizard had set avatarUrl = baseImageUrl, which is the default
      // path. The video service ignores it correctly when undefined.
      const subjectReferenceUrl =
        avatarImage && avatarImage !== baseImage ? avatarImage : undefined;

      const initialReelParams = {
        duration: input.duration,
        format: input.format,
        videoType: input.videoType,
        script: input.script,
        music: input.music,
        effects: input.effects,
        textOverlay: input.textOverlay,
        reelStylePreset: input.reelStylePreset,
      } as object;

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
          generationParams: initialReelParams,
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
      const effectsStr =
        input.effects && input.effects.length > 0
          ? input.effects.join(",")
          : undefined;
      generateVideo(user.id, {
        influencerId: influencer.id,
        baseImageUrl: baseImage,
        subjectReferenceUrl,
        duration: durationMap[input.duration] ?? 5,
        script: input.script,
        videoType: input.videoType,
        effects: effectsStr,
        reelStylePreset: input.reelStylePreset,
        isNsfw: input.contentMode === "NSFW",
      })
        .then(async (result) => {
          await db.content.update({
            where: { id: content.id },
            data: {
              status: "READY",
              mediaUrls: [result.videoUrl],
              thumbnailUrl: result.thumbnailUrl ?? null,
              generationParams: {
                ...initialReelParams,
                modelParams: result.parameters as object,
              } as object,
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
        influencerId: influencer.id, // Sprint 8: enable personality memory
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
   * generateContentPlan — Phase 3 editorial plan (multi-day, multi-platform).
   * Creates a ContentBatch + N Content rows in DRAFT, all linked to that batch.
   */
  generateContentPlan: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        days: z.number().int().min(1).max(14).default(7),
        postsPerDay: z.number().int().min(1).max(5).default(2),
        platforms: z.array(z.enum(platformValues)).min(1),
        language: z.enum(["fr", "en"]).default("fr"),
        goals: z.string().max(200).optional(),
        startDate: z.string().datetime().optional(),
        postingHours: z.array(z.number().int().min(0).max(23)).max(5).optional(),
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

      // Persist all posts as DRAFT Content rows tied to the batch.
      // We schedule them so they show up on the calendar immediately.
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

  /**
   * generateIdeas — Phase 3 short brainstorm of stand-alone ideas.
   */
  generateIdeas: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        platform: z.enum(platformValues),
        count: z.number().int().min(3).max(15).default(8),
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

  // ──────────────────────────────────────────────
  // Batch generation (Phase 4)
  // ──────────────────────────────────────────────

  /**
   * listBatches — Editorial batches owned by the current user.
   * Used by the calendar to show "X plans en cours" with a progress bar.
   */
  listBatches: protectedProcedure
    .input(
      z.object({
        influencerId: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const batches = await db.contentBatch.findMany({
        where: {
          influencer: { userId: user.id },
          ...(input.influencerId ? { influencerId: input.influencerId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          influencer: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { contents: true } },
        },
      });

      const statuses = await Promise.all(
        batches.map((b) => getBatchStatus(b.id))
      );

      return batches.map((b, i) => ({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt,
        influencer: b.influencer,
        total: b._count.contents,
        status: statuses[i],
      }));
    }),

  /**
   * getBatchStatus — Live progress for a single batch (DRAFT vs READY vs FAILED).
   */
  getBatchStatus: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const batch = await db.contentBatch.findUnique({
        where: { id: input.batchId },
        select: {
          id: true,
          influencer: { select: { userId: true } },
        },
      });
      if (!batch || batch.influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }

      const status = await getBatchStatus(input.batchId);
      if (!status) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }
      return status;
    }),

  /**
   * processBatchSlice — Manually trigger one slice (3 photos by default) for a batch.
   * The cron `/api/cron/process-batches` does this automatically every minute,
   * but this lets the user kick things off immediately after creating a plan
   * (no need to wait for the next tick).
   */
  processBatchSlice: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        sliceSize: z.number().int().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const batch = await db.contentBatch.findUnique({
        where: { id: input.batchId },
        select: { id: true, influencer: { select: { userId: true } } },
      });
      if (!batch || batch.influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }

      const result = await processNextBatchSlice({ sliceSize: input.sliceSize });
      return result;
    }),

  /**
   * retryBatchFailures — Reset FAILED drafts in a batch back to DRAFT so the
   * next slice picks them up again.
   */
  retryBatchFailures: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);

      const batch = await db.contentBatch.findUnique({
        where: { id: input.batchId },
        select: { id: true, influencer: { select: { userId: true } } },
      });
      if (!batch || batch.influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }

      const { count } = await db.content.updateMany({
        where: { batchId: input.batchId, status: "FAILED" },
        data: { status: "DRAFT" },
      });

      return { reset: count };
    }),

  // ──────────────────────────────────────────────
  // Sprint 8 — Content Recycler
  // ──────────────────────────────────────────────

  /**
   * listRecycleCandidates — Returns the user's top-performing PUBLISHED posts
   * eligible for recycling (engagement >= threshold, not recently recycled).
   */
  listRecycleCandidates: protectedProcedure
    .input(z.object({ influencerId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      return await listRecycleCandidates(user.id, input?.influencerId);
    }),

  /**
   * recyclePost — Creates a fresh DRAFT (or SCHEDULED) Content from a top
   * performer, reusing media but with a regenerated caption.
   */
  recyclePost: protectedProcedure
    .input(
      z.object({
        sourceContentId: z.string(),
        scheduledFor: z.date().optional(),
        language: z.enum(["fr", "en"]).default("fr"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const newContentId = await recyclePost({
        userId: user.id,
        sourceContentId: input.sourceContentId,
        scheduledFor: input.scheduledFor,
        language: input.language,
      });
      return { contentId: newContentId };
    }),

  // ──────────────────────────────────────────────
  // Sprint 8 — A/B caption variants
  // ──────────────────────────────────────────────

  /**
   * generateCaptionVariants — Returns 2 distinct captions for the same content
   * description so the user can pick the one they prefer (poor man's A/B).
   * Costs 2× the standard caption budget.
   */
  generateCaptionVariants: protectedProcedure
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

      // Two parallel calls so latency is one caption, not two.
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
