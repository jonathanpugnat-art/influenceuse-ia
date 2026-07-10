import type { PremiumNsfwLevel } from "@/lib/premium-content";
import type { PromptBuildInput } from "@/lib/prompts/image-prompts";

/**
 * Compact Flux/PuLID prompt for premium face-lock tiers (suggestive/soft/explicit).
 *
 * Hard-won ordering rules (validated across seeds on flux-pulid):
 *  - The CLOTHING instruction must come FIRST, right after framing. When a long
 *    "suggestive/sensual" scene paragraph precedes it, Flux drops the lingerie
 *    and produces nudity even with NOT nude in the prompt + negative.
 *  - The framing instruction is repeated at the END (Flux weights both ends).
 *  - We own the lighting; the enriched scene's own lighting words ("dim",
 *    "shadows", ...) are stripped so they can't darken/contradict the shot.
 *  - The scene is reduced to a single short, sanitized clause so it can't
 *    dominate the composition.
 */

const SCENE_BANNED_WORDS =
  /\b(lighting|light|lights|dim|dark|darker|shadow|shadows|bright|exposure|exposed|nude|naked|topless|backlit|sunbeam|sunlight)\b/i;

/** Keep a single short clause, dropping lighting/nudity wording we control ourselves. */
function compactScene(raw: string): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  const firstSentence = oneLine.split(/(?<=[.!?])\s/)[0] ?? oneLine;
  const keptClauses = firstSentence
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !SCENE_BANNED_WORDS.test(c));
  return keptClauses.join(", ").slice(0, 120).trim();
}

function clothingBlock(input: PromptBuildInput, tier: PremiumNsfwLevel): string {
  const outfit = input.outfit?.trim();
  if (tier === "explicit") {
    return "intimate explicit adult content";
  }
  if (tier === "soft") {
    if (outfit) {
      return `fully clothed in ${outfit}, ${outfit} clearly visible, breasts fully covered, NOT nude, NOT topless`;
    }
    return "fully clothed in a lace lingerie bra covering the breasts AND matching lace panties, full lingerie set worn, breasts fully covered by the bra, NOT nude, NOT topless";
  }
  const top = outfit
    ? `fully clothed in ${outfit} covering the breasts`
    : "fully clothed in a bra or crop top covering the breasts";
  return `${top}, breasts fully covered, NOT nude, NOT topless`;
}

export function buildPremiumFaceLockPrompt(
  input: PromptBuildInput,
  tier: PremiumNsfwLevel
): string {
  const outfit = input.outfit?.trim();
  const parts: string[] = [
    "half body shot, waist-up framing, full upper body and torso visible in frame,",
    // Clothing FIRST — must precede any sensual/suggestive scene wording.
    clothingBlock(input, tier) + ",",
    "natural candid smartphone mirror selfie, full body in mirror,",
    "soft even ambient indoor light, evenly lit, well exposed,",
    "no harsh flash, no sunbeam, no light stripe, no hard shadow line,",
    "analog film photo, subtle film grain,",
    "natural matte skin texture with visible pores, slight skin imperfections and fine lines,",
    "not retouched, not airbrushed, same exact person as the reference face photo,",
    "same body shape, proportions and curves as the reference,",
  ];

  const rawScene =
    input.sceneDescription?.trim() ||
    input.customPrompt?.trim() ||
    input.scene?.trim();
  const scene = rawScene ? compactScene(rawScene) : "";
  if (scene) parts.push(scene + ",");

  if (tier !== "explicit") parts.push("sensual soft boudoir mood,");

  if (tier !== "explicit") {
    parts.push("waist-up half body composition, NOT a face close-up,");
    if (outfit) {
      parts.push(`still wearing ${outfit}`);
    } else {
      parts.push("still wearing the full lingerie set");
    }
  }

  return parts.join(" ");
}
