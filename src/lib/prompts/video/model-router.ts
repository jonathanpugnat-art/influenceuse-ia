import type { ReelStylePreset } from "./prompt-builder";

export type VideoModelId =
  | "minimax/video-01"
  | "kwaivgi/kling-v2.0"
  | "wan-video/wan-2.5-i2v"
  | "runwayml/gen4-aleph"
  | "sync/sync-1.6.0";

export interface VideoModelDescriptor {
  id: VideoModelId;
  /** Display label shown in admin/debug UIs. */
  label: string;
  /** Accepts an `image` / `subject_reference` input for I2V and identity. */
  supportsImageRef: boolean;
  /**
   * Name of the input field this model expects for the reference image. Each
   * Replicate provider uses its own naming and we MUST send the right key —
   * sending `first_frame_image` to Kling silently drops the identity lock,
   * sending `subject_reference` to MiniMax alongside `first_frame_image`
   * triggers a hard E006 ("cannot use both"). Discovered the hard way on
   * 2026-05-16 when the first beta reel generation failed for this exact
   * reason. See `buildVideoModelInputs()` in ai-video.service.ts for usage.
   */
  imageRefField?: "image" | "first_frame_image" | "start_image";
  /**
   * Optional secondary identity field. Today only MiniMax exposes this
   * (`subject_reference` for the S2V-01 path). It is mutually exclusive with
   * `imageRefField` on MiniMax — set ONE, not both. We model that constraint
   * in `buildVideoModelInputs` by preferring the start frame when both are
   * present (MiniMax + same-image avatar = identical inputs anyway).
   */
  subjectRefField?: "subject_reference";
  /** True when prompt enrichment should be left to the model itself. */
  internalPromptOptimizer: boolean;
  /**
   * True when the model is a *post-process* (e.g. lip-sync) that requires both
   * an existing video AND an audio track. Caller must run a base-video model
   * first, then chain this model on the resulting MP4 + audio.
   */
  requiresAudio: boolean;
  /** Strengths of this model — used for both routing and i18n descriptions. */
  strengths: ("identity" | "motion" | "cinematic" | "speed" | "lip_sync")[];
}

export const VIDEO_MODELS: Record<VideoModelId, VideoModelDescriptor> = {
  "minimax/video-01": {
    id: "minimax/video-01",
    label: "MiniMax Video-01",
    supportsImageRef: true,
    imageRefField: "first_frame_image",
    subjectRefField: "subject_reference",
    internalPromptOptimizer: true,
    requiresAudio: false,
    strengths: ["identity", "motion"],
  },
  "kwaivgi/kling-v2.0": {
    id: "kwaivgi/kling-v2.0",
    label: "Kling 2.0",
    supportsImageRef: true,
    imageRefField: "start_image",
    internalPromptOptimizer: false,
    requiresAudio: false,
    strengths: ["identity", "cinematic"],
  },
  "wan-video/wan-2.5-i2v": {
    id: "wan-video/wan-2.5-i2v",
    label: "Wan 2.5 I2V",
    supportsImageRef: true,
    imageRefField: "image",
    internalPromptOptimizer: false,
    requiresAudio: false,
    strengths: ["motion", "speed"],
  },
  "runwayml/gen4-aleph": {
    id: "runwayml/gen4-aleph",
    label: "Runway Gen-4 Aleph",
    supportsImageRef: false,
    internalPromptOptimizer: false,
    requiresAudio: false,
    strengths: ["cinematic"],
  },
  "sync/sync-1.6.0": {
    id: "sync/sync-1.6.0",
    label: "Sync Lip-Sync 1.6",
    supportsImageRef: false,
    internalPromptOptimizer: false,
    requiresAudio: true,
    strengths: ["lip_sync"],
  },
};

/**
 * Build the model-specific image input map. Returns an empty object when the
 * model doesn't support reference images at all (e.g. Runway Gen-4).
 *
 * Why this lives here: each Replicate provider names its inputs differently
 * (`image`, `start_image`, `first_frame_image`) AND MiniMax has the extra
 * constraint that `first_frame_image` and `subject_reference` are mutually
 * exclusive at runtime. Centralising the mapping next to the descriptors
 * keeps that knowledge in one place — adding a new provider only requires
 * setting `imageRefField`, no service code changes.
 *
 * @param model - The resolved model descriptor (from resolveReplicateVideoModel)
 * @param firstFrameUrl - URL of the start-frame / character reference image
 * @param subjectRefUrl - Optional secondary identity reference. Ignored when
 *   the model has no `subjectRefField` OR when it equals `firstFrameUrl`
 *   (preventing the MiniMax E006 collision when avatarUrl === baseImageUrl).
 */
