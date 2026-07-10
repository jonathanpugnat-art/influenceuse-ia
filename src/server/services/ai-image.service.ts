/**
 * Public façade — re-exports the image generation module.
 * Import from here or from `@/server/services/ai-image.service` (same API).
 */
export type {
  InfluencerStyle,
  ImageGenerationInput,
  ImageGenerationOutput,
} from "./image/types";

export {
  generateWizardAppearancePreview,
  generateBaseImage,
  generateSeedBasePortrait,
  sceneFirstPhotoCreditCost,
  generateScenePlateImage,
  composeImageOnScenePlate,
  generateContentImage,
} from "./image";
