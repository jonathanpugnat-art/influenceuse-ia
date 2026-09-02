import { nanoid } from "nanoid";
import {
  buildFullPrompt,
  buildNegativePrompt,
  DEFAULT_IMAGE_PARAMS,
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
import { isNovitaConfigured, shouldPostModeratePremiumGeneration } from "@/lib/premium-image-config";
import { runNovitaInstantIdBatch } from "@/server/services/image-providers/novita-instantid.provider";
import {
  isContentSafetyFilterError,
  isFaceLockError,
  throwFaceLockError,
  throwMissingFaceReferenceError,
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
import { MODEL_SFW_T2I } from "./model-constants";
import { runMultiplePredictions } from "./replicate-runner";
import { applyPhotoPromptEnrichment } from "./photo-enrichment";
import {
  generatePremiumImagesWithModeration,
  generatePremiumPulidImages,
  selectPremiumFaceRef,
  toPremiumFluxInput,
} from "./premium-pipeline";
import {
  generateFaceLockedImages,
  hasReadyLora,
} from "./face-lock-pipeline";
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
  const usedEngine: ContentImageEngine = primaryEngine;
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
        // Face-lock intent + PuLID refusal → surface an actionable error
        // rather than silently generating another person via uncensored T2I.
        // Moderation / safety failures still throw (user needs to soften the
        // prompt anyway); everything else becomes a [face-lock] error the UI
        // can turn into a retry.
        if (err instanceof PremiumImageModerationError) throw err;
        if (isContentSafetyFilterError(err)) throw err;
        const detail = err instanceof Error ? err.message : String(err);
        console.warn(
          `[ai-image] PuLID failed on NSFW lane (${detail.slice(0, 160)}) — surfacing face-lock error instead of dropping to uncensored T2I.`
        );
        throwFaceLockError(`PuLID (NSFW ${tier}): ${detail.slice(0, 200)}`);
      }
    }

    if (premiumFaceRef && tier === "explicit") {
      if (!isNovitaConfigured()) {
        console.warn(
          "[ai-image] NSFW explicit tier requested face-lock but NOVITA_API_KEY is missing — refusing to drop to uncensored T2I."
        );
        throwFaceLockError(
          "NOVITA_API_KEY manquant pour le tier explicit (InstantID). Configure NOVITA_API_KEY ou descends au tier soft."
        );
      }
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
        if (shouldPostModeratePremiumGeneration(enrichedInput.nsfwLevel)) {
          await assertPremiumImagesModerated(novita.urls);
        }

        const storedUrls = await Promise.all(
          novita.urls.map(async (url, i) => {
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
          },
        };
      } catch (err) {
        if (err instanceof PremiumImageModerationError) throw err;
        if (isFaceLockError(err)) throw err;
        const detail = err instanceof Error ? err.message : String(err);
        console.warn(
          `[ai-image] Novita InstantID failed (${detail.slice(0, 160)}) — surfacing face-lock error instead of dropping to uncensored T2I.`
        );
        throwFaceLockError(`InstantID (explicit): ${detail.slice(0, 200)}`);
      }
    }

    // No face reference on the NSFW lane → the user has explicitly opted
    // out of face-lock (router only forwards `premiumFaceRefUrl` when the
    // NSFW `useFaceReference` toggle is on). Uncensored T2I is expected here.
    try {
      console.log("[ai-image] Premium photo — FLUX uncensored router (no face-lock requested)");
      const premium = await generatePremiumImagesWithModeration(
        prompt,
        negativePrompt,
        numImages,
        { nsfwLevel: enrichedInput.nsfwLevel }
      );

      const storedUrls = await Promise.all(
        premium.urls.map(async (url, i) => {
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
        },
      };
    } catch (error) {
      console.error("[ai-image] generateContentImage premium error:", error);
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // SFW DEFAULT PATH — real biometric face-lock (PuLID / Pro LoRA)
  //
  // Applies as soon as we have a wizard portrait to lock onto:
  //   * Pro/Agency + trained LoRA READY → FLUX LoRA hybrid (max fidelity)
  //   * Everyone else                   → PuLID on the wizard portrait
  // The identity pack (profile / 3-4 / full body) stays available as
  // *supplementary* scene refs — it is NOT the lock. LoRA is preserved as
  // an optional Pro upgrade so we do not block the whole product on 20–60
  // minute trainings.
  //
  // No silent T2I fallback: on any face-lock failure we throw a
  // [face-lock] error so the UI surfaces a retry rather than generating
  // another person via Flux 1.1 Pro. That closes the "wizard portrait vs
  // feed post look like two different people" regression flagged in the
  // product audit.
  // ──────────────────────────────────────────────────────────────────
  const faceUrl = sendsRefImage ? enrichedInput.baseImageUrl?.trim() : undefined;
  if (faceUrl && /^https?:\/\//i.test(faceUrl)) {
    const lora = hasReadyLora({
      loraUrl: enrichedInput.loraUrl,
      loraTriggerWord: enrichedInput.loraTriggerWord,
    })
      ? {
          loraUrl: enrichedInput.loraUrl!.trim(),
          triggerWord: enrichedInput.loraTriggerWord!.trim(),
        }
      : undefined;

    const supplementaryRefs = selectIdentityPackRefs(
      faceUrl,
      enrichedInput.identityPack,
      { pose: enrichedInput.pose, sceneDescription: enrichedInput.sceneDescription }
    ).filter((u) => u !== faceUrl);

    let promptWasSoftened = false;
    let facePromptUsed = prompt;
    let faceLockResult;
    try {
      console.log(
        `[ai-image] SFW default face-lock (${lora ? "lora" : "pulid"}) on wizard portrait — ${supplementaryRefs.length} supplementary pack ref(s) ignored by lock but tracked`
      );
      faceLockResult = await generateFaceLockedImages({
        faceUrl,
        prompt: facePromptUsed,
        negativePrompt,
        numImages,
        lora,
      });
    } catch (err) {
      // Safety-filter refusal → one retry with editorial-softened prompt.
      // Every other failure is a hard error: no silent T2I fallback.
      if (!isContentSafetyFilterError(err)) {
        if (isFaceLockError(err)) throw err;
        const detail = err instanceof Error ? err.message : String(err);
        console.warn(
          `[ai-image] SFW face-lock failed (${detail.slice(0, 200)}) — surfacing face-lock error instead of dropping to T2I.`
        );
        throwFaceLockError(detail.slice(0, 200));
      }

      const softPrompt = softenPromptForEditorial(facePromptUsed);
      console.warn(
        "[ai-image] SFW face-lock blocked by safety filter — retrying once with editorial-softened prompt."
      );
      try {
        faceLockResult = await generateFaceLockedImages({
          faceUrl,
          prompt: softPrompt,
          negativePrompt,
          numImages,
          lora,
        });
        facePromptUsed = softPrompt;
        promptWasSoftened = true;
      } catch (retryErr) {
        if (isFaceLockError(retryErr)) throw retryErr;
        const detail = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.warn(
          `[ai-image] SFW face-lock retry failed (${detail.slice(0, 200)}) — surfacing face-lock error.`
        );
        throwFaceLockError(detail.slice(0, 200));
      }
    }

    const storedUrls = await Promise.all(
      faceLockResult.urls.map(async (url, i) => {
        const ext = faceLockResult!.engine === "pulid" ? "webp" : "jpg";
        const filename = `content-${input.influencerId}-${nanoid(6)}-${i}.${ext}`;
        return uploadFromUrl(url, filename);
      })
    );

    if (!input.omitCreditBilling) {
      await deductCredits(userId, deliveredCost(storedUrls.length));
    }

    return {
      imageUrls: storedUrls,
      promptUsed: facePromptUsed,
      negativePrompt,
      promptWasSoftened,
      parameters: {
        contentEngine: faceLockResult.engine,
        provider: faceLockResult.provider,
        model: faceLockResult.model,
        borderlineKeywords: matchedKeywords,
        supplementaryPackRefs: supplementaryRefs.length,
        routedForBorderline: routeKontext,
      },
    };
  }

  // No accessible face URL on the SFW lane → the wizard portrait is
  // missing (or non-http). Refuse rather than silently generating a
  // stranger via Flux 1.1 Pro T2I. `input.useReferenceFace !== false` is
  // the direct user/router intent — `resolvedData.useReferenceFace` was
  // just downgraded to false because no ref URL was reachable.
  const userWantedFaceLock = input.useReferenceFace !== false && !enrichedInput.isNsfw;
  if (userWantedFaceLock) {
    console.warn(
      "[ai-image] SFW face-lock requested but no accessible baseImageUrl — refusing to fall back to T2I."
    );
    throwMissingFaceReferenceError();
  }

  // Explicit "no face lock" opt-out (only reachable on paths that turn
  // off `useReferenceFace` on purpose — e.g. wizard preview scripts). We
  // never hit this branch through the production UI on SFW because the
  // router forces the toggle on and validates baseImageUrl above.
  const plan = {
    model: MODEL_SFW_T2I,
    params: {
      ...DEFAULT_IMAGE_PARAMS,
      prompt,
      negative_prompt: negativePrompt,
      num_outputs: numImages,
      safety_tolerance: 5,
    },
  };

  try {
    console.log("[ai-image] SFW T2I (no face reference requested)", plan.model);

    let outputUrls: string[];
    try {
      outputUrls = await runMultiplePredictions(
        plan.model,
        plan.params,
        numImages
      );
    } catch (err) {
      if (isContentSafetyFilterError(err)) throwSocialSafetyError();
      throw err;
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
      promptWasSoftened: false,
      parameters: {
        ...plan.params,
        contentEngine: usedEngine,
        borderlineKeywords: matchedKeywords,
      },
    };
  } catch (error) {
    console.error("[ai-image] generateContentImage error:", error);
    throw error;
  }
}
