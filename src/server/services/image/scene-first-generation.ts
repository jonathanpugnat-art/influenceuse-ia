import { nanoid } from "nanoid";
import {
  buildNegativePrompt,
  DEFAULT_IMAGE_PARAMS,
} from "@/lib/prompts/image-prompts";
import {
  buildFaceLockedSceneComposePrompt,
  buildScenePlatePrompt,
  SCENE_FIRST_PLATE_CREDIT,
} from "@/lib/prompts/scene-first-photo";
import { softenPromptForEditorial } from "@/lib/prompts/safety-soften";
import { uploadFromUrl } from "@/server/services/storage.service";
import {
  isContentSafetyFilterError,
  isFaceLockError,
  throwFaceLockError,
  throwMissingFaceReferenceError,
} from "@/lib/generation-errors";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";
import { MODEL_SFW_T2I } from "./model-constants";
import { runMultiplePredictions } from "./replicate-runner";
import {
  applyPhotoPromptEnrichment,
  resolveEnrichedSceneAndOutfit,
} from "./photo-enrichment";
import {
  generateFaceLockedImages,
  hasReadyLora,
} from "./face-lock-pipeline";
import type {
  ImageGenerationInput,
  ImageGenerationOutput,
  InfluencerStyle,
} from "./types";

export function sceneFirstPhotoCreditCost(numberOfImages: number): number {
  const n = Math.min(Math.max(1, numberOfImages), 4);
  return SCENE_FIRST_PLATE_CREDIT + CREDIT_COSTS.PHOTO * n;
}

export async function generateScenePlateImage(
  userId: string,
  input: Pick<
    ImageGenerationInput,
    | "influencerId"
    | "scene"
    | "sceneDescription"
    | "lighting"
    | "location"
    | "trendContext"
  >,
  options?: { omitCreditBilling?: boolean }
): Promise<{ scenePlateUrl: string; platePrompt: string }> {
  if (!options?.omitCreditBilling) {
    const hasCredits = await checkCredits(userId, SCENE_FIRST_PLATE_CREDIT);
    if (!hasCredits) {
      throw new Error(
        `Crédits insuffisants. Coût décor : ${SCENE_FIRST_PLATE_CREDIT} crédit.`
      );
    }
  }

  const { sceneDescription: enrichedScene } = await resolveEnrichedSceneAndOutfit({
    sceneDescription: input.sceneDescription,
    trendContext: input.trendContext,
  });

  const platePrompt = buildScenePlatePrompt({
    sceneDescription: enrichedScene ?? "",
    scene: input.scene,
    lighting: input.lighting,
    location: input.location,
  });
  const plateNegative =
    "people, person, face, portrait, mannequin, crowd, selfie, influencer, human, body, hands, legs";

  console.log("[ai-image] Photo scene plate (flux T2I — FAL → Replicate fallback)…");
  const plateUrls = await runMultiplePredictions(
    MODEL_SFW_T2I,
    {
      ...DEFAULT_IMAGE_PARAMS,
      prompt: platePrompt,
      negative_prompt: plateNegative,
      num_outputs: 1,
      safety_tolerance: 5,
    },
    1
  );
  const plateRemote = plateUrls[0];
  if (!plateRemote) {
    throw new Error(
      "Impossible de générer le décor. Précise le lieu dans la description de scène."
    );
  }
  const scenePlateUrl = await uploadFromUrl(
    plateRemote,
    `scene-plate-${input.influencerId}-${nanoid(6)}.jpg`
  );

  if (!options?.omitCreditBilling) {
    await deductCredits(userId, SCENE_FIRST_PLATE_CREDIT);
  }

  return { scenePlateUrl, platePrompt };
}

/**
 * Scene-first compose — step 2 of the two-step photo workflow.
 *
 * Historically this ran on Nano with `[identity refs, plate]` as
 * `image_input`, which meant Nano regenerated the face from scratch on top
 * of a wizard portrait it interpreted as a soft hint. That produced "same
 * outfit, different person" regressions and directly contradicted the
 * merged face-lock default path (PR #2, `face-lock-pipeline.ts`).
 *
 * The compose step now runs the same biometric face-lock pipeline as the
 * default SFW path:
 *   * Pro/Agency + trained LoRA READY → FLUX LoRA hybrid with the wizard
 *     portrait as img2img reference.
 *   * Everyone else                   → PuLID on the wizard portrait.
 *
 * PuLID / LoRA cannot ingest the scene plate as a secondary reference, so
 * the plate becomes a preview/approval artefact: the scene description that
 * seeded plate generation is copied into the face-lock prompt so the render
 * still matches the approved decor. The `scenePlateUrl` is preserved in
 * output parameters for telemetry and downstream reuse.
 *
 * No silent T2I / Nano fallback on face-lock failure — the merged product
 * rule is "never generate another person", so we surface the existing
 * `[face-lock]` errors instead.
 */
