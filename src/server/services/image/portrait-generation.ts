import { nanoid } from "nanoid";
import {
  buildNegativePrompt,
  pickAppearanceVariations,
  appearanceFingerprint,
  PORTRAIT_IMAGE_PARAMS,
} from "@/lib/prompts/image-prompts";
import type { AppearanceVariation } from "@/lib/prompts/image-prompts";
import { uploadFromUrl } from "@/server/services/storage.service";
import { isContentSafetyFilterError } from "@/lib/generation-errors";
import { checkCredits, deductCredits } from "@/server/services/credits.service";
import { CREDIT_COSTS } from "@/lib/constants";
import { usesExtendedBodyGeneration } from "@/lib/appearance-v2";
import { runFalFluxSchnellPreview } from "@/server/services/image-providers/fal-flux-t2i.provider";
import type { FalFluxT2iInput } from "@/server/services/image-providers/fal-flux-t2i.provider";
import { isFalImageConfigured } from "@/lib/image-t2i-config";
import {
  MODEL_SFW_NANO,
  MODEL_SFW_T2I,
  NANO_BANANA_DEFAULTS,
} from "./model-constants";
import {
  runMultiplePredictions,
  runReplicateFluxT2iMultiple,
} from "./replicate-runner";
import { generatePremiumImagesWithModeration } from "./premium-pipeline";
import {
  buildPortraitPromptFromStyle,
  type InfluencerStyle,
  type ImageGenerationOutput,
} from "./types";

let falWizardPreviewBlockedUntil = 0;

function isFalWizardPreviewBlocked(): boolean {
  return Date.now() < falWizardPreviewBlockedUntil;
}

function markFalWizardPreviewBlocked(error: unknown): void {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    msg.includes("403") ||
    msg.includes("exhausted balance") ||
    msg.includes("user is locked")
  ) {
    falWizardPreviewBlockedUntil = Date.now() + 60 * 60 * 1000;
    console.warn(
      "[ai-image] FAL wizard preview disabled for 1h (balance/lock). Using Replicate only."
    );
  }
}

export async function generateWizardAppearancePreview(
  _userId: string,
  influencerAge: number,
  style: InfluencerStyle,
  presetVariations?: AppearanceVariation
): Promise<{
  imageUrl: string;
  promptUsed: string;
  model: string;
  appearanceVariations: AppearanceVariation;
  appearanceFingerprint: string;
}> {
  const variations = presetVariations ?? pickAppearanceVariations();
  const fingerprint = appearanceFingerprint(style, influencerAge, variations);
  const prompt = buildPortraitPromptFromStyle(influencerAge, style, variations);

  const negativePrompt = buildNegativePrompt(false, style.gender ?? "female");
  const extendedBody = usesExtendedBodyGeneration(style);

  if (extendedBody) {
    const premium = await generatePremiumImagesWithModeration(
      prompt,
      negativePrompt,
      1
    );
    const storedUrl = await uploadFromUrl(
      premium.urls[0]!,
      `wizard-preview-ext-${nanoid(8)}.jpg`
    );
    return {
      imageUrl: storedUrl,
      promptUsed: premium.promptUsed,
      model: premium.model,
      appearanceVariations: variations,
      appearanceFingerprint: fingerprint,
    };
  }

  const fluxInput: FalFluxT2iInput = {
    prompt,
    negative_prompt: negativePrompt,
    width: PORTRAIT_IMAGE_PARAMS.width,
    height: PORTRAIT_IMAGE_PARAMS.height,
    num_inference_steps: 4,
  };

  if (isFalImageConfigured() && !isFalWizardPreviewBlocked()) {
    try {
      const { url, model } = await runFalFluxSchnellPreview(fluxInput);
      const storedUrl = await uploadFromUrl(
        url,
        `wizard-preview-${nanoid(8)}.jpg`
      );
      return {
        imageUrl: storedUrl,
        promptUsed: prompt,
        model,
        appearanceVariations: variations,
        appearanceFingerprint: fingerprint,
      };
    } catch (error) {
      markFalWizardPreviewBlocked(error);
      const msg = error instanceof Error ? error.message : String(error);
      if (!isFalWizardPreviewBlocked()) {
        console.warn(
          `[ai-image] FAL wizard preview unavailable (${msg.slice(0, 120)}), falling back to Replicate…`
        );
      }
    }
  }

  const { urls, model } = await runReplicateFluxT2iMultiple(fluxInput, 1);
  const storedUrl = await uploadFromUrl(
    urls[0]!,
    `wizard-preview-${nanoid(8)}.jpg`
  );
  return {
    imageUrl: storedUrl,
    promptUsed: prompt,
    model,
    appearanceVariations: variations,
    appearanceFingerprint: fingerprint,
  };
}

