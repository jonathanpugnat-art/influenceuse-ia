import type { FaceAngle } from "@/lib/identity/angles";

export const SCENES = [
  {
    id: "cafe",
    label: "Café",
    place: "a sunlit café in the morning",
    angle: "front" as FaceAngle,
  },
  {
    id: "rue",
    label: "Rue",
    place: "a city street at dusk",
    angle: "three_quarter_left" as FaceAngle,
  },
  {
    id: "studio",
    label: "Studio",
    place: "a plain studio with soft window light",
    angle: "front" as FaceAngle,
  },
  {
    id: "plage",
    label: "Plage",
    place: "a quiet beach in late afternoon",
    angle: "three_quarter_right" as FaceAngle,
  },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

export function sceneById(id: string) {
  return SCENES.find((scene) => scene.id === id) ?? null;
}

export function buildScenePrompt(
  scene: { place: string },
  niche: { subject: string; audience: string; promise: string; tone: string },
): string {
  return [
    `The woman in the reference photo is in ${scene.place}.`,
    `She presents ${niche.subject} for ${niche.audience}, tone ${niche.tone}.`,
    `The viewer should understand: ${niche.promise}.`,
    "She makes one small natural gesture toward the camera.",
    "Close-up, slow push-in, keep the same face, hair, age, and clothes.",
    "No extra person, no text, no watermark.",
  ].join(" ");
}
