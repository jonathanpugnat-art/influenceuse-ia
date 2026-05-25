import type { PhotoParams } from "@/hooks/use-photo-creator";
import type { ReelParams } from "@/hooks/use-reel-creator";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";
import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import { CONTENT_TEMPLATES, type ContentTemplate } from "@/lib/templates/content-templates";
import { REEL_CREATOR_EXAMPLES } from "@/lib/reel-creator-examples";

export type PhotoQuickIntentId =
  | "lifestyle"
  | "ootd"
  | "cafe"
  | "gym"
  | "product"
  | "story"
  | "surprise";

export type ReelQuickIntentId =
  | "lifestyle"
  | "talking"
  | "motivational"
  | "ootd"
  | "day_in_life"
  | "batch";

export type QuickIntentBase = {
  id: string;
  emoji: string;
  /** i18n: content.quickIntents.<variant>.<id>.title */
  titleKey: string;
  descKey: string;
};

function templateToPhotoPatch(
  tpl: ContentTemplate,
  gender: InfluencerGender
): Partial<PhotoParams> {
  const outfit =
    gender === "male" ? tpl.params.outfitMale : tpl.params.outfitFemale;
  const sceneDescription = getSceneInspirationText(tpl.params.scene);
  return {
    scene: tpl.params.scene,
    sceneDescription,
    pose: tpl.params.pose,
    expression: tpl.params.expression,
    photoStyle: tpl.params.photoStyle,
    timeOfDay: tpl.params.timeOfDay,
    outfit,
    location: tpl.params.location ?? "",
  };
}

export function applyPhotoQuickIntent(
  id: PhotoQuickIntentId,
  gender: InfluencerGender,
  niche?: string
): Partial<PhotoParams> {
  const pickTemplate = (templateId: string) => {
    const tpl = CONTENT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return {};
    return templateToPhotoPatch(tpl, gender);
  };

  switch (id) {
    case "lifestyle":
      return pickTemplate("morning-routine");
    case "ootd":
      return pickTemplate("airport-ootd");
    case "cafe":
      return pickTemplate("cafe-aesthetic");
    case "gym":
      return pickTemplate("mirror-selfie-gym");
    case "product":
      return {
        scene: "studio",
        sceneDescription:
          "clean product-style shot, soft studio light, influencer holding product naturally, editorial but authentic",
        pose: "portrait",
        expression: "smile",
        photoStyle: "editorial",
        timeOfDay: "natural",
        outfit: gender === "male" ? "minimal streetwear" : "chic casual outfit",
      };
    case "story":
      return {
        scene: "bedroom",
        sceneDescription:
          "casual story vibe, close framing, soft indoor light, relaxed chill mood, phone selfie angle",
        pose: "selfie",
        expression: "natural",
        photoStyle: "natural",
        timeOfDay: "natural",
        outfit: gender === "male" ? "hoodie" : "lounge set",
      };
    case "surprise": {
      const pool = niche
        ? CONTENT_TEMPLATES.filter(
            (t) => t.niches.length === 0 || t.niches.includes(niche)
          )
        : CONTENT_TEMPLATES;
      const tpl = pool[Math.floor(Math.random() * pool.length)]!;
      return templateToPhotoPatch(tpl, gender);
    }
    default:
      return {};
  }
}

export function applyReelQuickIntent(id: ReelQuickIntentId): Partial<ReelParams> {
  const ex = (eid: (typeof REEL_CREATOR_EXAMPLES)[number]["id"]) => {
    const e = REEL_CREATOR_EXAMPLES.find((x) => x.id === eid);
    if (!e) return {};
    return {
      videoType: e.videoType,
      sceneDescription: e.sceneDescription,
      outfit: e.outfit,
      script: e.script,
      generateSceneFrame: true,
      reelStylePreset: "natural_motion" as const,
      music: "none",
      effects: [],
      textOverlay: "",
    };
  };

  switch (id) {
    case "lifestyle":
      return ex("day_coffee");
    case "talking":
      return {
        ...ex("talking_desk"),
        reelStylePreset: "lip_sync",
        duration: 15,
      };
    case "motivational":
      return {
        videoType: "talking_head",
        sceneDescription:
          "window light on face, minimal background, phone at eye level, empowering creator setup",
        outfit: "athleisure top",
        script:
          "talking to camera with confident energy, small gestures, direct eye contact — stable framing",
        reelStylePreset: "lip_sync",
        generateSceneFrame: true,
        duration: 15,
        music: "none",
        effects: [],
        textOverlay: "",
      };
    case "ootd":
      return ex("ootd_bedroom");
    case "day_in_life":
      return ex("grwm_mirror");
    case "batch":
      return {};
    default:
      return {};
  }
}

export const PHOTO_QUICK_INTENTS: { id: PhotoQuickIntentId; emoji: string; titleKey: string; descKey: string }[] = [
  { id: "lifestyle", emoji: "✨", titleKey: "lifestyle", descKey: "lifestyleDesc" },
  { id: "ootd", emoji: "👗", titleKey: "ootd", descKey: "ootdDesc" },
  { id: "cafe", emoji: "☕", titleKey: "cafe", descKey: "cafeDesc" },
  { id: "gym", emoji: "💪", titleKey: "gym", descKey: "gymDesc" },
  { id: "product", emoji: "📦", titleKey: "product", descKey: "productDesc" },
  { id: "story", emoji: "📱", titleKey: "story", descKey: "storyDesc" },
  { id: "surprise", emoji: "🎲", titleKey: "surprise", descKey: "surpriseDesc" },
];

export const REEL_QUICK_INTENTS: { id: ReelQuickIntentId; emoji: string; titleKey: string; descKey: string }[] = [
  { id: "lifestyle", emoji: "🎬", titleKey: "lifestyle", descKey: "lifestyleDesc" },
  { id: "talking", emoji: "🎤", titleKey: "talking", descKey: "talkingDesc" },
  { id: "motivational", emoji: "🔥", titleKey: "motivational", descKey: "motivationalDesc" },
  { id: "ootd", emoji: "👠", titleKey: "ootd", descKey: "ootdDesc" },
  { id: "day_in_life", emoji: "🌅", titleKey: "day_in_life", descKey: "day_in_lifeDesc" },
  { id: "batch", emoji: "📅", titleKey: "batch", descKey: "batchDesc" },
];
