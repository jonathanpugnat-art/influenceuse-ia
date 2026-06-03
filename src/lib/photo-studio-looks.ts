import type { PhotoParams } from "@/hooks/use-photo-creator";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";
import { pickDefaultPoseForScene } from "@/lib/photo-scene-pose";
import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import { CONTENT_TEMPLATES } from "@/lib/templates/content-templates";

/** Extra outfit chips per look (default outfit comes from the template). */
const LOOK_OUTFIT_ALTERNATIVES: Record<
  string,
  { female: string[]; male: string[]; nonbinary?: string[] }
> = {
  "mirror-selfie-gym": {
    female: ["legging noir et brassière sport", "ensemble yoga gris", "short cycliste et crop top"],
    male: ["short de sport et débardeur", "jogging tech et hoodie", "legging compression et tank top"],
  },
  "cafe-aesthetic": {
    female: ["pull oversized beige et jean", "robe midi casual", "blazer oversize et baskets"],
    male: ["hoodie et jean casual", "chemise ouverte et chino", "sweat à capuche minimal"],
  },
  "beach-vibes": {
    female: ["robe de plage fluide", "bikini une pièce noir", "short lin et crop top blanc"],
    male: ["short de bain et t-shirt blanc", "boardshort et débardeur", "chemise lin ouverte"],
  },
  "airport-ootd": {
    female: ["ensemble confort beige et baskets", "sweat crop et jogging matching", "trench léger et jean"],
    male: ["jogging tech et hoodie", "survêtement gris et sneakers", "cargo et veste bomber"],
  },
  "rooftop-sunset": {
    female: ["robe de soirée chic", "top satin et pantalon tailleur", "mini robe noire"],
    male: ["chemise ouverte et pantalon habillé", "polo et chino", "blazer sans cravate"],
  },
  "restaurant-chic": {
    female: ["petite robe noire élégante", "top bustier et jupe midi", "ensemble satin bordeaux"],
    male: ["chemise sombre et blazer", "polo noir et pantalon", "costume décontracté"],
  },
  "morning-routine": {
    female: ["pyjama en soie", "t-shirt oversize et short", "body et cardigan"],
    male: ["t-shirt blanc et short de pyjama", "boxer et t-shirt loose", "peignoir léger"],
  },
  "street-style": {
    female: ["trench coat et bottes", "blazer oversize et jean mom", "crop top et pantalon cargo"],
    male: ["bomber et jean slim", "parka et sneakers", "hoodie under vest"],
  },
  "paris-landmark": {
    female: ["robe parisienne chic", "blazer et jean taille haute", "ensemble tweed"],
    male: ["blazer marine et jean", "manteau camel et écharpe", "chemise blanche et pantalon"],
  },
};

export type PhotoStudioLook = {
  id: string;
  templateId: string;
  emoji: string;
  nameFr: string;
  nameEn: string;
  /** Optional showcase image under /public/landing/showcase */
  previewSrc?: string;
};

export const PHOTO_STUDIO_LOOKS: PhotoStudioLook[] = CONTENT_TEMPLATES.map((tpl) => ({
  id: tpl.id,
  templateId: tpl.id,
  emoji: tpl.emoji,
  nameFr: tpl.name,
  nameEn: tpl.nameEn,
  previewSrc: lookPreviewForTemplate(tpl.id),
}));

function lookPreviewForTemplate(id: string): string | undefined {
  const map: Record<string, string> = {
    "mirror-selfie-gym": "/landing/showcase/luna-gym.jpg",
    "cafe-aesthetic": "/landing/showcase/luna-cafe.jpg",
    "beach-vibes": "/landing/showcase/marco-park.jpg",
    "restaurant-chic": "/landing/showcase/amani-restaurant.jpg",
    "street-style": "/landing/showcase/kenji-street1.jpg",
    "paris-landmark": "/landing/showcase/kenji-tokyo.jpg",
    "morning-routine": "/landing/showcase/luna-mirror.jpg",
    "airport-ootd": "/landing/showcase/marco-nyc.jpg",
  };
  return map[id];
}

export function getStudioLook(id: string | null | undefined): PhotoStudioLook | undefined {
  if (!id) return undefined;
  return PHOTO_STUDIO_LOOKS.find((l) => l.id === id);
}

export function getOutfitOptionsForLook(
  lookId: string,
  gender: InfluencerGender
): string[] {
  const tpl = CONTENT_TEMPLATES.find((t) => t.id === lookId);
  if (!tpl) return [];

  const defaultOutfit =
    gender === "male"
      ? tpl.params.outfitMale
      : gender === "nonbinary"
        ? tpl.params.outfitFemale
        : tpl.params.outfitFemale;

  const alts = LOOK_OUTFIT_ALTERNATIVES[lookId];
  const genderAlts =
    gender === "male"
      ? alts?.male
      : gender === "nonbinary"
        ? alts?.nonbinary ?? alts?.female
        : alts?.female;

  const merged = [defaultOutfit, ...(genderAlts ?? [])];
  return [...new Set(merged.map((s) => s.trim()).filter(Boolean))];
}

/** Build full scene description: English base + optional user detail (FR ok → enriched server-side). */
export function buildLookSceneDescription(
  lookId: string,
  sceneDetail?: string
): string {
  const tpl = CONTENT_TEMPLATES.find((t) => t.id === lookId);
  const base = tpl
    ? getSceneInspirationText(tpl.params.scene) ||
      tpl.descriptionEn ||
      tpl.description
    : "";
  const detail = sceneDetail?.trim();
  if (!detail) return base;
  return `${base}. ${detail}`.trim();
}

/** Apply a studio look — fills scene, pose, outfit, lighting, enables Instagram Shot lane. */
export function applyStudioLook(
  lookId: string,
  gender: InfluencerGender,
  sceneDetail?: string
): Partial<PhotoParams> {
  const tpl = CONTENT_TEMPLATES.find((t) => t.id === lookId);
  if (!tpl) return {};

  const outfit =
    gender === "male" ? tpl.params.outfitMale : tpl.params.outfitFemale;
  const sceneDescription = buildLookSceneDescription(lookId, sceneDetail);
  const pose = pickDefaultPoseForScene(
    { scene: tpl.params.scene, sceneDescription },
    tpl.params.pose
  );

  return {
    lookId,
    instagramShot: true,
    scene: tpl.params.scene,
    sceneDescription,
    pose,
    expression: tpl.params.expression,
    photoStyle: tpl.params.photoStyle,
    timeOfDay: tpl.params.timeOfDay,
    outfit,
    location: tpl.params.location ?? "",
    sceneFirst: false,
  };
}
