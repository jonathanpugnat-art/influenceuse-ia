import { nanoid } from "nanoid";
import {
  buildFullPrompt,
  buildNegativePrompt,
  DEFAULT_IMAGE_PARAMS,
  KONTEXT_IMAGE_PARAMS,
} from "@/lib/prompts/image-prompts";
import {
  shouldRouteToKontext,
  getMatchedBorderlineKeywords,
  type ContentImageEngine,
} from "@/lib/prompts/nano-borderline";
import {
  softenPromptForEditorial,
  softenSfwFieldsForKontext,
  softenSfwFitnessFields,
} from "@/lib/prompts/safety-soften";
import { selectIdentityPackRefs } from "@/lib/identity-pack";
import { resolvePromptData } from "@/server/services/prompt-data-resolver";
import { assertPremiumPromptAllowed } from "@/lib/prompts/premium-prompt-guard";
import { clampPremiumNsfwLevel } from "@/lib/premium-content";
import {
  buildPremiumNegativePromptForTier,
  enrichPremiumPhotoPrompt,
} from "@/lib/prompts/premium-negative";
import { buildPremiumFaceLockPrompt } from "@/lib/prompts/premium-face-lock-prompt";
import {
  isNovitaConfigured,
  isPremiumUpscaleEnabled,
  shouldPostModeratePremiumGeneration,
} from "@/lib/premium-image-config";
import { runNovitaInstantIdBatch } from "@/server/services/image-providers/novita-instantid.provider";
import { upscalePremiumImages } from "@/server/services/image-providers/upscale.provider";
import {
  isContentSafetyFilterError,
  throwSocialSafetyError,
} from "@/lib/generation-errors";
import {
  isPremiumImagesDisabled,
  PREMIUM_DISABLED_MESSAGE,
} from "@/lib/kill-switches";
import { uploadFromUrl } from "@/server/services/storage.service";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  PremiumImageModerationError,
  assertPremiumImagesModerated,
} from "@/server/services/image-moderation.service";
import {
  MODEL_SFW_KONTEXT,
  MODEL_SFW_NANO,
  MODEL_SFW_SEEDREAM,
  MODEL_SFW_T2I,
  NANO_BANANA_DEFAULTS,
  SEEDREAM_DEFAULTS,
  resolveSfwReferenceModel,
} from "./model-constants";
import { runMultiplePredictions } from "./replicate-runner";
import { applyPhotoPromptEnrichment } from "./photo-enrichment";
import {
  generatePremiumImagesWithModeration,
  generatePremiumPulidImages,
  selectPremiumFaceRef,
  toPremiumFluxInput,
} from "./premium-pipeline";
import type {
  ImageGenerationInput,
  ImageGenerationOutput,
  InfluencerStyle,
} from "./types";

