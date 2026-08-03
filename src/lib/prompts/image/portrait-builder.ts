import {
  APPEARANCE_MAP,
  mapAppearance,
  mapProportionLevels,
  mapTattoos,
  mapWizardHairStyle,
} from "@/lib/prompts/appearance-map";
import {
  BASE_PORTRAIT_TEMPLATE,
  genderLabel,
  pickAppearanceVariations,
  renderAppearanceVariations,
} from "./appearance-variations";
import type { AppearanceVariation, Gender } from "./types";

export function buildBasePortraitPrompt(input: {
  age: number;
  ethnicity: string;
  hairColor: string;
  hairStyle: string;
  bodyType: string;
  fashionStyle: string;
  gender?: Gender;
  skinTone?: string;
  height?: string;
  bustLevel?: number;
  hipsLevel?: number;
  shouldersLevel?: number;
  tattoos?: string[];
  makeupLevel?: string;
  /** Free-text morphology direction baked into the base portrait. */
  morphologyNotes?: string;
  variations?: AppearanceVariation;
}): string {
  const variations = input.variations ?? pickAppearanceVariations();
  const proportions = mapProportionLevels({
    bustLevel: input.bustLevel,
    hipsLevel: input.hipsLevel,
    shouldersLevel: input.shouldersLevel,
  });
  const morphologyNotes = input.morphologyNotes?.trim();
  const bodyDetail = [proportions || "balanced proportions", morphologyNotes]
    .filter(Boolean)
    .join(", ");
  const tattooText = mapTattoos(input.tattoos);
  return BASE_PORTRAIT_TEMPLATE.replace("{age}", String(input.age))
    .replace("{ethnicity}", mapAppearance(APPEARANCE_MAP.ethnicity, input.ethnicity))
    .replace("{gender}", genderLabel(input.gender ?? "female"))
    .replace(
      "{skin_tone}",
      input.skinTone
        ? mapAppearance(APPEARANCE_MAP.skinTone, input.skinTone)
        : "natural skin tone"
    )
    .replace(
      "{height}",
      input.height ? mapAppearance(APPEARANCE_MAP.height, input.height) : "average height"
    )
    .replace("{hair_color}", mapAppearance(APPEARANCE_MAP.hairColor, input.hairColor))
    .replace("{hair_style}", mapWizardHairStyle(input.hairStyle))
    .replace("{body_type}", mapAppearance(APPEARANCE_MAP.bodyType, input.bodyType))
    .replace("{proportions}", bodyDetail)
    .replace(
      "{makeup}",
      input.makeupLevel
        ? mapAppearance(APPEARANCE_MAP.makeupLevel, input.makeupLevel)
        : "minimal natural makeup"
    )
    .replace("{tattoos}", tattooText || "no visible tattoos")
    .replace(
      "{fashion_style}",
      mapAppearance(APPEARANCE_MAP.fashionStyle, input.fashionStyle)
    )
    .replace("{distinct_traits}", renderAppearanceVariations(variations));
}