export function buildVideoModelInputs(
  model: VideoModelDescriptor,
  firstFrameUrl: string | undefined,
  subjectRefUrl: string | undefined
): Record<string, string> {
  if (!model.supportsImageRef || !firstFrameUrl) return {};
  const inputs: Record<string, string> = {};
  const frame = firstFrameUrl.trim();
  if (!frame) return inputs;

  if (model.imageRefField) {
    inputs[model.imageRefField] = frame;
  }

  // Only attach the subject reference when it is BOTH supported by the model
  // AND distinct from the start frame. MiniMax rejects identical refs (E006);
  // other providers don't have the field so we'd just be sending dead weight.
  if (model.subjectRefField && subjectRefUrl) {
    const subj = subjectRefUrl.trim();
    if (subj && subj !== frame) {
      inputs[model.subjectRefField] = subj;
    }
  }
  return inputs;
}

/** Default routing table by reel style preset. */
const DEFAULT_PRESET_ROUTING: Record<ReelStylePreset, VideoModelId> = {
  /** Kling: strong identity lock on a single start frame (no dual ref). */
  stable_face: "kwaivgi/kling-v2.0",
  /** Wan 2.5 I2V: one image in → natural handheld motion (best default for IG reels). */
  natural_motion: "wan-video/wan-2.5-i2v",
  /** MiniMax Video-01 — earlier Aura default; some users prefer it for calm clips. */
  classic_motion: "minimax/video-01",
  creative: "runwayml/gen4-aleph",
  lip_sync: "kwaivgi/kling-v2.0",
};

/** Built-in candidates for a preset (may include Wan when Runway can't take a start frame). */
function builtInVideoModelCandidates(
  preset: ReelStylePreset,
  hasRef: boolean
): VideoModelId[] {
  const primary = DEFAULT_PRESET_ROUTING[preset];
  const list: VideoModelId[] = [primary];
  if (hasRef && !VIDEO_MODELS[primary].supportsImageRef) {
    list.push("wan-video/wan-2.5-i2v");
  }
  return list;
}

/** Human label for UI — matches built-in routing (env overrides not reflected). */
export function presetDefaultVideoModelLabel(
  preset: ReelStylePreset,
  hasStartFrame = true
): string {
  for (const id of builtInVideoModelCandidates(preset, hasStartFrame)) {
    const desc = VIDEO_MODELS[id];
    if (hasStartFrame && !desc.supportsImageRef) continue;
    return desc.label;
  }
  return VIDEO_MODELS["wan-video/wan-2.5-i2v"].label;
}

/**
 * Picks the best Replicate model for the requested preset.
 *
 * Hierarchy:
 *  1. `REPLICATE_VIDEO_MODEL_<PRESET>` env override (e.g. `_NATURAL_MOTION`).
 *  2. Built-in routing table (per preset; Wan when creative + start frame).
 *  3. `REPLICATE_VIDEO_MODEL` legacy global override (last resort — do not set
 *     to `minimax/video-01` unless you want every preset on MiniMax).
 *  4. Hard fallback: Wan 2.5 I2V with a start frame, else MiniMax Video-01.
 */
export function resolveReplicateVideoModel(opts?: {
  preset?: ReelStylePreset;
  hasReferenceImage?: boolean;
}): VideoModelDescriptor {
  const preset: ReelStylePreset = opts?.preset ?? "natural_motion";
  const hasRef = opts?.hasReferenceImage ?? false;

  const presetEnvKey = `REPLICATE_VIDEO_MODEL_${preset.toUpperCase()}`;
  const presetEnv = process.env[presetEnvKey]?.trim();
  const globalEnv = process.env.REPLICATE_VIDEO_MODEL?.trim();

  const candidates = [
    presetEnv,
    ...builtInVideoModelCandidates(preset, hasRef),
    globalEnv,
  ].filter(Boolean) as VideoModelId[];

  for (const id of candidates) {
    const desc = VIDEO_MODELS[id as VideoModelId];
    if (!desc) {
      console.warn(`[ai-video] "${id}" is not allowlisted; trying next candidate`);
      continue;
    }
    if (hasRef && !desc.supportsImageRef) {
      console.warn(
        `[ai-video] ${id} does not accept a reference image; trying next candidate`
      );
      continue;
    }
    return desc;
  }

  return hasRef
    ? VIDEO_MODELS["wan-video/wan-2.5-i2v"]
    : VIDEO_MODELS["minimax/video-01"];
}

/**
 * Sprint 10: returns the lip-sync post-process descriptor when the user picks
 * the `lip_sync` preset. The caller (ai-video.service) is responsible for
 * chaining this on top of a regular video generation.
 */
export function resolveLipSyncModel(): VideoModelDescriptor | null {
  const env = process.env.REPLICATE_LIPSYNC_MODEL?.trim();
  if (env) {
    const desc = VIDEO_MODELS[env as VideoModelId];
    if (desc?.requiresAudio) return desc;
    console.warn(
      `[ai-video] REPLICATE_LIPSYNC_MODEL="${env}" is not a registered lip-sync model; falling back to default.`
    );
  }
  return VIDEO_MODELS["sync/sync-1.6.0"];
}

/** Legacy alias kept for tests/callers expecting the literal allowlist array. */
export const VIDEO_MODEL_ALLOWLIST = Object.keys(VIDEO_MODELS) as VideoModelId[];
export type VideoModelAllowlist = VideoModelId;
