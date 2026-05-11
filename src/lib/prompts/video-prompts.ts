// ──────────────────────────────────────────────
// Video / Reel prompt templates (TikTok-style, face-consistent)
// ──────────────────────────────────────────────

export type ReelStylePreset =
  | "stable_face"
  | "natural_motion"
  | "creative"
  | "lip_sync";

export interface VideoPromptInput {
  videoType: string;
  script: string;
  effects?: string;
  /** Prioritize identity vs motion vs creative freedom */
  reelStylePreset?: ReelStylePreset;
}

const VIDEO_TYPE_PROMPTS: Record<string, string> = {
  talking_head:
    "talking to camera like a TikTok, subtle head movement, natural blinking, " +
    "no exaggerated lip-sync to imaginary speech, casual tone, phone propped on desk, " +
    "ring light reflection possible, genuine micro-expressions",
  transition:
    "TikTok outfit transition, hand covers camera then reveals new outfit, snap transition, fun, trending",
  dance:
    "TikTok dance trend, casual choreography in bedroom or living room, phone against wall, natural rhythm",
  workout:
    "gym clip, phone on bench, exercise demo, sweat, gym mirror, motivational fitness vibe",
  unboxing:
    "unboxing on bed or table, excited reaction, items close to camera, packaging visible",
  travel:
    "travel vlog, walking streets or landmark, low phone angle, golden hour, wanderlust",
  cooking:
    "overhead cooking, hands chopping and stirring, steam, quick recipe style",
  tutorial:
    "GRWM-style bathroom mirror, hair or skincare steps, talking casually to camera, products visible",
  grwm:
    "get ready at vanity, step by step, products on table, chatting casually",
  ootd:
    "OOTD mirror spin, outfit angles, bedroom, closet visible",
  day_in_life:
    "day in my life vlog, one continuous handheld clip feel, coffee routine, casual transitions in same space, authentic creator energy",
  sketch:
    "short comedy sketch, big reactions but still phone-filmed, viral skit timing, over the top but believable lighting",
};

const VIDEO_EFFECT_PROMPTS: Record<string, string> = {
  "slow-mo":
    "slow motion hair flip or movement, dramatic but casual, iPhone slow-mo mode",
  zoom: "quick zoom on face or outfit, TikTok zoom trend",
  pan: "smooth phone pan around subject, reveal environment",
  timelapse: "sped up routine, timelapse feel",
  bokeh: "portrait mode shallow depth, face sharp background soft",
  split: "split screen trend framing, two zones in frame",
  glitch: "subtle glitch transition beat, not full sci-fi",
  none: "no special effects, natural phone recording",
};

const PRESET_PREFIX: Record<ReelStylePreset, string> = {
  stable_face:
    "CRITICAL: the exact same person and face as the reference images throughout the clip, " +
    "no face drift, no identity change, same skin tone and facial features, " +
    "subtle natural motion only, smartphone vertical reel, not cinematic ",
  natural_motion:
    "same person as reference throughout, natural body and head motion, handheld iPhone vertical reel, " +
    "authentic TikTok energy, not a movie trailer ",
  creative:
    "based on the reference person and first frame, creative motion and energy, vertical social reel, fun and watchable ",
  lip_sync:
    "same person as reference throughout, slight natural body and head motion to enable accurate lip-sync, " +
    "talking-to-camera framing, mouth fully visible, no hand or hair occluding the lips, vertical reel ",
};

/**
 * Builds the full text prompt sent to the video model (e.g. MiniMax).
 */
export function buildVideoPrompt(input: VideoPromptInput): string {
  const preset: ReelStylePreset = input.reelStylePreset ?? "stable_face";
  const parts: string[] = [];

  parts.push(PRESET_PREFIX[preset]);
  parts.push(
    "realistic phone video, filmed on iPhone, vertical 9:16 social media reel, not AI glossy, not film grain overlay"
  );

  const typePrompt = VIDEO_TYPE_PROMPTS[input.videoType] ?? input.videoType;
  parts.push(typePrompt);

  if (input.script?.trim()) {
    parts.push(input.script.trim());
  }

  if (input.effects) {
    const effectKeys = input.effects.split(",").map((s) => s.trim()).filter(Boolean);
    for (const key of effectKeys) {
      const effect = VIDEO_EFFECT_PROMPTS[key] ?? key;
      parts.push(effect);
    }
  }

  parts.push(
    "natural handheld micro-shake, realistic skin and hair movement, available daylight or indoor lamps, " +
      "TikTok / Instagram Reel quality, casual authentic creator, no text on screen, no watermark"
  );

  return parts.join(", ");
}

// ──────────────────────────────────────────────
// Multi-model video router (Sprint 7)
//
// We support several Replicate-hosted T2V/I2V models and pick the best one
// based on the user's reelStylePreset and whether a subject reference image
// is available. Each entry declares the schema differences so the caller
// knows which input shape to use.
// ──────────────────────────────────────────────

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
    internalPromptOptimizer: true,
    requiresAudio: false,
    strengths: ["identity", "motion"],
  },
  "kwaivgi/kling-v2.0": {
    id: "kwaivgi/kling-v2.0",
    label: "Kling 2.0",
    supportsImageRef: true,
    internalPromptOptimizer: false,
    requiresAudio: false,
    strengths: ["identity", "cinematic"],
  },
  "wan-video/wan-2.5-i2v": {
    id: "wan-video/wan-2.5-i2v",
    label: "Wan 2.5 I2V",
    supportsImageRef: true,
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

/** Default routing table by reel style preset. */
const DEFAULT_PRESET_ROUTING: Record<ReelStylePreset, VideoModelId> = {
  stable_face: "kwaivgi/kling-v2.0",
  natural_motion: "minimax/video-01",
  creative: "runwayml/gen4-aleph",
  // For lip-sync the *base* video uses Kling (best face stability) and the
  // dedicated post-process is selected via `resolveLipSyncModel()`.
  lip_sync: "kwaivgi/kling-v2.0",
};

/**
 * Picks the best Replicate model for the requested preset.
 *
 * Hierarchy:
 *  1. `REPLICATE_VIDEO_MODEL_<PRESET>` env override (e.g. `_STABLE_FACE`).
 *  2. `REPLICATE_VIDEO_MODEL` legacy global override.
 *  3. Built-in routing table.
 *  4. Hard fallback to `minimax/video-01` if a reference image is needed
 *     but the chosen model can't accept one.
 */
export function resolveReplicateVideoModel(opts?: {
  preset?: ReelStylePreset;
  hasReferenceImage?: boolean;
}): VideoModelDescriptor {
  const preset: ReelStylePreset = opts?.preset ?? "stable_face";
  const hasRef = opts?.hasReferenceImage ?? false;

  const presetEnvKey = `REPLICATE_VIDEO_MODEL_${preset.toUpperCase()}`;
  const presetEnv = process.env[presetEnvKey]?.trim();
  const globalEnv = process.env.REPLICATE_VIDEO_MODEL?.trim();

  const candidates = [
    presetEnv,
    globalEnv,
    DEFAULT_PRESET_ROUTING[preset],
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

  return VIDEO_MODELS["minimax/video-01"];
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
