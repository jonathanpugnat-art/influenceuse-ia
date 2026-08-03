export type ReelStylePreset =
  | "stable_face"
  | "natural_motion"
  | "classic_motion"
  | "creative"
  | "lip_sync";

export interface VideoPromptInput {
  videoType: string;
  script: string;
  effects?: string;
  /** Prioritize identity vs motion vs creative freedom */
  reelStylePreset?: ReelStylePreset;
  /** Scene already baked into the first frame — motion only, no location change */
  sceneDescription?: string;
  /** First frame is a full scene still — forbid morphing from another identity photo */
  sceneFrameOnly?: boolean;
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
    "get ready in bathroom or at vanity, trying outfit, mirror reflection, subtle movements, products visible, casual creator energy",
  ootd:
    "OOTD in bathroom mirror or bedroom, showing outfit, gentle turn, closet visible",
  try_on:
    "trying on outfit in bathroom mirror, adjusting clothes, natural movements, same room throughout",
  day_in_life:
    "day in my life vlog, one continuous handheld clip feel, coffee routine, casual transitions in same space, authentic creator energy",
  sketch:
    "short comedy sketch, big reactions but still phone-filmed, viral skit timing, over the top but believable lighting",
};

const VIDEO_EFFECT_PROMPTS: Record<string, string> = {
  "slow-mo": "light slow motion",
  zoom: "subtle zoom",
  pan: "gentle pan",
  timelapse: "mild timelapse feel",
  bokeh: "shallow depth background blur",
  split: "split frame",
  glitch: "subtle glitch beat",
  none: "",
};

/** Inlined negatives — most video APIs have no negative_prompt field. */
const VIDEO_AVOID =
  "no plastic or waxy skin, no doll face, no AI glow, no cinematic grade, no robotic stiff motion, no morphing face, no text or logos on screen";

const PRESET_MOTION: Record<ReelStylePreset, string> = {
  stable_face:
    "subtle head movement, natural blinking, micro-expressions, slight handheld drift",
  natural_motion:
    "natural body sway, gentle hand gestures, handheld iPhone shake, real-time single take",
  classic_motion: "calm subtle motion, gentle blinking, slight handheld drift",
  creative: "expressive motion but still phone-filmed",
  lip_sync: "talking to camera, mouth visible, natural speech motion",
};

const CROWD_SCENE_RE =
  /\b(gym|crowd|people|busy|street|party|club|restaurant|café|cafe|public|strangers|background people)\b/i;

/** True when the user asked for other people / busy places — I2V struggles here. */
export function isCrowdedScenePrompt(scene?: string, motion?: string): boolean {
  const text = `${scene ?? ""} ${motion ?? ""}`;
  return CROWD_SCENE_RE.test(text);
}

function trimUserText(text: string, maxLen: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

/**
 * Compact video prompt — models (Kling, Wan, MiniMax) degrade when prompts
 * stack redundant blocks. User scene + motion come first; type hint only if
 * motion is empty.
 */
export function buildVideoPrompt(input: VideoPromptInput): string {
  const preset: ReelStylePreset = input.reelStylePreset ?? "natural_motion";
  const scene = trimUserText(input.sceneDescription ?? "", 400);
  const motion = trimUserText(input.script ?? "", 500);
  const crowded = isCrowdedScenePrompt(scene, motion);

  const sentences: string[] = [];

  sentences.push(
    "Same person, same outfit and same place as the reference image throughout"
  );

  if (scene) {
    sentences.push(`Scene: ${scene}`);
  }

  if (motion) {
    sentences.push(`Action: ${motion}`);
  } else {
    const hint = VIDEO_TYPE_PROMPTS[input.videoType];
    if (hint) sentences.push(hint);
  }

  if (crowded) {
    sentences.push(
      "Background people soft and mostly static, out of focus; she stays the sharp main subject"
    );
  }

  sentences.push(
    `Handheld iPhone Reel, authentic social clip, ${PRESET_MOTION[preset]}, natural skin pores, ${VIDEO_AVOID}`
  );

  if (input.sceneFrameOnly) {
    sentences.push("Opens on the reference frame, no location or identity change");
  } else {
    sentences.push("Do not change location");
  }

  const effectKeys = (input.effects ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((k) => k && k !== "none");
  if (effectKeys.length > 0) {
    const fx = VIDEO_EFFECT_PROMPTS[effectKeys[0]] ?? effectKeys[0];
    if (fx) sentences.push(fx);
  }

  return sentences.join(". ").replace(/\.\s*\./g, ".");
}
