export const APPEARANCE_MAP = {
  ethnicity: {
    caucasienne: "caucasian",
    afro: "black",
    asiatique: "east asian",
    latina: "latina",
    métisse: "mixed race",
    "moyen-orient": "middle eastern",
    indienne: "south asian",
    autre: "mixed ethnicity",
    caucasian: "caucasian",
    black: "black",
    "east asian": "east asian",
    "mixed race": "mixed race",
    "middle eastern": "middle eastern",
    "south asian": "south asian",
  },
  hairColor: {
    noir: "black",
    brun: "dark brown",
    blond: "blonde",
    roux: "auburn red",
    rose: "pastel pink",
    bleu: "electric blue",
    platine: "platinum blonde",
    black: "black",
    brown: "dark brown",
    blonde: "blonde",
    auburn: "auburn red",
    pink: "pastel pink",
    blue: "electric blue",
    platinum: "platinum blonde",
  },
  hairLength: {
    court: "short",
    "mi-long": "shoulder length",
    long: "long",
    "très long": "very long",
    short: "short",
    medium: "shoulder length",
  },
  hairTexture: {
    lisse: "straight",
    ondulé: "wavy",
    bouclé: "curly",
    afro: "natural afro",
    tressé: "braided",
    straight: "straight",
    wavy: "wavy",
    curly: "curly",
  },
  bodyType: {
    fine: "slim",
    athlétique: "athletic",
    moyenne: "average",
    curvy: "curvy",
    "plus-size": "plus size curvy",
    musclée: "muscular athletic",
    petite: "petite slim",
    slim: "slim",
    athletic: "athletic",
    average: "average",
  },
  skinTone: {
    claire: "fair light skin",
    "médium claire": "light medium skin",
    médium: "medium skin tone",
    mate: "tan olive skin",
    foncée: "deep dark skin",
  },
  height: {
    petite: "petite short stature around 155cm",
    moyenne: "average height around 168cm",
    grande: "tall stature around 178cm",
  },
  makeupLevel: {
    naturel: "minimal natural makeup",
    léger: "light everyday makeup",
    glam: "glamorous makeup",
  },
  fashionStyle: {
    casual: "casual",
    chic: "chic elegant",
    sporty: "sporty",
    glamour: "glamorous",
    streetwear: "streetwear",
    bohème: "bohemian",
    glamorous: "glamorous",
    bohemian: "bohemian",
  },
} as const;

export function mapAppearance(
  map: Record<string, string>,
  value: string
): string {
  if (!value) return value;
  return map[value.toLowerCase()] ?? value.toLowerCase();
}

/** Maps wizard hairStyle ("Mi-long, Ondulé") to EN length + texture tokens. */
export function mapWizardHairStyle(hairStyle: string): string {
  if (!hairStyle.trim()) return "long straight";
  const [lengthPart, texturePart] = hairStyle.split(",").map((s) => s.trim());
  const lengthEn = mapAppearance(APPEARANCE_MAP.hairLength, lengthPart ?? "");
  const textureEn = texturePart
    ? mapAppearance(APPEARANCE_MAP.hairTexture, texturePart)
    : "";
  return [lengthEn, textureEn].filter(Boolean).join(" ");
}

const PROPORTION_TOKENS: Record<string, Record<number, string>> = {
  bust: { [-1]: "subtle bust", 0: "balanced bust", 1: "full bust" },
  hips: { [-1]: "narrow hips", 0: "balanced hips", 1: "wide hips" },
  shoulders: { [-1]: "narrow shoulders", 0: "balanced shoulders", 1: "broad shoulders" },
};

export function mapProportionLevels(input: {
  bustLevel?: number;
  hipsLevel?: number;
  shouldersLevel?: number;
}): string {
  const parts: string[] = [];
  if (input.bustLevel !== undefined) {
    parts.push(PROPORTION_TOKENS.bust[input.bustLevel] ?? "");
  }
  if (input.hipsLevel !== undefined) {
    parts.push(PROPORTION_TOKENS.hips[input.hipsLevel] ?? "");
  }
  if (input.shouldersLevel !== undefined) {
    parts.push(PROPORTION_TOKENS.shoulders[input.shouldersLevel] ?? "");
  }
  return parts.filter(Boolean).join(", ");
}

const TATTOO_MAP: Record<string, string> = {
  aucun: "",
  bras: "visible arm tattoos",
  dos: "back tattoo visible",
  poignet: "wrist tattoo",
  cheville: "ankle tattoo",
};

export function mapTattoos(tattoos: string[] | undefined): string {
  if (!tattoos?.length) return "";
  const tokens = tattoos
    .filter((t) => t.toLowerCase() !== "aucun")
    .map((t) => TATTOO_MAP[t.toLowerCase()] ?? t.toLowerCase())
    .filter(Boolean);
  return tokens.join(", ");
}
