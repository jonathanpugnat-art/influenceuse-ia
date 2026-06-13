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
  bustLevel: z.number().int().min(-1).max(1).optional(),
  hipsLevel: z.number().int().min(-1).max(1).optional(),
  shouldersLevel: z.number().int().min(-1).max(1).optional(),
  tattoos: z.array(z.string()).optional(),
  makeupLevel: z.string().optional(),
  bodyGenerationMode: z.enum(["standard", "extended"]).optional(),
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
  "Athlétique",
  "Moyenne",
  "Curvy",
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
  bust: { "-1": "Discrète", "0": "Moyenne", "1": "Généreuse" },
  hips: { "-1": "Étroites", "0": "Moyennes", "1": "Larges" },
  shoulders: { "-1": "Fines", "0": "Moyennes", "1": "Larges" },
} as const;

export function usesExtendedBodyGeneration(style: ExtendedInfluencerStyle): boolean {
  if (style.bodyGenerationMode === "extended") return true;
  const bt = (style.bodyType ?? "").toLowerCase();
  return bt.includes("plus-size") || bt.includes("nain") || bt.includes("extreme");
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
  };
}
