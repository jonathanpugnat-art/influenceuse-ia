/** Caption tone presets — appended to content description for AI generation. */
export const CAPTION_TONES = [
  { id: "casual", labelFr: "Copine / casual", labelEn: "Casual", hint: "friendly, relatable, emoji-light" },
  { id: "inspiring", labelFr: "Inspirant", labelEn: "Inspiring", hint: "motivational, uplifting" },
  { id: "mysterious", labelFr: "Mystérieux", labelEn: "Mysterious", hint: "intriguing, short, poetic" },
  { id: "business", labelFr: "Business", labelEn: "Business", hint: "professional, polished" },
] as const;

export type CaptionToneId = (typeof CAPTION_TONES)[number]["id"];

export function captionToneHint(toneId: CaptionToneId): string {
  return CAPTION_TONES.find((t) => t.id === toneId)?.hint ?? "casual";
}
