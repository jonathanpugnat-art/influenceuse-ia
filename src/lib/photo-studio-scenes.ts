import type { PhotoParams } from "@/hooks/use-photo-creator";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";
import {
  applyPhotoQuickIntent,
  type PhotoQuickIntentId,
} from "@/lib/content-quick-intents";
import { pickDefaultPoseForScene } from "@/lib/photo-scene-pose";
import { getSceneInspirationText } from "@/lib/prompts/image-prompts";
import { CONTENT_TEMPLATES } from "@/lib/templates/content-templates";

/** Lieux choisisables en 1 clic (studio simple). */
export const PHOTO_STUDIO_LOCATIONS = [
  { id: "beach", emoji: "🏖️", labelKey: "sceneBeach" },
  { id: "cafe", emoji: "☕", labelKey: "sceneCafe" },
  { id: "urban", emoji: "🏙️", labelKey: "sceneUrban" },
  { id: "studio", emoji: "📷", labelKey: "sceneStudio" },
  { id: "bedroom", emoji: "🛏️", labelKey: "sceneBedroom" },
  { id: "restaurant", emoji: "🍽️", labelKey: "sceneRestaurant" },
  { id: "gym", emoji: "💪", labelKey: "sceneGym" },
  { id: "nature", emoji: "🌿", labelKey: "sceneNature" },
] as const;

export type PhotoStudioLocationId = (typeof PHOTO_STUDIO_LOCATIONS)[number]["id"];

/** Recettes 1-clic : scène + pose + tenue suggérée. */
export const PHOTO_STUDIO_RECIPES = [
  {
    id: "cafe_morning",
    emoji: "☕",
    labelKey: "studioRecipeCafe",
    intent: "cafe" as PhotoQuickIntentId,
  },
  {
    id: "ootd_street",
    emoji: "👗",
    labelKey: "studioRecipeOotd",
    intent: "ootd" as PhotoQuickIntentId,
  },
  {
    id: "beach_day",
    emoji: "🏖️",
    labelKey: "studioRecipeBeach",
    templateId: "beach-vibes",
  },
  {
    id: "evening_out",
    emoji: "🌆",
    labelKey: "studioRecipeEvening",
    templateId: "rooftop-sunset",
  },
] as const;

export type PhotoStudioRecipeId = (typeof PHOTO_STUDIO_RECIPES)[number]["id"];

export function applyStudioLocation(
  locationId: PhotoStudioLocationId,
  currentPose?: string
): Partial<PhotoParams> {
  const sceneDescription = getSceneInspirationText(locationId);
  return {
    scene: locationId,
    sceneDescription,
    pose: pickDefaultPoseForScene(
      { scene: locationId, sceneDescription },
      currentPose ?? "portrait"
    ),
  };
}

export function applyStudioRecipe(
  recipeId: PhotoStudioRecipeId,
  gender: InfluencerGender,
  niche?: string
): Partial<PhotoParams> {
  const recipe = PHOTO_STUDIO_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return {};

  if ("intent" in recipe && recipe.intent) {
    return applyPhotoQuickIntent(recipe.intent, gender, niche);
  }

  if ("templateId" in recipe && recipe.templateId) {
    const tpl = CONTENT_TEMPLATES.find((t) => t.id === recipe.templateId);
    if (!tpl) return {};
    const outfit =
      gender === "male" ? tpl.params.outfitMale : tpl.params.outfitFemale;
    const sceneDescription = getSceneInspirationText(tpl.params.scene);
    return {
      scene: tpl.params.scene,
      sceneDescription,
      pose: pickDefaultPoseForScene(
        { scene: tpl.params.scene, sceneDescription },
        tpl.params.pose
      ),
      expression: tpl.params.expression,
      photoStyle: tpl.params.photoStyle,
      timeOfDay: tpl.params.timeOfDay,
      outfit,
      location: tpl.params.location ?? "",
    };
  }

  return {};
}

export function isStudioLocationSelected(
  locationId: PhotoStudioLocationId,
  params: Pick<PhotoParams, "scene" | "sceneDescription">
): boolean {
  if (params.scene !== locationId) return false;
  const canonical = getSceneInspirationText(locationId);
  return params.sceneDescription.trim() === canonical.trim();
}

/** Libellé court pour le récap (sans i18n — fallback description). */
export function studioSceneRecapText(
  params: Pick<PhotoParams, "scene" | "sceneDescription">,
  sceneLabel: (sceneId: string) => string
): string {
  const propsStripped = params.sceneDescription
    .replace(/\s*\[Props:.*?\]\s*$/i, "")
    .trim();

  const loc = PHOTO_STUDIO_LOCATIONS.find((l) => l.id === params.scene);
  if (loc && isStudioLocationSelected(loc.id, params)) {
    return sceneLabel(loc.id);
  }

  if (propsStripped) {
    return propsStripped.length > 90
      ? `${propsStripped.slice(0, 87)}…`
      : propsStripped;
  }

  if (params.scene && params.scene !== "custom") {
    return sceneLabel(params.scene);
  }

  return "";
}
