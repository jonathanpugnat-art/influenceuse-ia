// Types
export type {
  AppearanceTraits,
  AppearanceVariation,
  Gender,
  GenderedTemplate,
  NegativePromptOptions,
  PromptBuildInput,
} from "./types";

// Appearance variations + portrait template
export {
  APPEARANCE_VARIATIONS,
  BASE_PORTRAIT_TEMPLATE,
  appearanceFingerprint,
  explodeAppearanceVariations,
  genderLabel,
  pickAppearanceVariations,
  renderAppearanceVariations,
} from "./appearance-variations";

// Scene catalog
export {
  SCENE_ACCESSORIES,
  SCENE_INSPIRATIONS,
  SCENE_TEMPLATES,
  getSceneInspirationText,
} from "./scene-catalog";

// Pose / expression / style / lighting catalogs
export {
  EXPRESSION_TEMPLATES,
  LIGHTING_TEMPLATES,
  POSE_TEMPLATES,
  STYLE_TEMPLATES,
} from "./pose-style-catalog";

// Negatives + NSFW
export {
  NEGATIVE_PROMPT_NSFW,
  NEGATIVE_PROMPT_SFW,
  NSFW_TEMPLATES,
} from "./negatives-nsfw";

// Replicate params
export {
  DEFAULT_IMAGE_PARAMS,
  KONTEXT_IMAGE_PARAMS,
  KONTEXT_PORTRAIT_PARAMS,
  PORTRAIT_IMAGE_PARAMS,
} from "./replicate-params";

// Builders
export { buildBasePortraitPrompt } from "./portrait-builder";
export {
  buildActionBlock,
  buildEngineBlock,
  buildIdentityBlock,
  buildMoodBlock,
  buildNegativeBlock,
  buildNsfwBlock,
  buildSceneBlock,
  buildSubjectBlock,
  buildTechnicalBase,
} from "./prompt-blocks";
export { buildFullPrompt, buildNegativePrompt } from "./build-prompt";
