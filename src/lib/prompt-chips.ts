/** Clickable chips that append English scene/motion snippets (model-friendly). */

export type PromptChip = {
  id: string;
  /** i18n key under content.promptChips.<id> */
  labelKey: string;
  snippet: string;
};

export const PHOTO_PROMPT_CHIPS: PromptChip[] = [
  { id: "golden_hour", labelKey: "golden_hour", snippet: "golden hour soft sunlight" },
  { id: "mirror_selfie", labelKey: "mirror_selfie", snippet: "mirror selfie, phone in hand, authentic apartment" },
  { id: "paris_cafe", labelKey: "paris_cafe", snippet: "Paris café terrace, morning light, casual streetwear" },
  { id: "editorial", labelKey: "editorial", snippet: "editorial fashion lighting, clean background" },
  { id: "street_style", labelKey: "street_style", snippet: "urban street style, natural candid energy" },
  { id: "cozy_indoor", labelKey: "cozy_indoor", snippet: "cozy indoor, warm lamp light, lived-in room" },
];

export const REEL_PROMPT_CHIPS: PromptChip[] = [
  { id: "handheld", labelKey: "handheld", snippet: "handheld phone wobble, authentic creator framing" },
  { id: "talking_cam", labelKey: "talking_cam", snippet: "talking to camera, natural micro-expressions" },
  { id: "slow_motion", labelKey: "slow_motion", snippet: "subtle slow motion, smooth movement" },
  { id: "transition", labelKey: "transition", snippet: "quick outfit transition, same room" },
  { id: "gym_bg", labelKey: "gym_bg", snippet: "busy gym background, soft depth of field" },
];

export function appendPromptSnippet(current: string, snippet: string): string {
  const base = current.trim();
  if (!base) return snippet;
  if (base.toLowerCase().includes(snippet.toLowerCase())) return base;
  return `${base}, ${snippet}`;
}
