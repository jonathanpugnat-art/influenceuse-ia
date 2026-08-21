import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { CREDIT_COSTS } from "@/lib/constants";
import type { AppearanceVariation } from "@/lib/prompts/image-prompts";
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
import { LOCALHOST_REF_MESSAGE } from "@/lib/generation-errors";
import { isReelsDisabled, REELS_DISABLED_MESSAGE } from "@/lib/kill-switches";
import { resolvePublicMediaUrl } from "@/server/lib/resolve-public-media-url";
import { buildReelSceneFrameParams } from "@/lib/reel-scene-frame";
import {
  generateReelNarration,
  isSpeechConfigured,
  reelNarrationCreditCost,
} from "@/server/services/ai-speech.service";
import {
  generateReelInputSchema,
  generateReelNarrationInputSchema,
} from "@/server/trpc/schemas/content";

function loadImageService() {
  return import("@/server/services/ai-image.service");
}

function loadVideoService() {
  return import("@/server/services/ai-video.service");
}

function loadTrendsService() {
  return import("@/server/services/trends.service");
}

export const contentReelRouter = createTRPCRouter({
  generateReel: protectedProcedure
    .input(generateReelInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (isReelsDisabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: REELS_DISABLED_MESSAGE,
        });
      }
      const user = await getDbUser(ctx.userId);

      const { hydrateTrendReelInput } = await loadTrendsService();
      const trendHydration = await hydrateTrendReelInput({
        influencerId: input.influencerId,
        userId: user.id,
        trendItemId: input.trendItemId,
        recommendationId: input.recommendationId,
      });

      const resolvedInput = {
        ...input,
        duration: input.duration ?? trendHydration.duration ?? input.duration,
        format: input.format ?? trendHydration.format ?? input.format,
        videoType: input.videoType || trendHydration.videoType || input.videoType,
        script: input.script || trendHydration.script || input.script,
        sceneDescription:
          input.sceneDescription?.trim() ||
          trendHydration.sceneDescription ||
          input.sceneDescription,
        outfit: input.outfit?.trim() || trendHydration.outfit || input.outfit,
        music: input.music || trendHydration.music || input.music,
        effects:
          input.effects && input.effects.length > 0
            ? input.effects
            : trendHydration.effects ?? input.effects,
        textOverlay:
          input.textOverlay || trendHydration.textOverlay || input.textOverlay,
        motionSourceVideoUrl:
          input.motionSourceVideoUrl ||
          trendHydration.motionSourceVideoUrl ||
          input.motionSourceVideoUrl,
        fromTrend:
          input.fromTrend ??
          trendHydration.fromTrend ??
          Boolean(input.trendItemId || input.recommendationId),
      };

      const planConfig = PLANS[user.plan as Plan];
      if (!planConfig.hasVideo) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "La génération de vidéo nécessite le plan Pro ou Enterprise.",
        });
      }

      const influencer = await db.influencer.findUnique({
        where: { id: input.influencerId },
      });
      if (!influencer || influencer.userId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Influencer not found" });
      }

      if (!influencer.baseImageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "L'influenceuse doit avoir une image de base pour générer des reels. Génère d'abord une photo.",
        });
      }

      if (input.reelStylePreset === "lip_sync" && !input.audioUrl?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Le style « Reel parlant » nécessite une piste audio (URL HTTPS vers un MP3 ou WAV).",
        });
      }

      let resolvedAudioUrl: string | undefined;
      if (input.audioUrl?.trim()) {
        resolvedAudioUrl = await resolvePublicMediaUrl(input.audioUrl.trim());
        if (!resolvedAudioUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "URL audio inaccessible. Utilise un lien public HTTPS (bibliothèque média ou stockage).",
          });
        }
      }

      const cost = CREDIT_COSTS.REEL;
      const hasCredits = await checkCredits(user.id, cost);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Crédits insuffisants. Coût : ${cost} crédits.`,
        });
      }

      const baseImage = await resolvePublicMediaUrl(influencer.baseImageUrl.trim());
      if (!baseImage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            /localhost|127\.0\.0\.1/i.test(influencer.baseImageUrl)
              ? LOCALHOST_REF_MESSAGE
              : "Image de base inaccessible. Regénérez le portrait de l'influenceuse.",
        });
      }
      const avatarImage = influencer.avatarUrl?.trim();
      const resolvedAvatar =
        avatarImage && avatarImage !== influencer.baseImageUrl.trim()
          ? await resolvePublicMediaUrl(avatarImage)
          : undefined;
      const subjectReferenceUrl = resolvedAvatar;

      const initialReelParams = {
        duration: resolvedInput.duration,
        format: resolvedInput.format,
        videoType: resolvedInput.videoType,
        script: resolvedInput.script,
        sceneDescription: resolvedInput.sceneDescription,
        outfit: resolvedInput.outfit,
        music: resolvedInput.music,
        effects: resolvedInput.effects,
        textOverlay: resolvedInput.textOverlay,
        reelStylePreset: resolvedInput.reelStylePreset,
        audioUrl: resolvedAudioUrl ?? resolvedInput.audioUrl,
        generateSceneFrame: resolvedInput.generateSceneFrame,
        motionSourceVideoUrl: resolvedInput.motionSourceVideoUrl,
        fromTrend: resolvedInput.fromTrend,
        trendItemId: resolvedInput.trendItemId,
        recommendationId: resolvedInput.recommendationId,
      } as object;

      const content = await db.content.create({
        data: {
          influencerId: influencer.id,
          type: "REEL",
          contentMode: resolvedInput.contentMode,
          status: "GENERATING",
          platforms: [],
          mediaUrls: [],
          hashtags: [],
          promptUsed: resolvedInput.script,
          generationParams: initialReelParams,
        },
      });

      await createPendingGenerationJob({
        userId: user.id,
        influencerId: influencer.id,
        contentId: content.id,
        type: "VIDEO",
        prompt: resolvedInput.script,
        creditsUsed: cost,
      });

      const durationMap: Record<number, 5 | 10> = { 15: 5, 30: 10, 60: 10 };
      const effectsStr =
        resolvedInput.effects && resolvedInput.effects.length > 0
          ? resolvedInput.effects.join(",")
          : undefined;

      scheduleGenerationTask(ctx.scheduleAfter, {
        contentId: content.id,
        logLabel: "content.generateReel",
        execute: async () => {
          const [{ generateContentImage }, { generateVideo }] = await Promise.all([
            loadImageService(),
            loadVideoService(),
          ]);
          const style = influencer.style as Record<string, string> | null;
          const appearanceVariations =
            (influencer.appearanceVariations as AppearanceVariation | null) ??
            undefined;
          const isPremiumReel = resolvedInput.contentMode === "NSFW";
          const nsfwLevel = isPremiumReel
            ? clampPremiumNsfwLevel(resolvedInput.nsfwLevel)
            : resolvedInput.nsfwLevel;
          const useFaceLock = !isPremiumReel;
          const identityPack = parseIdentityPack(influencer.identityPack);

          let firstFrameUrl = baseImage;
          let sceneFrameUrl: string | null = null;
          let scenePromptUsed: string | undefined;
          let sceneDescriptionForVideo = resolvedInput.sceneDescription;

          if (resolvedInput.generateSceneFrame) {
            const sceneParams = buildReelSceneFrameParams({
              script: resolvedInput.script,
              sceneDescription: resolvedInput.sceneDescription,
              outfit: resolvedInput.outfit,
              videoType: resolvedInput.videoType,
            });

            console.log(
              "[content.generateReel] Generating scene frame:",
              sceneParams.scene,
              sceneParams.outfit.slice(0, 60)
            );

            const sceneImage = await generateContentImage(
              user.id,
              influencer.age,
              {
                gender:
                  (influencer.gender as "female" | "male" | "nonbinary") ??
                  "female",
                ethnicity: style?.ethnicity,
                hairColor: style?.hairColor,
                hairStyle: style?.hairStyle,
                bodyType: style?.bodyType,
                fashionStyle: style?.fashionStyle,
              },
              {
                influencerId: influencer.id,
                baseImageUrl: baseImage,
                useReferenceFace: useFaceLock,
                scene: sceneParams.scene,
                sceneDescription: sceneParams.sceneDescription,
                pose: sceneParams.pose,
                outfit: sceneParams.outfit,
                expression: sceneParams.expression,
                style: sceneParams.style,
                lighting: sceneParams.lighting,
                isNsfw: isPremiumReel,
                nsfwLevel,
                customPrompt: sceneParams.customPrompt,
                numberOfImages: 1,
                appearanceVariations,
                omitCreditBilling: true,
                isReelSceneFrame: true,
                identityPack,
                loraUrl:
                  influencer.loraStatus === "READY" && influencer.loraUrl?.trim()
                    ? influencer.loraUrl.trim()
                    : undefined,
                loraTriggerWord:
                  influencer.loraStatus === "READY" &&
                  influencer.loraTriggerWord?.trim()
                    ? influencer.loraTriggerWord.trim()
                    : undefined,
              }
            );

            sceneFrameUrl = sceneImage.imageUrls[0] ?? null;
            scenePromptUsed = sceneImage.promptUsed;
            sceneDescriptionForVideo =
              resolvedInput.sceneDescription?.trim() || sceneParams.sceneDescription;
            if (!sceneFrameUrl) {
              throw new Error(
                "Impossible de générer la photo de scène pour ce reel. Décris le lieu dans « Scène » (ex. salle de bain, miroir, lumière naturelle) et réessaie."
              );
            }
            firstFrameUrl = sceneFrameUrl;

            await db.content.update({
              where: { id: content.id },
              data: {
                thumbnailUrl: sceneFrameUrl,
                generationParams: {
                  ...initialReelParams,
                  sceneFrameUrl,
                  scenePromptUsed,
                } as object,
              },
            });
          }

          const usedSceneFrame = Boolean(sceneFrameUrl);

          const result = await generateVideo(user.id, {
            influencerId: influencer.id,
            baseImageUrl: firstFrameUrl,
            subjectReferenceUrl:
              useFaceLock && !usedSceneFrame ? subjectReferenceUrl : undefined,
            sceneFrameOnly: usedSceneFrame,
            duration: durationMap[resolvedInput.duration] ?? 5,
            script: resolvedInput.script,
            videoType: resolvedInput.videoType,
            effects: effectsStr,
            reelStylePreset: resolvedInput.reelStylePreset,
            audioUrl: resolvedAudioUrl,
            isNsfw: isPremiumReel,
            sceneDescription: sceneDescriptionForVideo,
            motionSourceVideoUrl: resolvedInput.motionSourceVideoUrl,
            fromTrend: resolvedInput.fromTrend,
          });
          await db.content.update({
            where: { id: content.id },
            data: {
              status: "READY",
              mediaUrls: [result.videoUrl],
              thumbnailUrl: result.thumbnailUrl ?? sceneFrameUrl ?? null,
              promptUsed: scenePromptUsed ?? resolvedInput.script,
              generationParams: {
                ...initialReelParams,
                sceneFrameUrl,
                scenePromptUsed,
                modelParams: result.parameters as object,
              } as object,
            },
          });

          return { resultUrl: result.videoUrl };
        },
      });

      return { contentId: content.id, cost };
    }),

  speechConfig: protectedProcedure.query(() => ({
    available: isSpeechConfigured(),
    creditCost: reelNarrationCreditCost(),
  })),

  generateReelNarration: protectedProcedure
    .input(generateReelNarrationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const planCfg = PLANS[user.plan as Plan];
      if (!planCfg.hasVideo) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "La narration vocale nécessite le plan Pro ou Agency.",
        });
      }
      const { buildReelNarrationText } = await import("@/lib/reel-narration");
      const text = buildReelNarrationText({
        script: input.script,
        sceneDescription: input.sceneDescription,
        outfit: input.outfit,
      });
      if (text.length < 10) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Ajoutez au moins 10 caractères dans le script ou la description de scène pour générer une voix.",
        });
      }
      const result = await generateReelNarration(user.id, {
        text,
        language: input.language,
        voice: input.voice,
      });
      return result;
    }),
});
