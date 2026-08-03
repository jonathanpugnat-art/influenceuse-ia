/**
 * Rewrites prompts after a moderation block — keeps the creative intent but
 * uses fashion-editorial vocabulary models accept more often than raw UGC slang.
 */

const EDITORIAL_PREFIX =
  "High-end Instagram fashion creator content, tasteful editorial photography, fully clothed, " +
  "professional influencer shoot, appropriate for social media, ";

/** Suggestive / explicit-adjacent tokens — always soften on SFW. */
const SUGGESTIVE_REPLACEMENTS: [RegExp, string][] = [
  [/\bsexy\b/gi, "stylish"],
  [/\bhot\b/gi, "confident"],
  [/\bprovocative\b/gi, "bold fashion"],
  [/\bseductive\b/gi, "confident"],
  [/\blingerie\b/gi, "lace lounge outfit"],
  [/\bboudoir\b/gi, "intimate bedroom fashion"],
  [/\bnude\b/gi, ""],
  [/\bnaked\b/gi, ""],
  [/\bexplicit\b/gi, ""],
  [/\btopless\b/gi, ""],
  [/\bcleavage\b/gi, "neckline"],
];

/**
 * Fitness outfit tokens that trigger Nano E005 — soften only when staying on Nano.
 * Kontext handles sports bra / leggings better; rewriting them before routing
 * also strips borderline keywords and wrongly keeps the job on Nano.
 */
const FITNESS_OUTFIT_REPLACEMENTS: [RegExp, string][] = [
  [/\bsports?\s*bras?\b/gi, "fitted athletic top"],
  [/\bbrassière\b/gi, "fitted athletic top"],
  [/\bleggings?\b/gi, "athletic pants"],
  [/\byoga pants?\b/gi, "athletic pants"],
  [/\btight gym\b/gi, "sporty gym"],
  [/\bgym mirror selfie\b/gi, "gym training photo"],
  [/\bmirror selfie\b/gi, "casual selfie"],
  [/\bgrwm\b/gi, "morning routine"],
  [/\bget ready with me\b/gi, "morning routine"],
  [/\bsweat glow\b/gi, "post-workout energy"],
];

const ALL_SFW_REPLACEMENTS: [RegExp, string][] = [
  ...SUGGESTIVE_REPLACEMENTS,
  ...FITNESS_OUTFIT_REPLACEMENTS,
];

function applyReplacements(
  text: string,
  replacements: [RegExp, string][]
): string {
  if (!text.trim()) return text;
  let p = text;
  for (const [re, replacement] of replacements) {
    p = p.replace(re, replacement);
  }
  return p.replace(/\s{2,}/g, " ").trim();
}

export function softenSocialFitnessLanguage(text: string): string {
  return applyReplacements(text, ALL_SFW_REPLACEMENTS);
}

/** Suggestive-only soften — keeps sports bra / leggings for Kontext fidelity. */
export function softenSuggestiveLanguage(text: string): string {
  return applyReplacements(text, SUGGESTIVE_REPLACEMENTS);
}

export function softenPromptForEditorial(prompt: string): string {
  let p = softenSocialFitnessLanguage(prompt);
  if (p.toLowerCase().startsWith(EDITORIAL_PREFIX.toLowerCase().slice(0, 20))) {
    return p;
  }
  return `${EDITORIAL_PREFIX}${p}`;
}

function mapSoftenedFields<
  T extends {
    outfit?: string;
    sceneDescription?: string;
    customPrompt?: string;
    location?: string;
  },
>(fields: T, soften: (text: string) => string): T {
  return {
    ...fields,
    outfit: fields.outfit ? soften(fields.outfit) : fields.outfit,
    sceneDescription: fields.sceneDescription
      ? soften(fields.sceneDescription)
      : fields.sceneDescription,
    customPrompt: fields.customPrompt
      ? soften(fields.customPrompt)
      : fields.customPrompt,
    location: fields.location ? soften(fields.location) : fields.location,
  };
}

function isFitnessAdjacent(fields: {
  outfit?: string;
  sceneDescription?: string;
  customPrompt?: string;
  location?: string;
}): boolean {
  const hay = [
    fields.outfit,
    fields.sceneDescription,
    fields.customPrompt,
    fields.location,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /gym|workout|running|athletic|fitness|training|sport/.test(hay);
}

/**
 * Full SFW soften for Nano — rewrites fitness outfit slang that often trips E005.
 */
export function softenSfwFitnessFields<
  T extends {
    outfit?: string;
    sceneDescription?: string;
    customPrompt?: string;
    location?: string;
    instagramShot?: boolean;
  },
>(fields: T): T {
  const softened = mapSoftenedFields(fields, softenSocialFitnessLanguage);

  // Flash + gym / athletic language is a common Flux safety fail — prefer
  // natural light editorial for fitness-adjacent SFW shots.
  if (isFitnessAdjacent(softened) && softened.instagramShot) {
    return { ...softened, instagramShot: false };
  }
  return softened;
}

/**
 * Lighter SFW soften for Kontext — keeps athletic wardrobe fidelity,
 * still strips suggestive tokens and disables flash on fitness scenes.
 */
export function softenSfwFieldsForKontext<
  T extends {
    outfit?: string;
    sceneDescription?: string;
    customPrompt?: string;
    location?: string;
    instagramShot?: boolean;
  },
>(fields: T): T {
  const softened = mapSoftenedFields(fields, softenSuggestiveLanguage);
  if (isFitnessAdjacent(fields) && softened.instagramShot) {
    return { ...softened, instagramShot: false };
  }
  return softened;
}
