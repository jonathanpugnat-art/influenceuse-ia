/**
 * Rewrites prompts after a moderation block — keeps the creative intent but
 * uses fashion-editorial vocabulary models accept more often than raw UGC slang.
 */

const EDITORIAL_PREFIX =
  "High-end Instagram fashion creator content, tasteful editorial photography, fully clothed, " +
  "professional influencer shoot, appropriate for social media, ";

/** Strip words that often trigger Google E005 even on Kontext. */
const SOFTEN_REPLACEMENTS: [RegExp, string][] = [
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
];

export function softenPromptForEditorial(prompt: string): string {
  let p = prompt;
  for (const [re, replacement] of SOFTEN_REPLACEMENTS) {
    p = p.replace(re, replacement);
  }
  p = p.replace(/\s{2,}/g, " ").trim();
  if (p.toLowerCase().startsWith(EDITORIAL_PREFIX.toLowerCase().slice(0, 20))) {
    return p;
  }
  return `${EDITORIAL_PREFIX}${p}`;
}
