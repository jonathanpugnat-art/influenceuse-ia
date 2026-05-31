/**
 * Pre-generation guard for the Premium lane — blocks explicit / illegal prompts
 * while allowing suggestive boudoir vocabulary.
 */

/** Hard-block: illegal or explicit porn (FR + EN). */
export const PREMIUM_BLOCKED_TERMS: readonly string[] = [
  "child",
  "minor",
  "underage",
  "teen",
  "loli",
  "shota",
  "mineur",
  "mineure",
  "pedo",
  "pédoph",
  "rape",
  "viol",
  "non-consent",
  "bestiality",
  "zoophil",
  "incest",
  "genital",
  "genitals",
  "penis",
  "vagina",
  "pussy",
  "cock",
  "dick",
  "cum",
  "ejacul",
  "orgasm",
  "penetration",
  "anal sex",
  "blowjob",
  "fellatio",
  "cunnilingus",
  "hardcore",
  "porn",
  "porno",
  "pornography",
  "xxx",
  "explicit sex",
  "sex act",
  "spread legs nude",
  "fully nude",
  "completely naked",
  "topless nipple",
  "visible nipples",
  "areola",
  "pubic",
  "pornstar",
];

export class PremiumPromptBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PremiumPromptBlockedError";
  }
}

function normalizeForScan(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

/** Returns matched blocked terms (empty = OK). */
export function findBlockedPremiumTerms(text: string): string[] {
  const hay = normalizeForScan(text);
  if (!hay.trim()) return [];
  return PREMIUM_BLOCKED_TERMS.filter((term) => {
    const t = normalizeForScan(term);
    if (t.includes(" ")) return hay.includes(t);
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(hay);
  });
}

export interface PremiumPromptGuardFields {
  scene?: string;
  sceneDescription?: string;
  outfit?: string;
  customPrompt?: string;
  location?: string;
}

export function assertPremiumPromptAllowed(fields: PremiumPromptGuardFields): void {
  const blob = [
    fields.scene,
    fields.sceneDescription,
    fields.outfit,
    fields.customPrompt,
    fields.location,
  ]
    .filter(Boolean)
    .join(" ");

  const hits = findBlockedPremiumTerms(blob);
  if (hits.length > 0) {
    throw new PremiumPromptBlockedError(
      "Cette description contient des termes interdits (contenu explicite ou illégal). " +
        "Reformule en mode boudoir suggestif : lingerie portée, pose sensuelle, pas de nudité explicite."
    );
  }
}

/** Strip risky tokens that sometimes slip through enrichment (soft sanitize). */
export function sanitizePremiumPromptFragment(text: string): string {
  let out = text;
  for (const term of ["nude", "naked", "topless", "explicit", "porn", "xxx"]) {
    out = out.replace(new RegExp(`\\b${term}\\b`, "gi"), "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}
