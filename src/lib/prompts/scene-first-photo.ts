/**
 * Two-step photo pipeline: (1) environment plate with no face, (2) Nano compose
 * with identity refs + scene plate as the last reference image.
 */

import {
  genderLabel,
  LIGHTING_TEMPLATES,
  type Gender,
} from "@/lib/prompts/image-prompts";

export type ScenePlatePromptInput = {
  sceneDescription: string;
  scene?: string;
  lighting?: string;
  location?: string;
};

/** Step 1 — location only, no people (avoids Kontext locking the portrait background). */
export function buildScenePlatePrompt(input: ScenePlatePromptInput): string {
  const env =
    input.sceneDescription?.trim() ||
    "casual indoor room with natural window light and everyday furniture";

  const parts: string[] = [
    "vertical 9:4 photograph of an empty real-world location, environment only",
    `setting: ${env}`,
    "absolutely no people, no faces, no silhouettes, no mannequins, no human body parts",
    "realistic iPhone snapshot of the place, natural imperfect lighting, mild grain",
    "NOT studio backdrop, NOT grey seamless, NOT CGI, NOT 3D render",
  ];

  if (input.location?.trim()) {
    parts.push(
      `recognizable landmark or city context: ${input.location.trim()}, background architecture visible`
    );
  }

  if (input.lighting) {
    const light = LIGHTING_TEMPLATES[input.lighting] ?? input.lighting;
    parts.push(light);
  }

  parts.push(
    "sharp focus on furniture, walls, floor, mirrors, and props; ready for a person to be added later"
  );

  return parts.join(", ");
}

export type SceneFirstComposeInput = {
  gender?: Gender;
  age?: number;
  ethnicity?: string;
  hairColor?: string;
  hairStyle?: string;
  bodyType?: string;
  sceneDescription?: string;
  pose?: string;
  expression?: string;
  outfit?: string;
  customPrompt?: string;
  useReferenceFace?: boolean;
};

/** Step 2 — person composed into the plate (Nano multi-ref; plate must be last URL). */
export function buildSceneFirstComposePrompt(input: SceneFirstComposeInput): string {
  const gender: Gender = input.gender ?? "female";
  const genderWord = genderLabel(gender);
  const env = input.sceneDescription?.trim();

  const parts: string[] = [
    "real candid iPhone photo, the exact same person as the first reference image(s), " +
      "identical face, skin tone, ethnicity, and age as the identity references, not a lookalike",
    "place this person naturally into the environment shown in the last reference image, " +
      "match the last image lighting, perspective, color temperature, and background layout exactly, " +
      "do not replace the background with a studio or grey backdrop",
  ];

  if (input.useReferenceFace !== false) {
    parts.push(
      "preserve facial identity from the first references, do not morph or beautify beyond a real iPhone photo"
    );
  }

  const outfit = input.outfit?.trim();
  if (outfit) {
    parts.push(`wearing ${outfit}, outfit clearly visible`);
  }

  const person: string[] = [`a ${genderWord}`];
  if (input.age) person.push(`${input.age} years old`);
  if (input.ethnicity) person.push(input.ethnicity.toLowerCase());
  if (input.hairColor || input.hairStyle) {
    person.push(
      `${[input.hairColor, input.hairStyle].filter(Boolean).join(" ").toLowerCase()} hair`
    );
  }
  if (input.bodyType) person.push(`${input.bodyType.toLowerCase()} build`);
  parts.push(person.join(", "));

  if (env) {
    parts.push(`scene action and framing: ${env}`);
  }

  if (input.pose) parts.push(`pose: ${input.pose}`);
  if (input.expression) parts.push(`expression: ${input.expression}`);

  parts.push(
    "shot vertically on iPhone, natural skin pores, slight handheld tilt, " +
      "NOT magazine, NOT CGI, NOT plastic skin"
  );

  if (input.customPrompt?.trim()) {
    parts.push(input.customPrompt.trim());
  }

  return parts.join(", ");
}

/**
 * Face-locked variant of {@link buildSceneFirstComposePrompt} for PuLID / LoRA.
 *
 * PuLID (and the Pro/Agency LoRA hybrid) cannot ingest a scene plate as a
 * secondary reference — they only accept a single face image. So the plate
 * that step 1 produced becomes a preview/approval artefact and the compose
 * step drops the "first reference / last reference" language that Nano
 * multi-ref needed, replacing it with a direct scene description that PuLID
 * or LoRA can render around the biometric face.
 *
 * Everything else (outfit, person description, pose/expression, custom
 * prompt) is copied verbatim from the Nano compose prompt so the user's
 * scene text still drives the render.
 */
export function buildFaceLockedSceneComposePrompt(
  input: SceneFirstComposeInput
): string {
  const gender: Gender = input.gender ?? "female";
  const genderWord = genderLabel(gender);
  const env = input.sceneDescription?.trim();

  const parts: string[] = [
    "real candid iPhone photo, natural imperfect lighting, mild grain",
  ];

  const outfit = input.outfit?.trim();
  if (outfit) {
    parts.push(`wearing ${outfit}, outfit clearly visible`);
  }

  const person: string[] = [`a ${genderWord}`];
  if (input.age) person.push(`${input.age} years old`);
  if (input.ethnicity) person.push(input.ethnicity.toLowerCase());
  if (input.hairColor || input.hairStyle) {
    person.push(
      `${[input.hairColor, input.hairStyle].filter(Boolean).join(" ").toLowerCase()} hair`
    );
  }
  if (input.bodyType) person.push(`${input.bodyType.toLowerCase()} build`);
  parts.push(person.join(", "));

  if (env) {
    parts.push(`environment and scene action: ${env}`);
  }

  if (input.pose) parts.push(`pose: ${input.pose}`);
  if (input.expression) parts.push(`expression: ${input.expression}`);

  parts.push(
    "shot vertically on iPhone, natural skin pores, slight handheld tilt, " +
      "NOT magazine, NOT CGI, NOT plastic skin, NOT studio backdrop"
  );

  if (input.customPrompt?.trim()) {
    parts.push(input.customPrompt.trim());
  }

  return parts.join(", ");
}

/** Extra credits for the shared environment plate (one per generation batch). */
export const SCENE_FIRST_PLATE_CREDIT = 1;
