/**
 * Scene context inference, pose compatibility, and prompt-safe pose phrases.
 * Keeps outdoor scenes from inheriting mirror-selfie pose tokens.
 */

export type Gender = "female" | "male" | "nonbinary";
export type GenderedTemplate = { female: string; male: string; nonbinary: string };

export type SceneContextKind =
  | "mirror_indoor"
  | "outdoor"
  | "seated_indoor"
  | "neutral";

export type PhotoScenePoseInput = {
  scene?: string;
  sceneDescription?: string;
};

const PRESET_SCENE_CONTEXT: Record<string, SceneContextKind> = {
  studio: "mirror_indoor",
  gym: "mirror_indoor",
  bedroom: "mirror_indoor",
  urban: "outdoor",
  beach: "outdoor",
  nature: "outdoor",
  rooftop: "outdoor",
  pool: "outdoor",
  cafe: "seated_indoor",
  restaurant: "seated_indoor",
};

/** Poses allowed per inferred scene context (UI + auto-switch). */
const POSES_BY_CONTEXT: Record<SceneContextKind, readonly string[]> = {
  mirror_indoor: ["portrait", "fullBody", "selfie", "candid"],
  outdoor: ["action", "candid"],
  seated_indoor: ["candid", "portrait", "action"],
  neutral: ["portrait", "fullBody", "selfie", "action", "candid"],
};

const MIRROR_POSES = new Set(["portrait", "fullBody", "selfie"]);

const OUTDOOR_POSE_TEMPLATES: Record<string, GenderedTemplate> = {
  portrait: {
    female:
      "close-up outdoor selfie at arm's length, phone in hand, no mirror, natural head tilt, slight smile",
    male:
      "close-up outdoor selfie at arm's length, phone in hand, no mirror, slight smirk, hand in hair",
    nonbinary:
      "close-up outdoor selfie at arm's length, phone in hand, no mirror, natural expression",
  },
  fullBody: {
    female:
      "full body outdoors, standing naturally, phone in hand for OOTD, no mirror, weight on one hip",
    male:
      "full body outdoors, confident stance, phone in hand, no mirror, casual street style",
    nonbinary: "full body outdoors, natural stance, phone in hand, no mirror, OOTD",
  },
  selfie: {
    female:
      "arm-length selfie outdoors, phone visible, peace sign or natural smile, no mirror reflection",
    male:
      "arm-length selfie outdoors, phone visible, neutral smirk, no mirror reflection",
    nonbinary: "arm-length selfie outdoors, phone in hand, no mirror reflection",
  },
};

const NO_MIRROR_RE = /\b(no mirror|sans miroir|not in a mirror|no bathroom mirror)\b/i;
const MIRROR_RE =
  /\b(mirror|miroir|gym mirror|bathroom|full[- ]length mirror|mirror selfie|dressing room)\b/i;
const OUTDOOR_RE =
  /\b(sidewalk|street|outdoor|beach|ocean|sand|park|hiking|trail|city|urban|crosswalk|terrace|rooftop|pool deck|sunset skyline|in the sun)\b/i;
const SEATED_RE =
  /\b(cafe|coffee shop|restaurant|table|sitting|seated|diner|bistro|brunch)\b/i;

export function inferSceneContext(input: PhotoScenePoseInput): SceneContextKind {
  const text = `${input.sceneDescription ?? ""} ${input.scene ?? ""}`.toLowerCase();
  const explicitNoMirror = NO_MIRROR_RE.test(text);

  if (!explicitNoMirror && MIRROR_RE.test(text)) {
    return "mirror_indoor";
  }
  if (OUTDOOR_RE.test(text)) {
    return "outdoor";
  }
  if (SEATED_RE.test(text)) {
    return "seated_indoor";
  }
  if (input.scene && PRESET_SCENE_CONTEXT[input.scene]) {
    return PRESET_SCENE_CONTEXT[input.scene];
  }
  return "neutral";
}

export function getCompatiblePoseIds(
  input: PhotoScenePoseInput
): readonly string[] {
  return POSES_BY_CONTEXT[inferSceneContext(input)];
}

export function isPoseCompatibleWithScene(
  pose: string,
  input: PhotoScenePoseInput
): boolean {
  return getCompatiblePoseIds(input).includes(pose);
}

export function pickDefaultPoseForScene(
  input: PhotoScenePoseInput,
  currentPose?: string
): string {
  const allowed = getCompatiblePoseIds(input);
  if (currentPose && allowed.includes(currentPose)) {
    return currentPose;
  }
  if (allowed.includes("candid")) return "candid";
  return allowed[0] ?? "candid";
}

export function resolvePosePhrase(
  pose: string,
  gender: Gender,
  context: SceneContextKind,
  presetTemplates: Record<string, GenderedTemplate>
): string {
  if (context === "outdoor" && MIRROR_POSES.has(pose)) {
    const outdoor = OUTDOOR_POSE_TEMPLATES[pose];
    if (outdoor) return outdoor[gender];
  }
  const set = presetTemplates[pose];
  if (set) return set[gender];
  return pose;
}

export function usesMirrorPose(pose: string, context: SceneContextKind): boolean {
  return context === "mirror_indoor" && MIRROR_POSES.has(pose);
}
