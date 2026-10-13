import { formatById } from "@/lib/formats";

export const VIDEO_DURATION_SECONDS = 5;

export const VIDEO_NEGATIVE_PROMPT = [
  "blur",
  "text",
  "watermark",
  "logo",
  "extra person",
  "face morph",
  "identity change",
  "distorted face",
  "flicker",
].join(", ");

const FORMAT_MOTION: Record<string, string> = {
  pov: "subtle handheld sway, she breathes and slightly leans toward the lens, soft eye contact, natural micro-expressions",
  grwm: "hands move naturally adjusting hair or collar, gentle head turn toward mirror then camera, light fabric motion",
  journee: "slow push-in, soft daylight shift across her face, she glances aside then back, calm everyday rhythm",
  confession: "tight close-up, she leans in a few centimeters, lips part as if speaking one honest line, very slight nod",
  "avant-apres": "smooth continuous motion revealing a subtle look change, hair settles, soft camera drift, no jump cut",
};

const DEFAULT_MOTION =
  "subtle cinematic motion, natural breathing, soft camera drift, realistic fabric and hair movement, keep identity locked";

/**
 * Builds an I2V motion prompt from a face-locked still.
 * Identity lock is explicit so Kling/Seedance keep the same face.
 */
export function buildMotionPrompt(input: {
  sourceLabel: string;
  sourceKind: string;
  sourceRef: string;
  parentPrompt?: string;
}): string {
  const format =
    input.sourceKind === "format" ? formatById(input.sourceRef) : null;
  const motion = format ? (FORMAT_MOTION[format.id] ?? DEFAULT_MOTION) : DEFAULT_MOTION;

  return [
    "Animate the woman in the start image only.",
    "Keep the exact same face, hair, age, skin, body, outfit, and background identity.",
    motion + ".",
    `Context: ${input.sourceLabel}.`,
    input.parentPrompt
      ? `Scene intent from the still: ${input.parentPrompt.slice(0, 220)}.`
      : null,
    "Vertical 9:16 phone look, natural light, smooth motion, no morphing, no second person.",
  ]
    .filter(Boolean)
    .join(" ");
}
