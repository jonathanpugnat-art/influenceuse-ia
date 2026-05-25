/** Kokoro voice ids — keep in sync with ai-speech.service defaults. */
export const REEL_VOICE_OPTIONS = [
  { id: "ff_siwis", language: "fr" as const, labelKey: "reelVoiceSiwis" },
  { id: "ff_kore", language: "fr" as const, labelKey: "reelVoiceKore" },
  { id: "af_bella", language: "en" as const, labelKey: "reelVoiceBella" },
] as const;

export type ReelVoiceId = (typeof REEL_VOICE_OPTIONS)[number]["id"];

/**
 * Build the richest possible narration from reel fields (script first).
 */
export function buildReelNarrationText(input: {
  script?: string;
  sceneDescription?: string;
  outfit?: string;
}): string {
  const script = input.script?.trim() ?? "";
  if (script.length >= 10) return script.slice(0, 1200);

  const parts: string[] = [];
  if (script) parts.push(script);
  const scene = input.sceneDescription?.trim();
  const outfit = input.outfit?.trim();
  if (scene) parts.push(scene);
  if (outfit) parts.push(`Outfit: ${outfit}`);

  return parts.join(". ").replace(/\s+/g, " ").trim().slice(0, 1200);
}
