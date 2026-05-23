import { getSceneInspirationText } from "@/lib/prompts/image-prompts";

/** Outfit chips per niche + gender (photo creator). */
type NicheSuggestionsByGender = {
  female: string[];
  male: string[];
  nonbinary: string[];
};

export const NICHE_OUTFIT_SUGGESTIONS: Record<string, NicheSuggestionsByGender> = {
  FITNESS: {
    female: ["Legging + brassière", "Tenue yoga", "Bikini sportif"],
    male: ["Short de sport + débardeur", "Tenue musculation", "Jogging technique"],
    nonbinary: ["Short de sport + t-shirt", "Tenue yoga unisexe", "Jogging décontracté"],
  },
  FASHION: {
    female: ["Robe noire élégante", "Tailleur oversize", "Robe de soirée"],
    male: ["Costume bien coupé", "Tailleur oversize", "Chemise + jean élégant"],
    nonbinary: ["Tailleur oversize", "Ensemble androgyne", "Chemise fluide + pantalon"],
  },
  TRAVEL: {
    female: ["Robe bohème", "Short + top léger", "Tenue safari"],
    male: ["Chemise légère + chino", "Short + t-shirt", "Tenue safari casual"],
    nonbinary: ["Short + top léger", "Tenue safari unisexe", "Jean + chemise légère"],
  },
  FOOD: {
    female: ["Tablier chef", "Tenue casual chic", "Robe cuisine"],
    male: ["Tablier chef", "Jean + t-shirt", "Tenue casual brasserie"],
    nonbinary: ["Tablier chef", "Tenue casual chic", "Jean + chemise décontractée"],
  },
  LIFESTYLE: {
    female: ["Pyjama soie", "Tenue loungewear", "Jean + blazer"],
    male: ["Jogging premium", "Tenue loungewear homme", "Jean + veste casual"],
    nonbinary: ["Tenue loungewear", "Jogging confortable", "Jean + blazer décontracté"],
  },
  GAMING: {
    female: ["Hoodie gaming", "T-shirt geek", "Cosplay"],
    male: ["Hoodie gaming", "T-shirt geek", "Cosplay"],
    nonbinary: ["Hoodie gaming", "T-shirt geek", "Cosplay"],
  },
  TECH: {
    female: ["Tenue corporate", "Smart casual", "Streetwear tech"],
    male: ["Tenue corporate", "Smart casual homme", "Streetwear tech"],
    nonbinary: ["Tenue corporate", "Smart casual", "Streetwear tech"],
  },
  ADULT: {
    female: ["Lingerie dentelle", "Bikini", "Robe transparente"],
    male: ["Boxer premium", "Torse nu + jean", "Peignoir ouvert"],
    nonbinary: ["Lingerie unisexe", "Torse nu + short", "Vêtement suggestif"],
  },
};

const SCENE_BY_NICHE: Record<string, string> = {
  FITNESS: "gym",
  FASHION: "urban",
  TRAVEL: "cafe",
  FOOD: "restaurant",
  LIFESTYLE: "bedroom",
  GAMING: "bedroom",
  TECH: "cafe",
  ADULT: "bedroom",
};

export type InfluencerGender = "female" | "male" | "nonbinary";

/** Smart defaults when landing from the wizard with a fresh influencer. */
export function getNichePhotoDefaults(
  niche: string,
  gender: InfluencerGender = "female"
) {
  const outfits = NICHE_OUTFIT_SUGGESTIONS[niche]?.[gender];
  const scene = SCENE_BY_NICHE[niche] ?? "cafe";
  return {
    scene,
    sceneDescription: getSceneInspirationText(scene),
    pose: "selfie",
    expression: "natural",
    photoStyle: "natural",
    timeOfDay: "natural",
    outfit: outfits?.[0] ?? "",
    useFaceReference: true,
  };
}

export function getOutfitSuggestionsForNiche(
  niche: string,
  gender: InfluencerGender
): string[] {
  return NICHE_OUTFIT_SUGGESTIONS[niche]?.[gender] ?? [];
}
