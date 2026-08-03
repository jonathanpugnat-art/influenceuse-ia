import { usesSelfieCameraFraming } from "@/lib/photo-scene-inference";
import {
  buildActionBlock,
  buildEngineBlock,
  buildIdentityBlock,
  buildMoodBlock,
  buildNegativeBlock,
  buildNsfwBlock,
  buildSceneBlock,
  buildSubjectBlock,
  buildTechnicalBase,
} from "./prompt-blocks";
import { NEGATIVE_PROMPT_NSFW, NEGATIVE_PROMPT_SFW } from "./negatives-nsfw";
import type { Gender, NegativePromptOptions, PromptBuildInput } from "./types";

export function buildFullPrompt(input: PromptBuildInput): string {
  const selfieFraming = usesSelfieCameraFraming(
    input.pose ?? "candid",
    input.sceneDescription
  );

  const blocks: string[] = [
    buildIdentityBlock(input),
    buildTechnicalBase(input, selfieFraming),
    buildSubjectBlock(input),
    buildSceneBlock(input),
    buildActionBlock(input),
    buildMoodBlock(input, selfieFraming),
    buildNsfwBlock(input),
    buildNegativeBlock(input, selfieFraming),
    buildEngineBlock(input),
  ].filter((block): block is string => Boolean(block?.trim()));

  return blocks.join("\n\n");
}

const FACE_LOCK_NEGATIVE =
  "different person, wrong face, face swap, morphing face, inconsistent face, " +
  "celebrity lookalike, twin confusion, changing ethnicity, plastic surgery look";

/**
 * Returns the appropriate negative prompt, with gender-specific additions.
 */
export function buildNegativePrompt(
  isNsfw: boolean,
  gender: Gender = "female",
  options?: NegativePromptOptions
): string {
  const base = isNsfw ? NEGATIVE_PROMPT_NSFW : NEGATIVE_PROMPT_SFW;
  let out = base;
  if (gender === "male") {
    out +=
      ", dress, skirt, heels, high heels, lipstick, makeup, mascara, eyeshadow, " +
      "long earrings, feminine jewelry, purse, clutch bag, feminine clothing, " +
      "bra, bikini top, feminine hair style, feminine pose";
  }
  if (options?.lockFace) {
    out += ", " + FACE_LOCK_NEGATIVE;
  }
  return out;
}
