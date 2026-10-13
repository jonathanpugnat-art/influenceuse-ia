import type { FaceAngle } from "@/lib/identity/angles";

const PROMPTS: Record<FaceAngle, string> = {
  front:
    "same person, front-facing headshot, neutral studio light, looking at camera, keep exact face identity",
  three_quarter_left:
    "same person, three-quarter view turned slightly to her left, soft studio light, keep exact face identity",
  three_quarter_right:
    "same person, three-quarter view turned slightly to her right, soft studio light, keep exact face identity",
};

export function anglePrompt(angle: FaceAngle): string {
  return PROMPTS[angle];
}
