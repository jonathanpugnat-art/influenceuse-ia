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
    "mince élancée": "slim slender tall model build",
    athlétique: "athletic",
    "abdos définis": "athletic toned body with defined abs",
    moyenne: "average",
    sablier: "hourglass figure with a defined narrow waist",
    curvy: "curvy",
    pulpeuse: "voluptuous full-figured curvy",
    "plus-size": "plus size curvy",
    musclée: "muscular athletic",
    petite: "petite slim",
    slim: "slim",
    athletic: "athletic",
    average: "average",
    hourglass: "hourglass figure with a defined narrow waist",
    voluptuous: "voluptuous full-figured curvy",
  },
  skinTone: {
    claire: "fair light skin",
    "médium claire": "light medium skin",
    médium: "medium skin tone",
    mate: "tan olive skin",
    foncée: "deep dark skin",
    "très foncée": "very deep dark skin",
    fair: "fair light skin",
    light: "fair light skin",
    medium: "medium skin tone",
    olive: "tan olive skin",
    dark: "deep dark skin",
  },
  height: {
    petite: "petite short stature around 155cm",
    moyenne: "average height around 168cm",
    grande: "tall stature around 178cm",
    "petite short stature": "petite short stature around 155cm",
    "average height": "average height around 168cm",
    tall: "tall stature around 178cm",
  },
  makeupLevel: {
    naturel: "minimal natural makeup",
    léger: "light everyday makeup",
    glam: "glamorous makeup",
    "ultra glam": "ultra glamorous heavy makeup, bold lips, dramatic eyes",
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

type ProportionAxis = "bust" | "hips" | "shoulders";

/**
 * Graded morphology words on a -3..+3 scale (was a coarse -1/0/1). Finer
 * granularity lets the wizard express precise / atypical figures instead of
 * three buckets that all rendered roughly the same.
 */
const PROPORTION_TOKENS: Record<ProportionAxis, Record<number, string>> = {
  bust: {
    [-3]: "very small flat chest",
    [-2]: "small bust",
    [-1]: "subtle bust",
    0: "balanced bust",
    1: "full bust",
    2: "very full bust",
    3: "extra full voluptuous bust",
  },
  hips: {
    [-3]: "very narrow straight hips",
    [-2]: "narrow hips",
    [-1]: "slim hips",
    0: "balanced hips",
    1: "wide hips",
    2: "very wide curvy hips",
    3: "extra wide voluptuous hips",
  },
  shoulders: {
    [-3]: "very narrow delicate shoulders",
    [-2]: "narrow shoulders",
    [-1]: "slim shoulders",
    0: "balanced shoulders",
    1: "broad shoulders",
    2: "very broad shoulders",
    3: "extra broad athletic shoulders",
  },
};

function proportionWord(axis: ProportionAxis, level: number): string {
  const clamped = Math.max(-3, Math.min(3, Math.round(level)));
  return PROPORTION_TOKENS[axis][clamped] ?? "";
}

export function mapProportionLevels(
  input: {
    bustLevel?: number;
    hipsLevel?: number;
    shouldersLevel?: number;
  },
  options?: {
    /** Portrait keeps the neutral baseline; content prompts skip it as noise. */
    includeNeutral?: boolean;
  }
): string {
  const includeNeutral = options?.includeNeutral ?? true;
  const axes: Array<[ProportionAxis, number | undefined]> = [
    ["bust", input.bustLevel],
    ["hips", input.hipsLevel],
    ["shoulders", input.shouldersLevel],
  ];
  const parts: string[] = [];
  for (const [axis, level] of axes) {
    if (level === undefined) continue;
    if (!includeNeutral && level === 0) continue;
    parts.push(proportionWord(axis, level));
  }
  return parts.filter(Boolean).join(", ");
}

const TATTOO_MAP: Record<string, string> = {
  aucun: "",
  bras: "visible arm tattoos",
  dos: "back tattoo visible",
  poignet: "wrist tattoo",
  cheville: "ankle tattoo",
  "côte / hanche": "small tattoo on ribs or hip",
  "poignet discret": "small wrist tattoo",
  cou: "neck tattoo",
  épaule: "shoulder tattoo",
  manches: "sleeve tattoos on arms",
};

export function mapTattoos(tattoos: string[] | undefined): string {
  if (!tattoos?.length) return "";
  const tokens = tattoos
    .filter((t) => t.toLowerCase() !== "aucun")
    .map((t) => TATTOO_MAP[t.toLowerCase()] ?? t.toLowerCase())
    .filter(Boolean);
  return tokens.join(", ");
}

const PIERCING_MAP: Record<string, string> = {
  nez: "nose ring",
  nombril: "belly button piercing",
  arcade: "eyebrow piercing",
  langue: "tongue piercing",
};

export function mapPiercings(piercings: string[] | undefined): string {
  if (!piercings?.length) return "";
  return piercings
    .map((p) => PIERCING_MAP[p.toLowerCase()] ?? p.toLowerCase())
    .filter(Boolean)
    .join(", ");
}
