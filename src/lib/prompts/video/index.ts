export type { ReelStylePreset, VideoPromptInput } from "./prompt-builder";
export { buildVideoPrompt, isCrowdedScenePrompt } from "./prompt-builder";

export type {
  VideoModelAllowlist,
  VideoModelDescriptor,
  VideoModelId,
} from "./model-router";
export {
  VIDEO_MODEL_ALLOWLIST,
  VIDEO_MODELS,
  buildVideoModelInputs,
  presetDefaultVideoModelLabel,
  resolveLipSyncModel,
  resolveReplicateVideoModel,
} from "./model-router";