export async function composeImageOnScenePlate(
  userId: string,
  influencerAge: number,
  influencerStyle: InfluencerStyle,
  input: ImageGenerationInput & { scenePlateUrl: string }
): Promise<ImageGenerationOutput> {
  const numImages = Math.min(input.numberOfImages, 4);
  const cost = CREDIT_COSTS.PHOTO * numImages;
  if (!input.omitCreditBilling) {
    const hasCredits = await checkCredits(userId, cost);
    if (!hasCredits) {
      throw new Error(`Crédits insuffisants. Coût : ${cost} crédits.`);
    }
  }

  const baseUrl = input.baseImageUrl?.trim();
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    // Match the default-path guard: face-lock intent + no accessible
    // portrait → MISSING_FACE_REF, never a silent stranger.
    throwMissingFaceReferenceError();
  }
  const plateUrl = input.scenePlateUrl.trim();
  if (!plateUrl.startsWith("http")) {
    throw new Error("Image de décor invalide. Regénère le décor.");
  }

  const enrichedInput = await applyPhotoPromptEnrichment(input);

  const composePrompt = buildFaceLockedSceneComposePrompt({
    gender: influencerStyle.gender,
    age: influencerAge,
    ethnicity: influencerStyle.ethnicity,
    hairColor: influencerStyle.hairColor,
    hairStyle: influencerStyle.hairStyle,
    bodyType: influencerStyle.bodyType,
    sceneDescription: enrichedInput.sceneDescription,
    pose: enrichedInput.pose,
    expression: enrichedInput.expression,
    outfit: enrichedInput.outfit,
    customPrompt: enrichedInput.customPrompt,
    useReferenceFace: true,
  });

  const negativePrompt = buildNegativePrompt(false, influencerStyle.gender ?? "female", {
    lockFace: true,
  });

  const lora = hasReadyLora({
    loraUrl: input.loraUrl,
    loraTriggerWord: input.loraTriggerWord,
  })
    ? {
        loraUrl: input.loraUrl!.trim(),
        triggerWord: input.loraTriggerWord!.trim(),
      }
    : undefined;

  let facePromptUsed = composePrompt;
  let promptWasSoftened = false;
  let faceLockResult;
  try {
    console.log(
      `[ai-image] Scene-first compose face-lock (${lora ? "lora" : "pulid"}) — plate ${plateUrl.slice(0, 60)} kept as preview only`
    );
    faceLockResult = await generateFaceLockedImages({
      faceUrl: baseUrl,
      prompt: facePromptUsed,
      negativePrompt,
      numImages,
      lora,
    });
  } catch (err) {
    if (!isContentSafetyFilterError(err)) {
      if (isFaceLockError(err)) throw err;
      const detail = err instanceof Error ? err.message : String(err);
      console.warn(
        `[ai-image] Scene-first face-lock failed (${detail.slice(0, 200)}) — surfacing face-lock error instead of dropping to Nano.`
      );
      throwFaceLockError(detail.slice(0, 200));
    }

    const soft = softenPromptForEditorial(composePrompt);
    console.warn(
      "[ai-image] Scene-first face-lock blocked by safety filter — retrying once with editorial-softened prompt."
    );
    try {
      faceLockResult = await generateFaceLockedImages({
        faceUrl: baseUrl,
        prompt: soft,
        negativePrompt,
        numImages,
        lora,
      });
      facePromptUsed = soft;
      promptWasSoftened = true;
    } catch (retryErr) {
      if (isFaceLockError(retryErr)) throw retryErr;
      const detail = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.warn(
        `[ai-image] Scene-first face-lock retry failed (${detail.slice(0, 200)}) — surfacing face-lock error.`
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
    // Partial success is possible (face-lock providers may return fewer than
    // requested): bill on delivered images, never on requested count.
    await deductCredits(
      userId,
      CREDIT_COSTS.PHOTO * Math.min(storedUrls.length, numImages)
    );
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
      scenePlateUrl: plateUrl,
      photoPhase: "final",
      workflow: "scene_first_face_locked",
    },
  };
}
