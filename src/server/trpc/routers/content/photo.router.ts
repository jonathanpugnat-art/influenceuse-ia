import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { CREDIT_COSTS } from "@/lib/constants";
import { SCENE_FIRST_PLATE_CREDIT } from "@/lib/prompts/scene-first-photo";
import type { AppearanceVariation } from "@/lib/prompts/image-prompts";
import { normalizeAppearanceVariation } from "@/lib/prompts/appearance-variation-ui";
import { clampPremiumNsfwLevel } from "@/lib/premium-content";
import { parseIdentityPack } from "@/lib/identity-pack";
import { checkCredits } from "@/server/services/credits.service";
import { PLANS } from "@/lib/constants";
import type { Plan } from "@/generated/prisma/client";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  createPendingGenerationJob,
  scheduleGenerationTask,
} from "@/server/helpers/run-generation-job";
import {
  formatGenerationErrorForUser,
  formatPhotoSceneErrorForUser,
  LOCALHOST_REF_MESSAGE,
  SUGGESTIVE_REQUIRES_PREMIUM_MESSAGE,
} from "@/lib/generation-errors";
import {
  resolveEffectivePhotoContentMode,
  validatePhotoIntent,
} from "@/lib/photo-intent-validation";
import {
  isPremiumImagesDisabled,
  PREMIUM_DISABLED_MESSAGE,
} from "@/lib/kill-switches";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import { toPortraitStyleInput } from "@/lib/appearance-v2";
import {
  photoCreatorInputSchema,
  composePhotoOnSceneInputSchema,
  wizardPortraitInputSchema,
  contentIdInputSchema,
  type PhotoCreatorInput,
} from "@/server/trpc/schemas/content";
import { verifyContentOwnership } from "@/server/trpc/helpers/content/verify-content-ownership";
import {
  photoParamsBlob,
  parsePhotoPhase,
  parseScenePlateUrl,
  photoCreatorInputFromStoredParams,
} from "@/server/trpc/helpers/content/photo-params";

function loadImageService() {
  return import("@/server/services/ai-image.service");
}

function loadTrendsService() {
  return import("@/server/services/trends.service");
}

