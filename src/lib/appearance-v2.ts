import { z } from "zod";

/** Extended appearance fields stored in Influencer.style JSON (v2 wizard). */
export const extendedStyleSchema = z.object({
  ethnicity: z.string().optional(),
  hairColor: z.string().optional(),
  hairStyle: z.string().optional(),
  bodyType: z.string().optional(),
  fashionStyle: z.string().optional(),
  skinTone: z.string().optional(),
  height: z.string().optional(),
  bustLevel: z.number().int().min(-3).max(3).optional(),
  hipsLevel: z.number().int().min(-3).max(3).optional(),
  shouldersLevel: z.number().int().min(-3).max(3).optional(),
  tattoos: z.array(z.string()).optional(),
  makeupLevel: z.string().optional(),
  bodyGenerationMode: z.enum(["standard", "extended"]).optional(),
  /** Free-text morphology direction ("abdos dessinés, petite poitrine, taille fine"). */
  morphologyNotes: z.string().max(400).optional(),
});

export type ExtendedInfluencerStyle = z.infer<typeof extendedStyleSchema>;

export const WIZARD_SKIN_TONES = [
  "Claire",
  "Médium claire",
  "Médium",
  "Mate",
  "Foncée",
] as const;

export const WIZARD_HEIGHTS = ["Petite", "Moyenne", "Grande"] as const;

export const WIZARD_BODY_TYPES_V2 = [
  "Fine",
  "Mince élancée",
  "Athlétique",
  "Abdos définis",
  "Moyenne",
  "Sablier",
  "Curvy",
  "Pulpeuse",
  "Plus-size",
  "Musclée",
  "Petite",
] as const;

export const WIZARD_TATTOO_OPTIONS = [
  "Aucun",
  "Bras",
  "Dos",
  "Poignet",
  "Cheville",
] as const;

export const WIZARD_MAKEUP_LEVELS = ["Naturel", "Léger", "Glam"] as const;

export const PROPORTION_LABELS = {
  bust: {
    "-3": "Plate",
    "-2": "Très discrète",
    "-1": "Discrète",
    "0": "Moyenne",
    "1": "Généreuse",
    "2": "Très généreuse",
    "3": "Pulpeuse",
  },
  hips: {
    "-3": "Très étroites",
    "-2": "Étroites",
    "-1": "Fines",
    "0": "Moyennes",
    "1": "Larges",
    "2": "Très larges",
    "3": "Pulpeuses",
  },
  shoulders: {
    "-3": "Très fines",
    "-2": "Fines",
    "-1": "Étroites",
    "0": "Moyennes",
    "1": "Larges",
    "2": "Très larges",
    "3": "Carrées",
  },
} as const;

/** Slider key type for the 7-step (-3..+3) proportion axes. */
export type ProportionLabelKey =
  | "-3"
  | "-2"
  | "-1"
  | "0"
  | "1"
  | "2"
  | "3";

export function usesExtendedBodyGeneration(style: ExtendedInfluencerStyle): boolean {
  if (style.bodyGenerationMode === "extended") return true;
  const bt = (style.bodyType ?? "").toLowerCase();
  return bt.includes("plus-size") || bt.includes("nain") || bt.includes("extreme");
}

/** Map wizard / extended style JSON to portrait generation input. */
export function toPortraitStyleInput(
  gender: "female" | "male" | "nonbinary",
  style: ExtendedInfluencerStyle
) {
  return {
    gender,
    ethnicity: style.ethnicity,
    hairColor: style.hairColor,
    hairStyle: style.hairStyle,
    bodyType: style.bodyType,
    fashionStyle: style.fashionStyle,
    skinTone: style.skinTone,
    height: style.height,
    bustLevel: style.bustLevel,
    hipsLevel: style.hipsLevel,
    shouldersLevel: style.shouldersLevel,
    tattoos: style.tattoos,
    makeupLevel: style.makeupLevel,
    bodyGenerationMode: style.bodyGenerationMode,
    morphologyNotes: style.morphologyNotes,
  };
}

export type AppearanceV2PanelFields = {
  skinTone: string;
  height: string;
  bustLevel: number;
  hipsLevel: number;
  shouldersLevel: number;
  bodyType: string;
  makeupLevel: string;
  tattoos: string[];
  bodyGenerationMode: "standard" | "extended";
  morphologyNotes: string;
};

export function defaultWizardAppearanceV2(): AppearanceV2PanelFields {
  return {
    skinTone: "Médium",
    height: "Moyenne",
    bustLevel: 0,
    hipsLevel: 0,
    shouldersLevel: 0,
    bodyType: "",
    tattoos: [],
    makeupLevel: "Naturel",
    bodyGenerationMode: "standard",
    morphologyNotes: "",
  };
}
