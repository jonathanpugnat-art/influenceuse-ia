/**
 * Build photo-generation params for a reel's first frame (scene before I2V).
 */

export type ReelSceneFrameInput = {
  script: string;
  sceneDescription?: string;
  outfit?: string;
  videoType: string;
};

export type ReelSceneFrameOutput = {
  scene: string;
  sceneDescription: string;
  outfit: string;
  pose: string;
  expression: string;
  style: string;
  lighting: string;
  customPrompt: string;
};

const SCENE_FRAME_SUFFIX =
  "High-end Instagram fashion creator still, tasteful editorial look, fully clothed, appropriate for social media. " +
  "Candid mid-action frame for a vertical 9:16 Reel — NOT a studio passport photo on grey backdrop. " +
  "Full real environment visible (walls, mirror, tiles, furniture). iPhone camera, natural light, authentic UGC quality. " +
  "Natural pose with subtle movement implied. No text on image.";

export function inferReelScenePreset(script: string, videoType: string): string {
  const s = `${script} ${videoType}`.toLowerCase();
  if (/bathroom|salle de bain|douche|bath\b|grwm|skincare|vanity|miroir|mirror/.test(s)) {
    return "bedroom";
  }
  if (/gym|workout|fitness|musculation/.test(s)) return "gym";
  if (/café|cafe|coffee|brunch/.test(s)) return "cafe";
  if (/restaurant|dîner|dinner/.test(s)) return "restaurant";
  if (/beach|plage|mer\b|pool|piscine/.test(s)) return "beach";
  if (/street|rue|ville|urban|soho|tokyo|paris/.test(s)) return "urban";
  if (/travel|voyage|airport|aéroport/.test(s)) return "urban";
  return "urban";
}

function inferOutfitFromScript(script: string, videoType: string): string {
  const s = script.toLowerCase();
  if (/lingerie|boudoir|robe de chambre|dentelle|lace/.test(s)) {
    return "lace lounge outfit fashion editorial, soft fabrics, fully clothed";
  }
  if (/bikini|maillot/.test(s)) return "stylish bikini";
  if (/robe noire|black dress/.test(s)) return "elegant black dress";
  if (/tenue de sport|leggings|sports bra|gym outfit/.test(s)) {
    return "matching gym outfit, leggings and sports top";
  }
  if (/pyjama|pajama|robe de chambre/.test(s)) {
    return "casual homewear, soft loungewear";
  }
  if (videoType === "grwm" || /bathroom|salle de bain/.test(s)) {
    return "casual homewear or towel wrap, getting-ready vibe";
  }
  if (videoType === "ootd" || /outfit|tenue/.test(s)) {
    return "trendy casual outfit, fully visible";
  }
  return "stylish casual outfit matching the scene";
}

function inferPose(script: string, videoType: string): string {
  const s = script.toLowerCase();
  if (videoType === "grwm" || /bathroom|mirror|miroir|trying on|essayage/.test(s)) {
    return "candid";
  }
  if (videoType === "workout" || /gym|squat|exercise/.test(s)) return "action";
  if (/selfie/.test(s)) return "selfie";
  if (videoType === "talking_head" || videoType === "day_in_life") return "candid";
  return "candid";
}

/**
 * Maps user script + optional fields → content image params for the reel start frame.
 */
export function buildReelSceneFrameParams(
  input: ReelSceneFrameInput
): ReelSceneFrameOutput {
  const script = input.script.trim();
  const userScene = input.sceneDescription?.trim();
  const coreScene = userScene || script;
  const scene = inferReelScenePreset(coreScene, input.videoType);

  const sceneDescription = userScene
    ? `${userScene}. ${SCENE_FRAME_SUFFIX}`
    : `${script}. ${SCENE_FRAME_SUFFIX}`;

  const outfit =
    input.outfit?.trim() || inferOutfitFromScript(coreScene, input.videoType);

  return {
    scene,
    sceneDescription,
    outfit,
    pose: inferPose(coreScene, input.videoType),
    expression: "natural",
    style: "candid",
    lighting: "day",
    customPrompt:
      "Instagram-ready creator photo. Match location and outfit exactly. " +
      "Show a real place with depth and context — the video will add motion next, so pick a dynamic frozen moment (not a static ID photo).",
  };
}