export const contentPhotoRouter = createTRPCRouter({
  generateBaseImage: protectedProcedure
    .input(wizardPortraitInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const { generateBaseImage: genBaseImage } = await loadImageService();
      const result = await genBaseImage(
        user.id,
        input.age,
        toPortraitStyleInput(input.gender, input.style),
        input.appearanceVariations
          ? normalizeAppearanceVariation(input.appearanceVariations)
          : undefined
      );
      return result;
    }),

  generateWizardAppearancePreview: protectedProcedure
    .input(wizardPortraitInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const { generateWizardAppearancePreview: genWizardAppearancePreview } =
        await loadImageService();
      return genWizardAppearancePreview(
        user.id,
        input.age,
        toPortraitStyleInput(input.gender, input.style),
        input.appearanceVariations
          ? normalizeAppearanceVariation(input.appearanceVariations)
          : undefined
      );
    }),

  generatePhoto: protectedProcedure
    .input(photoCreatorInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const planConfig = PLANS[user.plan as Plan];

      if (input.contentMode === "NSFW" && !planConfig.hasNsfw) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Le contenu Premium (OnlyFans) nécessite un plan Creator ou supérieur.",
        });
      }

      if (input.contentMode === "NSFW" && isPremiumImagesDisabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: PREMIUM_DISABLED_MESSAGE,
        });
      }

      const effectiveLane = resolveEffectivePhotoContentMode({
        contentMode: input.contentMode,
        sceneDescription: input.sceneDescription,
        outfit: input.outfit,
        scene: input.scene,
        hasNsfwPlan: planConfig.hasNsfw,
      });

      if (
        input.contentMode === "SFW" &&
        validatePhotoIntent({
          contentMode: "SFW",
          sceneDescription: input.sceneDescription,
          outfit: input.outfit,
          scene: input.scene,
        }).some((i) => i.code === "suggestive_in_social") &&
        !planConfig.hasNsfw
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: SUGGESTIVE_REQUIRES_PREMIUM_MESSAGE,
        });
      }

      const effectiveContentMode = effectiveLane.contentMode;

      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      const cost = input.numberOfImages * CREDIT_COSTS.PHOTO;
      const hasCredits = await checkCredits(user.id, cost);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost}, Restant : calculé.`,
        });
      }

      const wantsFaceReference =
        effectiveContentMode === "NSFW" ? input.useFaceReference : true;
      const rawRefUrl =
        influencer.baseImageUrl?.trim() || influencer.avatarUrl?.trim() || undefined;
      const referenceImageUrl =
        wantsFaceReference && rawRefUrl
          ? await resolvePublicMediaUrl(rawRefUrl)
          : undefined;
      const useFaceLock = wantsFaceReference && Boolean(referenceImageUrl);

      const premiumFaceRefUrl =
        effectiveContentMode === "NSFW" && rawRefUrl
          ? referenceImageUrl ??
            (await resolvePublicMediaUrl(rawRefUrl)) ??
            undefined
          : undefined;

      if (wantsFaceReference && rawRefUrl && !referenceImageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            /localhost|127\.0\.0\.1/i.test(rawRefUrl)
              ? LOCALHOST_REF_MESSAGE
              : "Portrait de référence inaccessible. Regénérez l'image de base de l'influenceuse (onglet Modifier) ou désactivez « Verrouiller le visage ».",
        });
      }

      // Default path (SFW + NSFW with face-lock on) requires a locked face.
      // Mirror the reel router's guard so we fail fast at the tRPC edge
      // rather than letting the pipeline throw MISSING_FACE_REF mid-run.
      if (wantsFaceReference && !rawRefUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Aucun portrait de base pour verrouiller le visage. Régénère le portrait de l'influenceuse depuis l'assistant ou l'onglet Modifier avant de générer une photo.",
        });
      }

      const { hydrateTrendPhotoInput } = await loadTrendsService();
      const trendHydration = await hydrateTrendPhotoInput({
        userId: user.id,
        influencerId: input.influencerId,
        trendItemId: input.trendItemId,
        recommendationId: input.recommendationId,
      });

      const resolvedInput: PhotoCreatorInput = {
        ...input,
        contentMode: effectiveContentMode,
        trendContext: input.trendContext ?? trendHydration.trendContext,
        scene: trendHydration.scene ?? input.scene,
        sceneDescription:
          input.sceneDescription?.trim() ||
          trendHydration.sceneDescription?.trim() ||
          input.sceneDescription,
        pose: trendHydration.pose ?? input.pose,
        outfit:
          input.outfit?.trim() ||
          trendHydration.outfit?.trim() ||
          input.outfit,
        expression: trendHydration.expression ?? input.expression,
        customPrompt: input.customPrompt || trendHydration.customPrompt,
        instagramShot: input.instagramShot ?? trendHydration.instagramShot,
        lookId: input.lookId ?? trendHydration.lookId,
      };

      const initialGenerationParams = photoParamsBlob(resolvedInput, {
        photoPhase: "final",
        hasReferenceImage: Boolean(referenceImageUrl),
        laneEscalated: effectiveLane.laneEscalated,
      });

      const content = await db.content.create({
        data: {
          influencerId: influencer.id,
          type: "PHOTO",
          contentMode: effectiveContentMode,
          status: "GENERATING",
          platforms: [],
          mediaUrls: [],
          hashtags: [],
          promptUsed: "",
          generationParams: initialGenerationParams,
        },
      });

      await createPendingGenerationJob({
        userId: user.id,
        influencerId: influencer.id,
        contentId: content.id,
        type: "IMAGE",
        prompt: "",
        creditsUsed: cost,
      });

      const style = influencer.style as Record<string, string> | null;
      const appearanceVariations =
        (influencer.appearanceVariations as AppearanceVariation | null) ?? undefined;

      const isPremiumPhoto = effectiveContentMode === "NSFW";
      const nsfwLevel = isPremiumPhoto
        ? clampPremiumNsfwLevel(input.nsfwLevel)
        : input.nsfwLevel;
      const identityPack = parseIdentityPack(influencer.identityPack);

      scheduleGenerationTask(ctx.scheduleAfter, {
        contentId: content.id,
        logLabel: "content.generatePhoto",
        execute: async () => {
          const { generateContentImage } = await loadImageService();
          const result = await generateContentImage(
            user.id,
            influencer.age,
            {
              gender: (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
              ethnicity: style?.ethnicity,
              hairColor: style?.hairColor,
              hairStyle: style?.hairStyle,
              bodyType: style?.bodyType,
              fashionStyle: style?.fashionStyle,
            },
            {
              influencerId: influencer.id,
              baseImageUrl: referenceImageUrl,
              premiumFaceRefUrl,
              useReferenceFace: useFaceLock,
              scene: resolvedInput.scene,
              sceneDescription: resolvedInput.sceneDescription,
              pose: resolvedInput.pose,
              outfit: resolvedInput.outfit,
              expression: resolvedInput.expression,
              style: resolvedInput.photoStyle,
              lighting: resolvedInput.timeOfDay,
              location: resolvedInput.location,
              isNsfw: isPremiumPhoto,
              nsfwLevel,
              customPrompt: resolvedInput.customPrompt,
              numberOfImages: resolvedInput.numberOfImages,
              appearanceVariations,
              identityPack,
              // Pro/Agency face-lock upgrade: face-lock pipeline switches to
              // FLUX LoRA hybrid when a trained LoRA is READY on this
              // influencer. Falls back to PuLID otherwise.
              loraUrl:
                influencer.loraStatus === "READY" && influencer.loraUrl?.trim()
                  ? influencer.loraUrl.trim()
                  : undefined,
              loraTriggerWord:
                influencer.loraStatus === "READY" && influencer.loraTriggerWord?.trim()
                  ? influencer.loraTriggerWord.trim()
                  : undefined,
              instagramShot: resolvedInput.instagramShot === true,
              trendContext: resolvedInput.trendContext,
            }
          );

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
                identityPackStatus: identityPack?.status ?? null,
                promptWasSoftened: result.promptWasSoftened === true,
                modelParams: result.parameters as object,
              } as object,
            },
          });

          return { resultUrl: result.imageUrls[0] };
        },
      });

      return { contentId: content.id, cost };
    }),

  generatePhotoScenePlate: protectedProcedure
    .input(photoCreatorInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.contentMode !== "SFW" || !input.useFaceReference) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Le mode scène en 2 étapes est disponible en photos sociales avec visage verrouillé.",
        });
      }

      const user = await getDbUser(ctx.userId);
      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      const cost = SCENE_FIRST_PLATE_CREDIT;
      if (!(await checkCredits(user.id, cost))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût décor : ${cost} crédit.`,
        });
      }

      const initialGenerationParams = photoParamsBlob(input, {
        photoPhase: "scene_generating",
        workflow: "scene_first",
      });

      const content = await db.content.create({
        data: {
          influencerId: influencer.id,
          type: "PHOTO",
          contentMode: "SFW",
          status: "GENERATING",
          platforms: [],
          mediaUrls: [],
          hashtags: [],
          promptUsed: "",
          generationParams: initialGenerationParams,
        },
      });

      await createPendingGenerationJob({
        userId: user.id,
        influencerId: influencer.id,
        contentId: content.id,
        type: "IMAGE",
        prompt: "scene_plate",
        creditsUsed: cost,
      });

      scheduleGenerationTask(ctx.scheduleAfter, {
        contentId: content.id,
        logLabel: "content.generatePhotoScenePlate",
        execute: async () => {
          const { generateScenePlateImage } = await loadImageService();
          const { scenePlateUrl, platePrompt } = await generateScenePlateImage(
            user.id,
            {
              influencerId: influencer.id,
              scene: input.scene,
              sceneDescription: input.sceneDescription,
              lighting: input.timeOfDay,
              location: input.location,
              trendContext: input.trendContext,
            }
          );

          await db.content.update({
            where: { id: content.id },
            data: {
              status: "DRAFT",
              thumbnailUrl: scenePlateUrl,
              promptUsed: platePrompt,
              generationParams: {
                ...initialGenerationParams,
                photoPhase: "scene_ready",
                scenePlateUrl,
                scenePlatePrompt: platePrompt,
              } as object,
            },
          });

          return { resultUrl: scenePlateUrl };
        },
      });

      return { contentId: content.id, cost };
    }),

  composePhotoOnScene: protectedProcedure
    .input(composePhotoOnSceneInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, content } = await verifyContentOwnership(
        input.contentId,
        ctx.userId
      );

      const params = content.generationParams as Record<string, unknown> | null;
      const phase = parsePhotoPhase(params);
      const scenePlateUrl =
        parseScenePlateUrl(params) ?? content.thumbnailUrl ?? undefined;

      if (phase !== "scene_ready" || !scenePlateUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Génère et valide d'abord le décor (étape 1), puis lance « Placer l'influenceuse ».",
        });
      }

      const influencer = content.influencerId
        ? await db.influencer.findUnique({ where: { id: content.influencerId } })
        : null;
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      const stored = params ?? {};
      const numberOfImages =
        input.numberOfImages ??
        (typeof stored.numberOfImages === "number" ? stored.numberOfImages : 1);

      const cost = numberOfImages * CREDIT_COSTS.PHOTO;
      if (!(await checkCredits(user.id, cost))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost} crédits.`,
        });
      }

      const rawRefUrl =
        influencer.baseImageUrl?.trim() || influencer.avatarUrl?.trim() || undefined;
      const referenceImageUrl = rawRefUrl
        ? await resolvePublicMediaUrl(rawRefUrl)
        : undefined;
      if (!referenceImageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: /localhost|127\.0\.0\.1/i.test(rawRefUrl ?? "")
            ? LOCALHOST_REF_MESSAGE
            : "Portrait de référence inaccessible.",
        });
      }

      await db.content.update({
        where: { id: content.id },
        data: { status: "GENERATING" },
      });

      await createPendingGenerationJob({
        userId: user.id,
        influencerId: influencer.id,
        contentId: content.id,
        type: "IMAGE",
        prompt: "compose_on_scene",
        creditsUsed: cost,
      });

      const style = influencer.style as Record<string, string> | null;
      const appearanceVariations =
        (influencer.appearanceVariations as AppearanceVariation | null) ?? undefined;
      const identityPack = parseIdentityPack(influencer.identityPack);

      const photoInput = photoCreatorInputFromStoredParams(
        influencer.id,
        stored,
        numberOfImages
      );

      scheduleGenerationTask(ctx.scheduleAfter, {
        contentId: content.id,
        logLabel: "content.composePhotoOnScene",
        execute: async () => {
          const { composeImageOnScenePlate } = await loadImageService();
          const result = await composeImageOnScenePlate(
            user.id,
            influencer.age,
            {
              gender:
                (influencer.gender as "female" | "male" | "nonbinary") ?? "female",
              ethnicity: style?.ethnicity,
              hairColor: style?.hairColor,
              hairStyle: style?.hairStyle,
              bodyType: style?.bodyType,
              fashionStyle: style?.fashionStyle,
            },
            {
              influencerId: influencer.id,
              baseImageUrl: referenceImageUrl,
              useReferenceFace: true,
              scene: photoInput.scene,
              sceneDescription: photoInput.sceneDescription,
              pose: photoInput.pose,
              outfit: photoInput.outfit,
              expression: photoInput.expression,
              style: photoInput.photoStyle,
              lighting: photoInput.timeOfDay,
              location: photoInput.location,
              customPrompt: photoInput.customPrompt,
              numberOfImages,
              appearanceVariations,
              identityPack,
              loraUrl:
                influencer.loraStatus === "READY" && influencer.loraUrl?.trim()
                  ? influencer.loraUrl.trim()
                  : undefined,
              loraTriggerWord:
                influencer.loraStatus === "READY" && influencer.loraTriggerWord?.trim()
                  ? influencer.loraTriggerWord.trim()
                  : undefined,
              scenePlateUrl,
              isNsfw: false,
            }
          );

          await db.content.update({
            where: { id: content.id },
            data: {
              status: "READY",
              mediaUrls: result.imageUrls,
              thumbnailUrl: result.imageUrls[0] ?? scenePlateUrl,
              promptUsed: result.promptUsed,
              negativePrompt: result.negativePrompt,
              generationParams: {
                ...photoParamsBlob(photoInput, {
                  photoPhase: "final",
                  scenePlateUrl,
                  workflow: "scene_first",
                  identityPackStatus: identityPack?.status ?? null,
                  modelParams: result.parameters as object,
                }),
              } as object,
            },
          });

          return { resultUrl: result.imageUrls[0] };
        },
        onFailure: async () => {
          await db.content.update({
            where: { id: content.id },
            data: {
              status: "DRAFT",
              generationParams: {
                ...(params ?? {}),
                photoPhase: "scene_ready",
                scenePlateUrl,
              } as object,
            },
          });
        },
      });

      return { contentId: content.id, cost };
    }),

  getGenerationStatus: protectedProcedure
    .input(contentIdInputSchema)
    .query(async ({ ctx, input }) => {
      await verifyContentOwnership(input.contentId, ctx.userId);

      const [content, job] = await Promise.all([
        db.content.findUnique({
          where: { id: input.contentId },
          select: {
            status: true,
            contentMode: true,
            mediaUrls: true,
            thumbnailUrl: true,
            generationParams: true,
          },
        }),
        db.generationJob.findFirst({
          where: { contentId: input.contentId },
          orderBy: { createdAt: "desc" },
          select: { error: true },
        }),
      ]);

      if (!content) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      }

      const photoPhase = parsePhotoPhase(content.generationParams);
      const scenePlateUrl =
        parseScenePlateUrl(content.generationParams) ??
        (photoPhase === "scene_ready" ? content.thumbnailUrl ?? undefined : undefined);

      const params = content.generationParams as Record<string, unknown> | null;
      const resolvedContentMode: "SFW" | "NSFW" =
        content.contentMode === "NSFW" ? "NSFW" : "SFW";

      return {
        status: content.status,
        mediaUrls: content.mediaUrls,
        thumbnailUrl: content.thumbnailUrl,
        photoPhase,
        scenePlateUrl,
        promptWasSoftened: params?.promptWasSoftened === true,
        errorMessage: job?.error
          ? photoPhase === "scene_generating"
            ? formatPhotoSceneErrorForUser(job.error)
            : formatGenerationErrorForUser(job.error, {
                contentMode: resolvedContentMode,
              })
          : null,
      };
    }),
});
