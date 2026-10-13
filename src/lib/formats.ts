import type { FaceAngle } from "@/lib/identity/angles";

export const FORMATS = [
  {
    id: "pov",
    label: "POV",
    reach: "Le format le plus repris. Le spectateur est dans la scène.",
    shot: "vertical 9:16 Reel, she looks into the lens as if the viewer just walked in, one clear hook in the first second",
    angle: "front" as FaceAngle,
  },
  {
    id: "grwm",
    label: "GRWM",
    reach: "Get ready with me. Ça retient parce que le geste continue.",
    shot: "vertical 9:16 Reel, she gets ready in a mirror, hands moving, outfit coming together",
    angle: "three_quarter_left" as FaceAngle,
  },
  {
    id: "journee",
    label: "Journée",
    reach: "Trois moments dans la même journée. Facile à regarder jusqu’au bout.",
    shot: "vertical 9:16 Reel, morning light then evening, same person, a small routine the viewer can follow",
    angle: "front" as FaceAngle,
  },
  {
    id: "confession",
    label: "Confession",
    reach: "Visage proche, une seule phrase. Ça arrête le scroll.",
    shot: "vertical 9:16 Reel, tight close-up, she leans in and speaks one honest line to the camera",
    angle: "front" as FaceAngle,
  },
  {
    id: "avant-apres",
    label: "Avant / après",
    reach: "Le changement se voit sans texte long.",
    shot: "vertical 9:16 Reel, same face, a visible before and after of her look in one continuous shot",
    angle: "three_quarter_right" as FaceAngle,
  },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];

export function formatById(id: string) {
  return FORMATS.find((format) => format.id === id) ?? null;
}

export function buildFormatPrompt(
  format: { shot: string },
  niche: { subject: string; audience: string; promise: string; tone: string },
): string {
  return [
    "The woman in the reference photo.",
    format.shot + ".",
    `The Reel is about ${niche.subject} for ${niche.audience}, tone ${niche.tone}.`,
    `The viewer should feel: ${niche.promise}.`,
    "Keep the same face, hair, age, and clothes.",
    "No extra person, no text, no watermark, no flicker.",
  ].join(" ");
}

export function buildReelPrompt(
  reel: { caption: string },
  niche: { subject: string; audience: string; promise: string; tone: string },
): string {
  const idea = reel.caption.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim().slice(0, 200);
  return [
    "The woman in the reference photo recreates a viral Instagram Reel.",
    idea ? `The original idea: "${idea}".` : "The original is a short vertical clip of one person talking to the camera.",
    "Vertical 9:16, one clear hook in the first second, natural light, phone-shot look.",
    `Adapted to ${niche.subject} for ${niche.audience}, tone ${niche.tone}.`,
    `The viewer should feel: ${niche.promise}.`,
    "Keep the same face, hair, age, and clothes.",
    "No extra person, no text, no watermark, no flicker.",
  ].join(" ");
}