export async function generateBaseImage(
  userId: string,
  influencerAge: number,
  style: InfluencerStyle,
  presetVariations?: AppearanceVariation
): Promise<ImageGenerationOutput> {
  const cost = CREDIT_COSTS.BASE_IMAGE;
  const hasCredits = await checkCredits(userId, cost);
  if (!hasCredits) {
    throw new Error(
      `Crédits insuffisants. Coût : ${cost} crédits. Passez à un plan supérieur.`
    );
  }

  const variations = presetVariations ?? pickAppearanceVariations();
  const fingerprint = appearanceFingerprint(style, influencerAge, variations);

  const prompt = buildPortraitPromptFromStyle(influencerAge, style, variations);

  const negativePrompt = buildNegativePrompt(false, style.gender ?? "female");
  const numVariants = 4;
  const extendedBody = usesExtendedBodyGeneration(style);

  if (extendedBody) {
    console.log(
      `[ai-image] Extended body generation (fingerprint=${fingerprint})…`
    );
    const premium = await generatePremiumImagesWithModeration(
      prompt,
      negativePrompt,
      numVariants
    );
    const storedUrls = await Promise.all(
      premium.urls.map(async (url, i) => {
        const filename = `base-${nanoid(6)}-${i}.jpg`;
        return uploadFromUrl(url, filename);
      })
    );
    await deductCredits(userId, cost);
    return {
      imageUrls: storedUrls,
      promptUsed: premium.promptUsed,
      negativePrompt,
      parameters: {
        replicateModel: premium.model,
        provider: premium.provider,
        bodyGenerationMode: "extended",
      },
      appearanceVariations: variations,
      appearanceFingerprint: fingerprint,
    };
  }

  let outputUrls: string[];
  let usedParams: Record<string, unknown>;
  let usedModel: string = MODEL_SFW_NANO;

  const nanoParams: Record<string, unknown> = {
    ...NANO_BANANA_DEFAULTS,
    aspect_ratio: "3:4",
    prompt,
    image_input: [] as string[],
  };

  try {
    console.log(
      `[ai-image] Generating base portrait (nano-banana, fingerprint=${fingerprint})…`
    );
    outputUrls = await runMultiplePredictions(
      MODEL_SFW_NANO,
      nanoParams,
      numVariants
    );
    usedParams = nanoParams;
  } catch (err) {
    if (!isContentSafetyFilterError(err)) throw err;
    console.warn(
      "[ai-image] Nano blocked wizard portrait, falling back to flux-1.1-pro…"
    );
    usedModel = MODEL_SFW_T2I;
    usedParams = {
      ...PORTRAIT_IMAGE_PARAMS,
      prompt,
      negative_prompt: negativePrompt,
      safety_tolerance: 5,
    };
    outputUrls = await runMultiplePredictions(
      MODEL_SFW_T2I,
      usedParams,
      numVariants
    );
  }

  try {
    const storedUrls = await Promise.all(
      outputUrls.map(async (url, i) => {
        const filename = `base-${nanoid(6)}-${i}.jpg`;
        return uploadFromUrl(url, filename);
      })
    );

    await deductCredits(userId, cost);

    return {
      imageUrls: storedUrls,
      promptUsed: prompt,
      negativePrompt,
      parameters: { ...usedParams, replicateModel: usedModel },
      appearanceVariations: variations,
      appearanceFingerprint: fingerprint,
    };
  } catch (error) {
    console.error("[ai-image] generateBaseImage error:", error);
    throw error;
  }
}

export async function generateSeedBasePortrait(
  influencerAge: number,
  style: InfluencerStyle
): Promise<{ imageUrl: string; promptUsed: string }> {
  const variations = pickAppearanceVariations();
  const prompt = buildPortraitPromptFromStyle(influencerAge, style, variations);
  const negativePrompt = buildNegativePrompt(false, style.gender ?? "female");

  let outputUrls: string[];
  const nanoParams: Record<string, unknown> = {
    ...NANO_BANANA_DEFAULTS,
    aspect_ratio: "3:4",
    prompt,
    image_input: [] as string[],
  };

  try {
    outputUrls = await runMultiplePredictions(MODEL_SFW_NANO, nanoParams, 1);
  } catch (err) {
    if (!isContentSafetyFilterError(err)) throw err;
    outputUrls = await runMultiplePredictions(
      MODEL_SFW_T2I,
      {
        ...PORTRAIT_IMAGE_PARAMS,
        prompt,
        negative_prompt: negativePrompt,
        safety_tolerance: 5,
      },
      1
    );
  }

  const rawUrl = outputUrls[0];
  if (!rawUrl) throw new Error("Seed portrait generation returned no image.");

  const stored = await uploadFromUrl(rawUrl, `base-portrait-${nanoid(8)}.jpg`);
  return { imageUrl: stored, promptUsed: prompt };
}