export async function generateContentImage(
  userId: string,
  influencerAge: number,
  influencerStyle: InfluencerStyle,
  input: ImageGenerationInput
): Promise<ImageGenerationOutput> {
  const enrichedRaw = await applyPhotoPromptEnrichment(input);

  // Route BEFORE softening — fitness tokens (sports bra, leggings, gym mirror)
  // are borderline keywords; rewriting them first wrongly keeps the job on Nano.
  const routingFields = {
    scene: enrichedRaw.scene,
    sceneDescription: enrichedRaw.sceneDescription,
    outfit: enrichedRaw.outfit,
    location: enrichedRaw.location,
    customPrompt: enrichedRaw.customPrompt,
    pose: enrichedRaw.pose,
    expression: enrichedRaw.expression,
  };
  const routeKontext =
    !enrichedRaw.isNsfw &&
    (enrichedRaw.isReelSceneFrame ||
      shouldRouteToKontext(routingFields) ||
      enrichedRaw.instagramShot === true);

  // Nano: full fitness soften (avoid E005). Kontext: keep athletic wardrobe.
  const enrichedInput = enrichedRaw.isNsfw
    ? enrichedRaw
    : routeKontext
      ? softenSfwFieldsForKontext(enrichedRaw)
      : softenSfwFitnessFields(enrichedRaw);
  const resolvedData = await resolvePromptData(
    enrichedInput.influencerId,
    enrichedInput
  );
  const numImages = Math.min(enrichedInput.numberOfImages, 4);
  const cost = CREDIT_COSTS.PHOTO * numImages;
  // Multi-image runs tolerate partial success (2/4 delivered is a valid
  // result) — always bill on what was actually delivered, never on what
  // was requested.
  const deliveredCost = (deliveredCount: number) =>
    CREDIT_COSTS.PHOTO * Math.min(deliveredCount, numImages);
  if (!input.omitCreditBilling) {
    const hasCredits = await checkCredits(userId, cost);
    if (!hasCredits) {
      throw new Error(
        `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
      );
    }
  }

  const sendsRefImage = resolvedData.useReferenceFace === true;

  const matchedKeywords = routeKontext
    ? getMatchedBorderlineKeywords(routingFields)
    : [];

  const buildPromptForEngine = (engine: ContentImageEngine) =>
    buildFullPrompt({
      ...resolvedData,
      contentEngine: engine,
    });

  const primaryEngine: ContentImageEngine =
    enrichedInput.isReelSceneFrame && !enrichedInput.isNsfw
      ? "kontext"
      : routeKontext
        ? "kontext"
        : "nano";
  let usedEngine: ContentImageEngine = primaryEngine;
  let prompt = buildPromptForEngine(primaryEngine);
  const gender = resolvedData.gender ?? "female";
  const nsfwTier = input.isNsfw
    ? clampPremiumNsfwLevel(enrichedInput.nsfwLevel)
    : undefined;
  const negativePrompt =
    input.isNsfw && nsfwTier
      ? buildPremiumNegativePromptForTier(nsfwTier, gender, { lockFace: false })
      : buildNegativePrompt(false, gender, {
          lockFace: resolvedData.useReferenceFace === true,
        });
  if (input.isNsfw && nsfwTier) {
    prompt = enrichPremiumPhotoPrompt(prompt, nsfwTier);
  }

  if (input.isNsfw) {
    // Service-level kill switch — also covers NSFW drafts flowing through
    // the batch cron, which bypasses the tRPC router check.
    if (isPremiumImagesDisabled()) {
      throw new Error(PREMIUM_DISABLED_MESSAGE);
    }
    const tier = nsfwTier ?? clampPremiumNsfwLevel(enrichedInput.nsfwLevel);
    assertPremiumPromptAllowed(
      {
        scene: enrichedInput.scene,
        sceneDescription: enrichedInput.sceneDescription,
        outfit: enrichedInput.outfit,
        customPrompt: resolvedData.customPrompt,
        location: enrichedInput.location,
      },
      tier
    );

    const premiumFaceRef = selectPremiumFaceRef(enrichedInput);
    if (premiumFaceRef && tier !== "explicit") {
      try {
        console.log(
          `[ai-image] Premium photo — PuLID face-lock (tier: ${tier})`
        );
        const pulidPrompt = buildPremiumFaceLockPrompt(
          { ...resolvedData, ...enrichedInput, isNsfw: true, nsfwLevel: tier },
          tier
        );
        const pulid = await generatePremiumPulidImages(
          premiumFaceRef,
          pulidPrompt,
          negativePrompt,
          numImages
        );
        console.log(
          `[ai-image] PuLID OK — ${pulid.urls.length} image(s) via ${pulid.model.split(":")[0]}`
        );
        if (shouldPostModeratePremiumGeneration(enrichedInput.nsfwLevel)) {
          await assertPremiumImagesModerated(pulid.urls);
        }

        const storedUrls = await Promise.all(
          pulid.urls.map(async (url, i) => {
            const filename = `content-${input.influencerId}-${nanoid(6)}-${i}.webp`;
            return uploadFromUrl(url, filename);
          })
        );

        if (!input.omitCreditBilling) {
          await deductCredits(userId, deliveredCost(storedUrls.length));
        }

        return {
          imageUrls: storedUrls,
          promptUsed: pulidPrompt,
          negativePrompt,
          parameters: {
            contentEngine: "pulid",
            premiumProvider: "replicate",
            premiumModel: pulid.model,
            nsfwLevel: enrichedInput.nsfwLevel,
            imageInputCount: 1,
          },
        };
      } catch (err) {
        const reason =
          err instanceof PremiumImageModerationError
            ? "failed moderation"
            : isContentSafetyFilterError(err)
              ? "blocked by safety filter"
              : err instanceof Error
                ? err.message
                : String(err);
        console.warn(
          `[ai-image] PuLID ${reason}, falling back to uncensored T2I router…`
        );
      }
    }

    if (premiumFaceRef && tier === "explicit" && isNovitaConfigured()) {
      try {
        console.log("[ai-image] Premium photo — Novita InstantID face-lock (explicit)");
        const novitaPrompt = buildPremiumFaceLockPrompt(
          { ...resolvedData, ...enrichedInput, isNsfw: true, nsfwLevel: tier },
          tier
        );
        const novita = await runNovitaInstantIdBatch(
          premiumFaceRef,
          novitaPrompt,
          negativePrompt,
          numImages
        );
        // Optional finishing pass (pure ESRGAN, no-op unless PREMIUM_UPSCALE).
        // Runs before moderation so the delivered image is the moderated one.
        const finalizedUrls = await upscalePremiumImages(novita.urls);
        if (shouldPostModeratePremiumGeneration(enrichedInput.nsfwLevel)) {
          await assertPremiumImagesModerated(finalizedUrls);
        }

        const storedUrls = await Promise.all(
          finalizedUrls.map(async (url, i) => {
            const filename = `content-${input.influencerId}-${nanoid(6)}-${i}.jpg`;
            return uploadFromUrl(url, filename);
          })
        );

        if (!input.omitCreditBilling) {
          await deductCredits(userId, deliveredCost(storedUrls.length));
        }

        return {
          imageUrls: storedUrls,
          promptUsed: novitaPrompt,
          negativePrompt,
          parameters: {
            contentEngine: "novita-instantid",
            premiumProvider: "novita",
            premiumModel: novita.model,
            nsfwLevel: enrichedInput.nsfwLevel,
            imageInputCount: 1,
            upscaled: isPremiumUpscaleEnabled(),
          },
        };
      } catch (err) {
        const reason =
          err instanceof PremiumImageModerationError
            ? "failed moderation"
            : err instanceof Error
              ? err.message
              : String(err);
        console.warn(
          `[ai-image] Novita InstantID ${reason}, falling back to uncensored T2I router…`
        );
      }
    }

    try {
      console.log("[ai-image] Premium photo — FLUX uncensored router");
      const premium = await generatePremiumImagesWithModeration(
        prompt,
        negativePrompt,
        numImages,
        { nsfwLevel: enrichedInput.nsfwLevel }
      );

      const finalizedPremiumUrls = await upscalePremiumImages(premium.urls);
      const storedUrls = await Promise.all(
        finalizedPremiumUrls.map(async (url, i) => {
          const filename = `content-${input.influencerId}-${nanoid(6)}-${i}.jpg`;
          return uploadFromUrl(url, filename);
        })
      );

      if (!input.omitCreditBilling) {
        await deductCredits(userId, deliveredCost(storedUrls.length));
      }

      return {
        imageUrls: storedUrls,
        promptUsed: premium.promptUsed,
        negativePrompt,
        parameters: {
          ...toPremiumFluxInput(premium.promptUsed, negativePrompt),
          contentEngine: "premium",
          premiumProvider: premium.provider,
          premiumModel: premium.model,
          nsfwLevel: enrichedInput.nsfwLevel,
          upscaled: isPremiumUpscaleEnabled(),
        },
      };
    } catch (error) {
      console.error("[ai-image] generateContentImage premium error:", error);
      throw error;
    }
  }

  type ModelPlan = {
    model: string;
    params: Record<string, unknown>;
    fallback?: { model: string; params: Record<string, unknown> };
  };

  const refs =
    sendsRefImage && enrichedInput.baseImageUrl?.trim()
      ? selectIdentityPackRefs(enrichedInput.baseImageUrl.trim(), enrichedInput.identityPack, {
          pose: enrichedInput.pose,
          sceneDescription: enrichedInput.sceneDescription,
        })
      : [];

  const inspirationRefs = sendsRefImage
    ? (enrichedInput.trendContext?.inspirationImageUrls ?? [])
        .filter((url) => url.startsWith("http") && !refs.includes(url))
        .slice(0, 2)
    : [];
  const imageInput = [...refs, ...inspirationRefs].slice(0, 6);

  const kontextPlan: ModelPlan = {
    model: MODEL_SFW_KONTEXT,
    params: {
      ...KONTEXT_IMAGE_PARAMS,
      prompt,
      input_image: input.baseImageUrl,
    },
  };

  const sfwReferenceModel = resolveSfwReferenceModel();
  const sfwReferencePlan: ModelPlan =
    sfwReferenceModel === MODEL_SFW_SEEDREAM
      ? {
          model: MODEL_SFW_SEEDREAM,
          params: {
            ...SEEDREAM_DEFAULTS,
            prompt,
            image_input: imageInput,
          },
          fallback: sendsRefImage && input.baseImageUrl ? kontextPlan : undefined,
        }
      : {
          model: MODEL_SFW_NANO,
          params: {
            ...NANO_BANANA_DEFAULTS,
            prompt,
            image_input: imageInput,
          },
          fallback: sendsRefImage && input.baseImageUrl ? kontextPlan : undefined,
        };

  let plan: ModelPlan;
  if (sendsRefImage && input.baseImageUrl) {
    plan = routeKontext ? kontextPlan : sfwReferencePlan;
  } else {
    plan = {
      model: MODEL_SFW_T2I,
      params: {
        ...DEFAULT_IMAGE_PARAMS,
        prompt,
        negative_prompt: negativePrompt,
        num_outputs: numImages,
        safety_tolerance: 5,
      },
    };
  }

  try {
    console.log(
      "[ai-image] Generating content image with",
      plan.model,
      sendsRefImage ? "(face-locked)" : "(no reference)",
      routeKontext
        ? `(borderline → kontext, keywords: ${matchedKeywords.join(", ") || "n/a"})`
        : `(${plan.model}-first)`,
      refs.length > 1 ? `(${refs.length} identity refs)` : ""
    );

    let outputUrls: string[];
    let usedParams = plan.params;
    let promptWasSoftened = false;
    try {
      outputUrls = await runMultiplePredictions(
        plan.model,
        plan.params,
        numImages
      );
    } catch (err) {
      if (plan.fallback && isContentSafetyFilterError(err)) {
        console.warn(
          `[ai-image] ${plan.model} blocked by safety filter, falling back to ${plan.fallback.model}…`
        );
        const kontextPrompt = buildPromptForEngine("kontext");
        outputUrls = await runMultiplePredictions(
          plan.fallback.model,
          {
            ...plan.fallback.params,
            prompt: kontextPrompt,
          },
          numImages
        );
        usedParams = { ...plan.fallback.params, prompt: kontextPrompt };
        prompt = kontextPrompt;
        usedEngine = "kontext";
      } else if (
        isContentSafetyFilterError(err) &&
        plan.model === MODEL_SFW_KONTEXT
      ) {
        console.warn(
          "[ai-image] Kontext blocked by safety filter, retrying with editorial-softened prompt…"
        );
        const softPrompt = softenPromptForEditorial(
          buildPromptForEngine("kontext")
        );
        outputUrls = await runMultiplePredictions(
          MODEL_SFW_KONTEXT,
          { ...kontextPlan.params, prompt: softPrompt },
          numImages
        );
        usedParams = { ...kontextPlan.params, prompt: softPrompt };
        prompt = softPrompt;
        usedEngine = "kontext";
        promptWasSoftened = true;
      } else {
        if (isContentSafetyFilterError(err)) {
          throwSocialSafetyError();
        }
        throw err;
      }
    }

    const storedUrls = await Promise.all(
      outputUrls.map(async (url, i) => {
        const filename = `content-${input.influencerId}-${nanoid(6)}-${i}.jpg`;
        return uploadFromUrl(url, filename);
      })
    );

    if (!input.omitCreditBilling) {
      await deductCredits(userId, deliveredCost(storedUrls.length));
    }

    return {
      imageUrls: storedUrls,
      promptUsed: prompt,
      negativePrompt,
      promptWasSoftened,
      parameters: {
        ...usedParams,
        contentEngine: usedEngine,
        borderlineKeywords: matchedKeywords,
      },
    };
  } catch (error) {
    console.error("[ai-image] generateContentImage error:", error);
    throw error;
  }
}
