/**
 * Lexical guard for routing SFW face-locked photos away from Google Nano Banana
 * toward Flux Kontext Pro. Maintained via `scripts/bench-nano-keywords.ts`.
 */

export type ContentImageEngine = "nano" | "kontext";

/** Keywords that often trigger Nano E005 — route to Kontext before calling Replicate. */
export const BORDERLINE_KEYWORDS: readonly string[] = [
  // Beach / pool / water
  "beach",
  "plage",
  "pool",
  "piscine",
  "poolside",
  "ocean",
  "shore",
  "sand",
  "sea",
  // Swimwear / underwear / intimate
  "bikini",
  "swimsuit",
  "swimwear",
  "maillot de bain",
  "lingerie",
  "underwear",
  "bra",
  "thong",
  "panties",
  "boudoir",
  "intimate",
  // Bath / shower / GRWM
  "bathroom",
  "salle de bain",
  "bathtub",
  "shower",
  "bathrobe",
  "peignoir",
  "towel only",
  "wrapped in a towel",
  "grwm",
  "get ready",
  "vanity",
  "miroir",
  "mirror selfie",
  "trying on",
  "try on",
  "essayage",
  "lace",
  "dentelle",
  "silk robe",
  "robe de chambre",
  // Suggestive / body-forward (SFW but Nano-sensitive)
  "sarong",
  "see-through",
  "transparent",
  "wet shirt",
  "wet t-shirt",
  "cleavage",
  "low cut",
  "low-cut",
  "crop top",
  "croptop",
  "tight dress",
  "bodycon",
  "leggings",
  "yoga pants",
  "sports bra",
  "sport bra",
  "mini skirt",
  "miniskirt",
  "short skirt",
  "nightclub",
  "clubbing",
  "bedroom",
  "on bed",
  "in bed",
  "mirror selfie",
  "gym mirror",
  "locker room",
  "changing room",
  "sensual",
  "seductive",
  "sexy",
  "provocative",
  "revealing",
  "skimpy",
  "sheer",
  "lace bodysuit",
  "bodysuit",
  "swim",
  "tanning",
  "sunbathing",
];

export interface BorderlinePromptFields {
  scene?: string;
  sceneDescription?: string;
  outfit?: string;
  location?: string;
  customPrompt?: string;
  pose?: string;
  expression?: string;
}

export function buildPromptHaystack(fields: BorderlinePromptFields): string {
  return [
    fields.scene,
    fields.sceneDescription,
    fields.outfit,
    fields.location,
    fields.customPrompt,
    fields.pose,
    fields.expression,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getMatchedBorderlineKeywords(
  fields: BorderlinePromptFields
): string[] {
  const haystack = buildPromptHaystack(fields);
  return BORDERLINE_KEYWORDS.filter((kw) => haystack.includes(kw));
}

/** True when we should skip Nano and use Flux Kontext Pro upfront. */
export function shouldRouteToKontext(fields: BorderlinePromptFields): boolean {
  return getMatchedBorderlineKeywords(fields).length > 0;
}
