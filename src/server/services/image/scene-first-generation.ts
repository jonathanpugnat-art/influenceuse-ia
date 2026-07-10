import { nanoid } from "nanoid";
import {
  buildNegativePrompt,
  DEFAULT_IMAGE_PARAMS,
} from "@/lib/prompts/image-prompts";
import {
  buildSceneFirstComposePrompt,
  buildScenePlatePrompt,
  SCENE_FIRST_PLATE_CREDIT,
} from "@/lib/prompts/scene-first-photo";
import { softenPromptForEditorial } from "@/lib/prompts/safety-soften";
import { selectIdentityPackRefs } from "@/lib/identity-pack";
import { uploadFromUrl } from "@/server/services/storage.service";
import { isContentSafetyFilterError } from "@/lib/generation-errors";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";
import { MODEL_SFW_NANO, MODEL_SFW_T2I, NANO_BANANA_DEFAULTS } from "./model-constants";
import { runMultiplePredictions } from "./replicate-runner";
import { applyPhotoPromptEnrichment, resolveEnrichedSceneAndOutfit } from "./photo-enrichment";
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
  if (!baseUrl?.startsWith("http")) {
    throw new Error(
      "Portrait de référence requis. Regénère l'image de base de l'influenceuse."
    );
  }
  const plateUrl = input.scenePlateUrl.trim();
  if (!plateUrl.startsWith("http")) {
    throw new Error("Image de décor invalide. Regénère le décor.");
  }

  const enrichedInput = await applyPhotoPromptEnrichment(input);

  const identityRefs = selectIdentityPackRefs(baseUrl, enrichedInput.identityPack, {
    pose: enrichedInput.pose,
    sceneDescription: enrichedInput.sceneDescription,
    maxTotal: 3,
  });
  const imageInput = [...identityRefs, plateUrl].slice(0, 4);

  const composePrompt = buildSceneFirstComposePrompt({
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

  const nanoParams: Record<string, unknown> = {
    ...NANO_BANANA_DEFAULTS,
    prompt: composePrompt,
    image_input: imageInput,
  };

  let outputUrls: string[];
  let usedParams = nanoParams;
  let promptUsed = composePrompt;
  let promptWasSoftened = false;
  try {
    outputUrls = await runMultiplePredictions(MODEL_SFW_NANO, nanoParams, numImages);
  } catch (err) {
    if (isContentSafetyFilterError(err)) {
      const soft = softenPromptForEditorial(composePrompt);
      outputUrls = await runMultiplePredictions(
        MODEL_SFW_NANO,
        { ...nanoParams, prompt: soft },
        numImages
      );
      usedParams = { ...nanoParams, prompt: soft };
      promptUsed = soft;
      promptWasSoftened = true;
    } else {
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
    await deductCredits(userId, cost);
  }

  return {
    imageUrls: storedUrls,
    promptUsed,
    negativePrompt,
    promptWasSoftened,
    parameters: {
      ...usedParams,
      contentEngine: "nano",
      scenePlateUrl: plateUrl,
      imageInputCount: imageInput.length,
      photoPhase: "final",
    },
  };
}
