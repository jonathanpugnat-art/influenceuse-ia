import type { PhotoParams } from "@/hooks/use-photo-creator";
import { userRequestedSelfie } from "@/lib/photo-scene-inference";

export type LockedPhotoField =
  | "sceneDescription"
  | "outfit"
  | "pose"
  | "expression";

/** Pull clothing the user actually wrote — do not replace with look presets. */
export function extractOutfitFromUserPrompt(prompt: string): string | undefined {
  const trimmed = prompt.trim();
  if (!trimmed) return undefined;

  const stripTail = (value: string) =>
    value.replace(/\s+ou\s+on\s+.*/i, "").trim();

  const explicitOutfit = trimmed.match(
    /\b(?:outfit|tenue)\s+(.+?)(?:\s*,|\s*;|\s*\.|$)/i
  )?.[1];
  if (explicitOutfit) {
    const cleaned = stripTail(explicitOutfit.trim());
    if (cleaned.length >= 4) return cleaned;
  }

  const avecOutfit = trimmed.match(
    /\bavec\s+(?:un(?:e)?\s+)?(?:outfit\s+)?(.+?)(?:\s*,|\s*;|\s*\.|$)/i
  )?.[1];
  if (avecOutfit) {
    const cleaned = stripTail(avecOutfit.trim());
    if (cleaned.length >= 4) return cleaned;
  }

  const clothingPhrase = trimmed.match(
    /\b(brassière[^,.]*|sports bra[^,.]*|legging[^,.]*|crop top[^,.]*|bikini[^,.]*|lingerie[^,.]*|body\s[^,.]*|ensemble\s+[^,.]*|pull[^,.]*|jean[^,.]*|short[^,.]*)/i
  )?.[0];
  return clothingPhrase && clothingPhrase.trim().length >= 4
    ? clothingPhrase.trim()
    : undefined;
}

export interface ResolvedPhotoUserIntent {
  /** Trimmed user prompt — canonical scene text. */
  sceneDescription: string;
  outfit?: string;
  /** Fields that must not be replaced by look presets or LLM rewrites. */
  locked: LockedPhotoField[];
}

/** Detect explicit user outfit / scene signals from free text. */
export function resolvePhotoUserIntent(prompt: string): ResolvedPhotoUserIntent {
  const sceneDescription = prompt.trim();
  const locked: LockedPhotoField[] = [];

  if (sceneDescription) {
    locked.push("sceneDescription");
  }

  const outfit = extractOutfitFromUserPrompt(sceneDescription);
  if (outfit) {
    locked.push("outfit");
  }

  if (userRequestedSelfie(sceneDescription)) {
    locked.push("pose");
  }

  return {
    sceneDescription,
    outfit,
    locked,
  };
}

export function isPhotoFieldLocked(
  intent: ResolvedPhotoUserIntent,
  field: LockedPhotoField
): boolean {
  return intent.locked.includes(field);
}

/**
 * Merge look defaults with explicit user intent.
 * Locked fields always win over look presets.
 */
export function mergePhotoParamsWithUserIntent(
  lookDefaults: Partial<PhotoParams>,
  intent: ResolvedPhotoUserIntent,
  overrides: Partial<PhotoParams>
): Partial<PhotoParams> {
  const merged: Partial<PhotoParams> = {
    ...lookDefaults,
    ...overrides,
  };

  if (intent.sceneDescription) {
    merged.sceneDescription = intent.sceneDescription;
    merged.sceneDetail = intent.sceneDescription;
    merged.scene = "custom";
  }

  if (isPhotoFieldLocked(intent, "outfit") && intent.outfit) {
    merged.outfit = intent.outfit;
  }

  if (isPhotoFieldLocked(intent, "pose") && overrides.pose) {
    merged.pose = overrides.pose;
  }

  if (isPhotoFieldLocked(intent, "expression") && overrides.expression) {
    merged.expression = overrides.expression;
  }

  return merged;
}
