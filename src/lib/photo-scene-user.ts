/** Minimum length for a user-written scene (after trimming). */
export const MIN_USER_SCENE_LENGTH = 8;

const PROPS_SUFFIX_RE = /\s*\[Props:.*?\]\s*$/i;

const FRENCH_OR_NON_ENGLISH_HINT =
  /[àâäéèêëïîôùûüç]|(?:\b(?:le|la|les|un|une|des|du|de|d'|à|au|aux|avec|dans|sur|pour|chez|plage|soir|matin|café|chambre|terrasse|lumière|coucher|soleil|robe|tenue|miroir|restaurant|plage)\b)/i;

export function stripScenePropsSuffix(text: string): string {
  return text.replace(PROPS_SUFFIX_RE, "").trim();
}

export function extractScenePropsSuffix(text: string): string {
  const match = text.match(PROPS_SUFFIX_RE);
  return match?.[0]?.trim() ?? "";
}

export function hasUserSceneDescription(sceneDescription?: string | null): boolean {
  return stripScenePropsSuffix(sceneDescription ?? "").length >= MIN_USER_SCENE_LENGTH;
}

export function looksNonEnglish(text: string): boolean {
  return FRENCH_OR_NON_ENGLISH_HINT.test(text.trim());
}

/** Whether we should run LLM enrichment before image generation. */
export function shouldEnrichForImagePrompt(
  sceneDescription: string,
  outfit?: string
): boolean {
  const scene = stripScenePropsSuffix(sceneDescription);
  if (looksNonEnglish(scene)) return true;
  if (scene.length < 40) return true;
  const outfitTrim = outfit?.trim();
  if (outfitTrim && looksNonEnglish(outfitTrim)) return true;
  return false;
}
