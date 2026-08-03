export const WIZARD_AGENT_MODEL = "claude-sonnet-4-5";

export const nicheValues = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
] as const;

export const genderValues = ["female", "male", "nonbinary"] as const;

/** Stored French values — must match wizard-step-appearance.tsx */
export const WIZARD_APPEARANCE_VALUES = {
  ethnicity: [
    "Caucasienne",
    "Afro",
    "Asiatique",
    "Latina",
    "Métisse",
    "Moyen-Orient",
    "Indienne",
    "Autre",
  ],
  hairColor: ["Noir", "Brun", "Blond", "Roux", "Rose", "Bleu", "Platine"],
  hairLength: ["Court", "Mi-long", "Long", "Très long"],
  hairTexture: ["Lisse", "Ondulé", "Bouclé", "Afro", "Tressé"],
  bodyType: ["Fine", "Athlétique", "Moyenne", "Curvy", "Plus-size", "Musclée", "Petite"],
  skinTone: ["Claire", "Médium claire", "Médium", "Mate", "Foncée"],
  height: ["Petite", "Moyenne", "Grande"],
  makeupLevel: ["Naturel", "Léger", "Glam"],
  fashionStyle: [
    "Casual",
    "Chic",
    "Sporty",
    "Glamour",
    "Streetwear",
    "Bohème",
  ],
} as const;

