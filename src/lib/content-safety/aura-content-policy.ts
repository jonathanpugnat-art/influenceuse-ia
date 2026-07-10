/**
 * Aura content policy — our own safety layer (replaces provider refusals for legal bounds).
 * Hard blocks: illegal / minors / non-consent — always enforced.
 * Soft blocks: optional explicit porn vocabulary on image prompts (tiered by nsfwLevel).
 */

/** Always blocked — every lane, every provider. */
export const AURA_HARD_BLOCKED_TERMS: readonly string[] = [
  "child",
  "children",
  "minor",
  "minors",
  "underage",
  "teen",
  "teenager",
  "loli",
  "shota",
  "mineur",
  "mineure",
  "adolescent",
  "pedo",
  "pédoph",
  "pedoph",
  "rape",
  "raped",
  "viol",
  "non-consent",
  "nonconsent",
  "without consent",
  "bestiality",
  "zoophil",
  "incest",
  "inceste",
];

/** Blocked on suggestive/soft image prompts — not on adult text agents. */
export const AURA_SOFT_BLOCKED_IMAGE_TERMS: readonly string[] = [
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

export type AuraContentLane = "sfw" | "adult";
export type AuraNsfwTier = "suggestive" | "soft" | "explicit";

export class AuraContentPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuraContentPolicyError";
  }
}

function normalizeForScan(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function findTerms(text: string, terms: readonly string[]): string[] {
  const hay = normalizeForScan(text);
  if (!hay.trim()) return [];
  return terms.filter((term) => {
    const t = normalizeForScan(term);
    if (t.includes(" ")) return hay.includes(t);
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(hay);
  });
}

/** Scan user/agent text before LLM calls. Adult lane allows OF/boudoir vocabulary. */
export function assertAuraTextAllowed(
  text: string,
  opts: { lane: AuraContentLane }
): void {
  const hard = findTerms(text, AURA_HARD_BLOCKED_TERMS);
  if (hard.length > 0) {
    throw new AuraContentPolicyError(
      "Contenu interdit : mineurs, non-consentement ou termes illégaux détectés."
    );
  }

  if (opts.lane === "sfw") {
    const soft = findTerms(text, AURA_SOFT_BLOCKED_IMAGE_TERMS);
    if (soft.length > 0) {
      throw new AuraContentPolicyError(
        "Ce texte contient du vocabulaire explicite. Passe en mode Premium/NSFW pour cette influenceuse."
      );
    }
  }
}

/** Pre-generation guard for Premium image prompts — tiered by nsfwLevel. */
export function assertAuraImagePromptAllowed(
  fields: {
    scene?: string;
    sceneDescription?: string;
    outfit?: string;
    customPrompt?: string;
    location?: string;
  },
  nsfwLevel: AuraNsfwTier = "suggestive"
): void {
  const blob = [
    fields.scene,
    fields.sceneDescription,
    fields.outfit,
    fields.customPrompt,
    fields.location,
  ]
    .filter(Boolean)
    .join(" ");

  assertAuraTextAllowed(blob, { lane: "adult" });

  if (nsfwLevel === "explicit") {
    return;
  }

  const soft = findTerms(blob, AURA_SOFT_BLOCKED_IMAGE_TERMS);
  if (soft.length > 0) {
    throw new AuraContentPolicyError(
      nsfwLevel === "soft"
        ? "Terme trop explicite pour le niveau Soft. Passe en Explicite ou reformule (lingerie portée, boudoir suggestif)."
        : "Cette description contient des termes interdits au niveau Suggestif. Monte le niveau NSFW ou reformule."
    );
  }
}

/** Claude/Anthropic refusal heuristics — trigger uncensored fallback. */
export function looksLikeProviderRefusal(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("i can't help") ||
    lower.includes("i cannot help") ||
    lower.includes("i'm unable to") ||
    lower.includes("i am unable to") ||
    lower.includes("against my guidelines") ||
    lower.includes("content policy") ||
    lower.includes("je ne peux pas") ||
    lower.includes("impossible de répondre") ||
    lower.includes("contenu inapproprié")
  );
}
