import {
  pickDefaultPoseForScene,
  type PhotoScenePoseInput,
} from "@/lib/photo-scene-pose";

const EXPLICIT_SELFIE_RE =
  /\b(selfie|miroir|mirror selfie|mirror shot|devant le miroir|in the mirror)\b/i;

const SUGGESTIVE_SCENE_RE =
  /\b(sexy|sensuel|séduis|seductive|provocat|bikini|lingerie|décolleté|decollate|boudoir|nu\b|nude|hot girl|glamour)\b/i;

const PROP_ACTION_RE =
  /\b(candy|bonbon|sucette|café|coffee|latte|wine|cocktail|holding|tient|mange|eating|drink|boit|bag|sac|flower|fleur)\b/i;

export function userRequestedSelfie(sceneDescription: string): boolean {
  return EXPLICIT_SELFIE_RE.test(sceneDescription.trim());
}

export function inferPoseFromScene(
  input: PhotoScenePoseInput,
  currentPose?: string
): string {
  const text = input.sceneDescription?.trim() ?? "";
  if (userRequestedSelfie(text)) {
    if (/miroir|mirror/i.test(text)) return "selfie";
    return "selfie";
  }
  return pickDefaultPoseForScene(input, currentPose);
}

export function inferExpressionFromSceneAndOutfit(
  sceneDescription: string,
  outfit: string,
  currentExpression: string
): string {
  if (currentExpression !== "smile" && currentExpression !== "natural") {
    return currentExpression;
  }
  const combined = `${sceneDescription} ${outfit}`.toLowerCase();
  if (SUGGESTIVE_SCENE_RE.test(combined)) {
    return "seductive";
  }
  return currentExpression;
}

export function sceneMentionsProps(sceneDescription: string): boolean {
  return PROP_ACTION_RE.test(sceneDescription.trim());
}

export function usesSelfieCameraFraming(
  pose: string,
  sceneDescription?: string
): boolean {
  if (pose === "selfie") return true;
  const text = sceneDescription ?? "";
  if (userRequestedSelfie(text) && (pose === "portrait" || pose === "fullBody")) {
    return true;
  }
  return false;
}
