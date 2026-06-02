/** Soften a Premium prompt after moderation rejection — keep boudoir, drop explicit drift. */

const PREMIUM_SOFT_PREFIX =
  "Tasteful OnlyFans boudoir photo, lingerie fully worn, seductive but not nude, not explicit, " +
  "professional intimate photography, ";

export function softenPremiumPrompt(prompt: string): string {
  const p = prompt
    .replace(/\bnude\b/gi, "")
    .replace(/\bnaked\b/gi, "")
    .replace(/\btopless\b/gi, "")
    .replace(/\bexplicit\b/gi, "")
    .replace(/\bporn\w*\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (p.toLowerCase().includes("lingerie fully worn")) {
    return p;
  }
  return `${PREMIUM_SOFT_PREFIX}${p}`;
}
