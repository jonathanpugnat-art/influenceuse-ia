// ──────────────────────────────────────────────
// Image Generation Prompt Templates
// ──────────────────────────────────────────────

import type { ContentImageEngine } from "@/lib/prompts/nano-borderline";

export type Gender = "female" | "male" | "nonbinary";
export type GenderedTemplate = { female: string; male: string; nonbinary: string };

export function genderLabel(gender: Gender): string {
  switch (gender) {
    case "male": return "man";
    case "nonbinary": return "person";
    default: return "woman";
  }
}

/** Base portrait template — high quality for face reference (wizard only).
 *
 * Identity disambiguation note: the template intentionally leaves room for a
 * `{distinct_traits}` slot. This slot is filled at build-time by
 * `pickAppearanceVariations()` with a random combination of face shape, eye
 * shape, eye color, nose, distinctive feature, and expression. Without it,
 * two users picking the same {age, ethnicity, hairColor, hairStyle, bodyType,
 * fashionStyle} would receive the SAME prompt byte-for-byte and the same
 * Flux 1.1 Pro seed → indistinguishable influencers.
 *
 * With ~6 axes × ~6 values each we get ~6^6 = ~46k visually distinct
 * combinations BEFORE the random seed kicks in. Combined with a random seed
 * per output, the collision probability drops below 1 in millions.
 */
export const BASE_PORTRAIT_TEMPLATE =
  "ultra photorealistic RAW photo, shot on Canon EOS R5, 85mm f/1.2 lens, " +
  "portrait of a {age} year old {ethnicity} {gender}, " +
  "{hair_color} {hair_style} hair, {body_type} build, {fashion_style} fashion, " +
  "{distinct_traits}, " +
  "flawless skin with realistic texture and subtle pores, " +
  "sharp detailed eyes with catchlight, " +
  "professional studio lighting, soft key light, cinematic lighting, " +
  "8k, hyperrealistic, national geographic quality, " +
  "kodak portra 400 film emulation, natural color grading, vogue beauty editorial";

/**
 * Pools of subtle but visually meaningful traits we randomly mix into the
 * portrait prompt so every influencer ends up unique even when the wizard
 * inputs are identical. Each pool has ~5-8 entries chosen to keep the look
 * realistic (we don't want "purple eyes" or other fantasy traits that would
 * break the iPhone-photo aesthetic).
 *
 * Don't reorder these arrays — `pickAppearanceVariations` uses index-based
 * indices stored in the influencer's `appearanceFingerprint`. Adding new
 * entries at the END is safe.
 */
export const APPEARANCE_VARIATIONS = {
  faceShape: [
    "oval face shape",
    "heart-shaped face",
    "round face shape",
    "square jawline",
    "diamond face shape",
    "long oval face",
  ],
  eyeShape: [
    "almond-shaped eyes",
    "round expressive eyes",
    "hooded eyes",
    "deep-set eyes",
    "wide-set eyes",
    "monolid eyes",
  ],
  eyeColor: [
    "hazel eyes",
    "deep brown eyes",
    "light brown eyes",
    "green eyes",
    "blue eyes",
    "grey-blue eyes",
    "amber eyes",
  ],
  nose: [
    "delicate nose",
    "subtle button nose",
    "refined straight nose",
    "soft Roman nose profile",
    "slightly upturned nose",
    "narrow bridged nose",
  ],
  distinctiveFeature: [
    "very subtle freckles across the nose bridge",
    "soft dimples when relaxed",
    "small beauty mark near the lip",
    "high defined cheekbones",
    "slightly fuller lips",
    "thin arched eyebrows",
    "thicker natural eyebrows",
    "small gap between front teeth",
  ],
  expression: [
    "warm gentle smile",
    "confident neutral gaze",
    "soft thoughtful expression",
    "subtle playful smirk",
    "calm serene expression",
    "natural relaxed look",
  ],
} as const;

export type AppearanceVariation = {
  faceShape: number;
  eyeShape: number;
  eyeColor: number;
  nose: number;
  distinctiveFeature: number;
  expression: number;
};

/**
 * Pick a random set of indices into APPEARANCE_VARIATIONS — deterministic if
 * a `random` function is provided (useful for tests + reproducible mock
 * influencers). Returns the indices so the caller can persist them on the
 * Influencer row and reproduce the same look later.
 */
export function pickAppearanceVariations(
  random: () => number = Math.random
): AppearanceVariation {
  const pickIdx = (len: number) => Math.floor(random() * len);
  return {
    faceShape: pickIdx(APPEARANCE_VARIATIONS.faceShape.length),
    eyeShape: pickIdx(APPEARANCE_VARIATIONS.eyeShape.length),
    eyeColor: pickIdx(APPEARANCE_VARIATIONS.eyeColor.length),
    nose: pickIdx(APPEARANCE_VARIATIONS.nose.length),
    distinctiveFeature: pickIdx(APPEARANCE_VARIATIONS.distinctiveFeature.length),
    expression: pickIdx(APPEARANCE_VARIATIONS.expression.length),
  };
}

/** Render the indices back into the comma-separated string the prompt expects. */
export function renderAppearanceVariations(v: AppearanceVariation): string {
  return [
    APPEARANCE_VARIATIONS.faceShape[v.faceShape],
    APPEARANCE_VARIATIONS.eyeShape[v.eyeShape],
    APPEARANCE_VARIATIONS.eyeColor[v.eyeColor],
    APPEARANCE_VARIATIONS.nose[v.nose],
    APPEARANCE_VARIATIONS.distinctiveFeature[v.distinctiveFeature],
    APPEARANCE_VARIATIONS.expression[v.expression],
  ].join(", ");
}

/**
 * Sprint 14 — UI-friendly breakdown of an AppearanceVariation. Returns each
 * trait individually so the wizard can render a labelled grid like:
 *   Visage   · oval face shape
 *   Yeux     · hazel eyes
 *   …
 * Used by `wizard-step-appearance.tsx` to surface the random traits to the
 * user (previously hidden) and let them re-roll a subset if they don't like.
 */
export interface AppearanceTraits {
  faceShape: string;
  eyeShape: string;
  eyeColor: string;
  nose: string;
  distinctiveFeature: string;
  expression: string;
}

export function explodeAppearanceVariations(
  v: AppearanceVariation
): AppearanceTraits {
  return {
    faceShape: APPEARANCE_VARIATIONS.faceShape[v.faceShape] ?? "",
    eyeShape: APPEARANCE_VARIATIONS.eyeShape[v.eyeShape] ?? "",
    eyeColor: APPEARANCE_VARIATIONS.eyeColor[v.eyeColor] ?? "",
    nose: APPEARANCE_VARIATIONS.nose[v.nose] ?? "",
    distinctiveFeature:
      APPEARANCE_VARIATIONS.distinctiveFeature[v.distinctiveFeature] ?? "",
    expression: APPEARANCE_VARIATIONS.expression[v.expression] ?? "",
  };
}

/**
 * Stable fingerprint of an influencer's visual identity — combines the
 * deterministic style fields with the random variations. Two influencers
 * sharing the same fingerprint will look almost identical (modulo seed).
 * We use a short SHA-256 prefix to keep the column small and human-scanable.
 */
export function appearanceFingerprint(
  style: {
    gender?: string;
    ethnicity?: string;
    hairColor?: string;
    hairStyle?: string;
    bodyType?: string;
    fashionStyle?: string;
  },
  age: number,
  variations: AppearanceVariation
): string {
  const payload = [
    age,
    style.gender ?? "female",
    style.ethnicity ?? "caucasian",
    style.hairColor ?? "brown",
    style.hairStyle ?? "long straight",
    style.bodyType ?? "average",
    style.fashionStyle ?? "casual",
    variations.faceShape,
    variations.eyeShape,
    variations.eyeColor,
    variations.nose,
    variations.distinctiveFeature,
    variations.expression,
  ].join("|");
  // Inline FNV-1a 32-bit — keeps us dependency-free (no crypto import for
  // such a low-stakes fingerprint). Returns 8 hex chars, e.g. "a3f1d20c".
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Templates per scene — casual real-life locations */
export const SCENE_TEMPLATES: Record<string, string> = {
  studio: "simple room with white walls, natural window light, full length mirror, casual home setting",
  beach: "real beach, natural daylight, sand and ocean, beach towel and sunscreen nearby, other beachgoers in distance, slightly overexposed from sun",
  urban: "real city sidewalk, shops and pedestrians in background, crosswalk, parked cars, natural street lighting, slightly busy",
  gym: "regular gym with other people working out, fluorescent overhead lighting, rubber floor, dumbbells and machines, gym mirror, water bottle",
  bedroom: "real bedroom, unmade bed, phone charger on nightstand, normal room lighting, laundry basket in corner, everyday life",
  restaurant: "normal restaurant table with real food and drinks, other diners visible, overhead restaurant lighting, menu on table, napkins",
  nature: "park or hiking trail, trees and grass, natural daylight, other hikers in distance, dirt path, wildflowers",
  cafe: "real coffee shop, ordering counter in background, paper coffee cup on table, laptop or phone visible, other customers, overhead lights",
  rooftop: "apartment rooftop or balcony, city buildings in background, plastic chairs, drinks on table, sunset, urban view",
  pool: "normal pool area, concrete deck, pool towels on loungers, sunscreen bottle, other swimmers, bright midday sun, pool noodles",
};

/** Scene-specific accessories — gendered for realism (no cross-gender accessories) */
export const SCENE_ACCESSORIES: Record<string, GenderedTemplate> = {
  studio: {
    female: "ring light, phone tripod, makeup palette on table",
    male: "ring light, phone tripod, plain backdrop, grooming products, minimalist watch",
    nonbinary: "ring light, phone tripod, minimalist props",
  },
  beach: {
    female: "oversized sunglasses on head, straw tote bag, iced drink with straw, beach magazine, anklet jewelry",
    male: "aviator sunglasses, surf shorts, beach towel, cold drink, baseball cap, surfboard nearby",
    nonbinary: "sunglasses, tote bag, iced drink, beach towel",
  },
  urban: {
    female: "designer sunglasses, crossbody bag, iced coffee, AirPods, layered gold necklaces, scrunchie on wrist",
    male: "designer sunglasses, leather backpack, iced coffee, AirPods, silver chain necklace, chunky watch",
    nonbinary: "sunglasses, crossbody bag, iced coffee, AirPods, minimalist jewelry",
  },
  gym: {
    female: "wireless earbuds, fitness tracker watch, shaker bottle, resistance bands, hair tied in messy bun with scrunchie",
    male: "wireless earbuds, fitness tracker watch, shaker bottle, lifting straps, gym towel on shoulder, baseball cap backwards",
    nonbinary: "wireless earbuds, fitness tracker, shaker bottle, gym towel",
  },
  bedroom: {
    female: "silk pajamas, messy bun with claw clip, coffee mug, phone with cute case, fuzzy slippers, skincare products on nightstand",
    male: "plain t-shirt and shorts, bedhead hair, coffee mug, phone on nightstand, basic slippers, watch and wallet on nightstand",
    nonbinary: "comfy pajamas, messy hair, coffee mug, cozy slippers",
  },
  restaurant: {
    female: "wine glass, clutch purse, statement earrings, candlelight reflecting on jewelry, dessert plate",
    male: "whiskey glass, leather wallet on table, chunky watch, rolled up sleeves, candlelight, dessert plate",
    nonbinary: "wine glass, minimalist bag, subtle jewelry, candlelight",
  },
  nature: {
    female: "hiking backpack, baseball cap, water bottle, trail running shoes, friendship bracelets",
    male: "hiking backpack, baseball cap, water bottle, trail running shoes, trekking poles, multi-tool on belt",
    nonbinary: "hiking backpack, baseball cap, water bottle, trail shoes",
  },
  cafe: {
    female: "iced oat milk latte, MacBook or iPad, tote bag on chair, reading glasses pushed up on head, pastry on plate",
    male: "black coffee or espresso, MacBook, leather messenger bag, notebook and pen, pastry on plate",
    nonbinary: "iced latte, MacBook, tote bag, pastry, notebook",
  },
  rooftop: {
    female: "cocktail glass, oversized blazer draped on shoulders, clutch purse, statement heels, city lights reflecting in sunglasses",
    male: "cocktail or craft beer, blazer, leather oxfords, luxury watch, cigar optional, city lights",
    nonbinary: "cocktail glass, blazer draped on shoulders, minimal accessories",
  },
  pool: {
    female: "oversized sunglasses, straw sun hat, tropical cocktail with umbrella, pool float, gold body chain",
    male: "aviator sunglasses, swim shorts, cold beer or cocktail, water bottle, sports watch, pool float",
    nonbinary: "sunglasses, sun hat, tropical drink, pool float",
  },
};

/** Poses — gendered for natural body language */
export const POSE_TEMPLATES: Record<string, GenderedTemplate> = {
  portrait: {
    female: "casual selfie angle, natural head tilt, hand touching hair, slight smile, phone visible in reflection",
    male: "casual selfie angle, natural head tilt, slight smirk, hand running through hair, phone visible in reflection",
    nonbinary: "casual selfie angle, natural head tilt, natural smile, phone visible in reflection",
  },
  fullBody: {
    female: "standing casually in front of mirror, one hand on hip, other hand holding phone, bag on shoulder, weight shifted to one side, OOTD pose",
    male: "standing casually in front of mirror, hands in pockets or one hand holding phone, weight shifted, confident stance, fit check pose",
    nonbinary: "standing casually in front of mirror, natural pose, phone in hand, OOTD",
  },
  selfie: {
    female: "mirror selfie, peace sign or kiss face, phone covering part of face, ring light reflection in eyes",
    male: "mirror selfie, neutral expression or slight smirk, phone covering part of face, flexing casually",
    nonbinary: "mirror selfie, natural expression, phone covering part of face",
  },
  action: {
    female: "walking and laughing, hair caught in wind, coffee cup in hand, mid-step, shopping bags swinging",
    male: "walking confidently, wind in hair, coffee cup in hand, mid-step, jacket swinging, phone in other hand",
    nonbinary: "walking naturally, mid-step, coffee in hand, candid movement",
  },
  candid: {
    female: "caught mid-laugh looking off camera, hand covering mouth, drink in other hand, genuine surprise",
    male: "caught mid-laugh looking off camera, hand on chest, drink in other hand, genuine reaction",
    nonbinary: "caught mid-laugh looking off camera, genuine candid moment",
  },
  sitting: {
    female: "sitting cross-legged at cafe table, chin resting on hand, iced latte in front, phone on table, AirPods in ears",
    male: "sitting at cafe table, leaning back casually, coffee in front, phone on table, AirPods in ears, legs crossed ankle on knee",
    nonbinary: "sitting at cafe table, relaxed pose, drink in front, phone and AirPods",
  },
  profile: {
    female: "looking out window, wind in hair, holding drink, sun hitting face, lost in thought",
    male: "looking out window, jaw silhouette lit by sun, holding coffee, strong profile, contemplative",
    nonbinary: "looking out window, natural light on face, holding drink, thoughtful moment",
  },
};

/** Expressions — gendered for authentic micro-expressions */
export const EXPRESSION_TEMPLATES: Record<string, GenderedTemplate> = {
  smile: {
    female: "genuine big smile showing teeth, squinting eyes, laugh lines, cheeks pushed up, happy",
    male: "genuine big smile showing teeth, squinting eyes, laugh lines, crow's feet, warm masculine smile",
    nonbinary: "genuine big smile showing teeth, squinting eyes, happy and carefree",
  },
  seductive: {
    female: "subtle smirk, lips slightly parted, looking straight at the camera, chin slightly down",
    male: "subtle smirk, looking straight at the camera, jawline relaxed, chin slightly up",
    nonbinary: "subtle smirk, looking straight at the camera, calm confident expression",
  },
  serious: {
    female: "neutral expression, lips pressed together, looking straight at the camera, no smile",
    male: "neutral expression, lips pressed together, looking straight at the camera, no smile",
    nonbinary: "neutral expression, neutral lips, looking straight at the camera",
  },
  playful: {
    female: "tongue slightly out, winking, peace sign near face, Gen Z energy",
    male: "tongue slightly out, winking, playful grin, finger guns, cheeky energy",
    nonbinary: "tongue slightly out, winking, playful expression",
  },
  mysterious: {
    female: "looking away with half smile, side-eye, wind blowing hair across face",
    male: "looking away with half smile, side-eye, brooding masculine look, wind in hair",
    nonbinary: "looking away with half smile, enigmatic side-eye",
  },
  natural: {
    female: "resting face, soft eyes, closed mouth gentle smile, relaxed",
    male: "resting face, neutral masculine expression, relaxed jaw, calm",
    nonbinary: "resting face, natural neutral expression, relaxed",
  },
  laughing: {
    female: "throwing head back laughing, eyes closed, hand on chest, joyful moment",
    male: "throwing head back laughing, eyes closed, hand on stomach or slapping knee, hearty laugh",
    nonbinary: "throwing head back laughing, genuine burst of joy",
  },
  surprised: {
    female: "mouth open in surprise, wide eyes, hands on cheeks, excited OMG face",
    male: "mouth open in surprise, wide eyes, hand on head or chest, bro reaction",
    nonbinary: "mouth open in surprise, wide eyes, excited reaction",
  },
};

/**
 * Photography styles — every entry now leads with iPhone-amateur cues so the
 * generated photo looks like a casual social-media post rather than a magazine
 * shoot. The "wardrobe/luxury" phrasing was removed because it was hijacking
 * the user-supplied outfit. (Sprint 11.)
 */
export const STYLE_TEMPLATES: Record<string, GenderedTemplate> = {
  natural: {
    female: "shot on iPhone, no filter, no edits, slight handheld blur, native camera app",
    male: "shot on iPhone, no filter, no edits, slight handheld blur, native camera app",
    nonbinary: "shot on iPhone, no filter, no edits, slight handheld blur, native camera app",
  },
  editorial: {
    female: "iPhone snapshot with very mild Instagram tone, no heavy edits, slight grain",
    male: "iPhone snapshot with very mild Instagram tone, no heavy edits, slight grain",
    nonbinary: "iPhone snapshot with very mild Instagram tone, no heavy edits, slight grain",
  },
  cinematic: {
    female: "iPhone snapshot, mild contrast from indoor lighting, candid not staged",
    male: "iPhone snapshot, mild contrast from indoor lighting, candid not staged",
    nonbinary: "iPhone snapshot, mild contrast from indoor lighting, candid not staged",
  },
  vintage: {
    female: "iPhone photo with VSCO A6 preset, slightly faded warm tones, faint film grain",
    male: "iPhone photo with VSCO A6 preset, slightly faded warm tones, faint film grain",
    nonbinary: "iPhone photo with VSCO A6 preset, slightly faded warm tones, faint film grain",
  },
  hdr: {
    female: "iPhone HDR photo, vivid natural colors, sharp detail, no over-saturation",
    male: "iPhone HDR photo, vivid natural colors, sharp detail, no over-saturation",
    nonbinary: "iPhone HDR photo, vivid natural colors, sharp detail, no over-saturation",
  },
  minimalist: {
    female: "iPhone photo, clean simple background, minimal clutter",
    male: "iPhone photo, clean simple background, minimal clutter",
    nonbinary: "iPhone photo, clean simple background, minimal clutter",
  },
  glamour: {
    female: "iPhone flash photo at night, slightly cramped framing, harsh but flattering light",
    male: "iPhone flash photo at night, slightly cramped framing, harsh but flattering light",
    nonbinary: "iPhone flash photo at night, slightly cramped framing, harsh but flattering light",
  },
  fashion_campaign: {
    // Kept the key for backward compat but defanged — no luxury/wardrobe noise.
    female: "iPhone photo, casual social media style, candid framing",
    male: "iPhone photo, casual social media style, candid framing",
    nonbinary: "iPhone photo, casual social media style, candid framing",
  },
  street_style: {
    female: "iPhone photo on the sidewalk, candid, framed by a friend across the street",
    male: "iPhone photo on the sidewalk, candid, framed by a friend across the street",
    nonbinary: "iPhone photo on the sidewalk, candid, framed by a friend across the street",
  },
  travel: {
    female: "iPhone photo at a real travel spot, casual tourist framing, no postcard composition",
    male: "iPhone photo at a real travel spot, casual tourist framing, no postcard composition",
    nonbinary: "iPhone photo at a real travel spot, casual tourist framing, no postcard composition",
  },
};

/** Templates per lighting — realistic */
export const LIGHTING_TEMPLATES: Record<string, string> = {
  golden_hour: "natural golden hour sunlight, warm but not over-saturated, realistic sun flare",
  blue_hour: "early evening natural light, cool tones, street lights starting to turn on",
  studio: "simple room lighting, overhead light, natural and flat, no dramatic shadows",
  natural: "natural daylight, overcast or sunny, no artificial enhancement, realistic",
  dramatic: "indoor lighting with some shadows, natural contrast, window light from one side",
  neon: "nighttime, neon signs in background but not coloring the subject, realistic night photo",
};

/** Standard negative prompt for SFW content */
export const NEGATIVE_PROMPT_SFW =
  "deformed, ugly, bad anatomy, bad hands, missing fingers, extra fingers, " +
  "blurry, low quality, watermark, text, signature, cropped, worst quality, " +
  "jpeg artifacts, duplicate, morbid, mutilated, poorly drawn face, " +
  "mutation, extra limbs, gross proportions, malformed limbs, " +
  "out of frame, disfigured, bad proportions, nsfw, nude, naked, " +
  "cartoon, anime, illustration, painting, drawing, CGI, 3d render, " +
  "plastic skin, waxy skin, over-saturated, uncanny valley, " +
  "ai generated, lowres, doll-like, fake, rendered";

/** Negative prompt for NSFW content (less restrictive) */
export const NEGATIVE_PROMPT_NSFW =
  "deformed, ugly, bad anatomy, bad hands, missing fingers, extra fingers, " +
  "blurry, low quality, watermark, text, signature, cropped, worst quality, " +
  "jpeg artifacts, duplicate, morbid, mutilated, poorly drawn face, " +
  "mutation, extra limbs, gross proportions, malformed limbs, " +
  "out of frame, disfigured, bad proportions, " +
  "cartoon, anime, illustration, painting, drawing, CGI, 3d render, " +
  "plastic skin, waxy skin, over-saturated, uncanny valley, " +
  "ai generated, lowres, doll-like, fake, rendered";

/** NSFW level templates */
export const NSFW_TEMPLATES: Record<string, string> = {
  suggestive: "lingerie, seductive pose, alluring expression, boudoir photography, sensual",
  soft: "artistic boudoir, sensual intimate pose, intimate setting, soft focus, skin visible",
  explicit: "explicit content, adult content, nsfw, nude",
};

/**
 * Default Replicate generation parameters for **Flux 1.1 Pro** (legacy SFW
 * path) and **Flux Dev Uncensored** (NSFW). Used when the model accepts
 * width/height/guidance_scale/etc.
 *
 * Sprint 14 — bumped from 1024x1024 to 1024x1280 (3:4) to match Kontext +
 * Nano Banana + portrait wizard. See KONTEXT_IMAGE_PARAMS comment.
 */
export const DEFAULT_IMAGE_PARAMS = {
  width: 1024,
  height: 1280,
  num_inference_steps: 35,
  guidance_scale: 3.5,
  output_format: "jpg" as const,
  output_quality: 92,
};

/** Portrait-ratio params for close-up portraits (wizard base image — high quality) */
export const PORTRAIT_IMAGE_PARAMS = {
  width: 1024,
  height: 1365,
  num_inference_steps: 40,
  guidance_scale: 4.0,
  output_format: "jpg" as const,
  output_quality: 98,
};

/**
 * Sprint 11 — Flux Kontext Pro inputs.
 * Schema is intentionally minimal: this model has NO negative_prompt, NO
 * guidance_scale, NO num_inference_steps. The prompt itself drives quality.
 * Safety tolerance is capped to 2 by Black Forest when input_image is sent.
 *
 * Sprint 14 — aspect ratio bumped from 1:1 to 3:4 (Grok feedback): the
 * portrait wizard ships in 3:4 (1024x1280) but content used to render in
 * 1:1 (1024x1024). The mismatch made every influencer look like "two
 * different people" between her base portrait and her feed posts. Going
 * 3:4 across the board also matches Instagram Reels / Stories / TikTok's
 * native vertical canvas — better engagement, no cropping.
 */
export const KONTEXT_IMAGE_PARAMS = {
  aspect_ratio: "3:4" as const,
  output_format: "jpg" as const,
  prompt_upsampling: false as const,
  safety_tolerance: 2 as const,
};

export const KONTEXT_PORTRAIT_PARAMS = {
  aspect_ratio: "3:4" as const,
  output_format: "jpg" as const,
  prompt_upsampling: false as const,
  safety_tolerance: 2 as const,
};

// ──────────────────────────────────────────────
// Prompt Builder
// ──────────────────────────────────────────────

export interface PromptBuildInput {
  gender?: Gender;
  age?: number;
  ethnicity?: string;
  hairColor?: string;
  hairStyle?: string;
  bodyType?: string;
  fashionStyle?: string;
  scene?: string;
  pose?: string;
  expression?: string;
  style?: string;
  lighting?: string;
  outfit?: string;
  location?: string;
  /** Reinforce same facial identity when a reference image is sent to the model (SFW path). */
  useReferenceFace?: boolean;
  isNsfw?: boolean;
  nsfwLevel?: string;
  customPrompt?: string;
  /**
   * Sprint 14 — shared visual DNA between the portrait wizard and the
   * content pipeline. When the influencer row has appearanceVariations
   * persisted (from Sprint 13), we re-inject them here so Kontext / Nano /
   * Flux all reproduce the same eyes, nose, freckles, cheekbones etc.
   * Without this, the base portrait and the feed posts can look like
   * "two different people" — Grok flagged this in the 2026-05-18 audit.
   */
  appearanceVariations?: AppearanceVariation;
  /**
   * When Kontext is chosen (borderline guard or Nano E005 fallback), we add
   * light framing hints so the feed stays cohesive without forcing wide shots.
   */
  contentEngine?: ContentImageEngine;
}

/**
 * Builds a base portrait prompt for generating the initial reference face.
 */
export function buildBasePortraitPrompt(input: {
  age: number;
  ethnicity: string;
  hairColor: string;
  hairStyle: string;
  bodyType: string;
  fashionStyle: string;
  gender?: Gender;
  /**
   * Random visual traits that make every influencer unique even when the
   * wizard inputs are identical. If omitted, we pick a fresh random set —
   * but callers should usually generate them upstream so they can be
   * persisted on the Influencer row (for fingerprinting + reproducibility).
   */
  variations?: AppearanceVariation;
}): string {
  const variations = input.variations ?? pickAppearanceVariations();
  return BASE_PORTRAIT_TEMPLATE.replace("{age}", String(input.age))
    .replace("{ethnicity}", input.ethnicity.toLowerCase())
    .replace("{gender}", genderLabel(input.gender ?? "female"))
    .replace("{hair_color}", input.hairColor.toLowerCase())
    .replace("{hair_style}", input.hairStyle.toLowerCase())
    .replace("{body_type}", input.bodyType.toLowerCase())
    .replace("{fashion_style}", input.fashionStyle.toLowerCase())
    .replace("{distinct_traits}", renderAppearanceVariations(variations));
}

/**
 * Builds a full content generation prompt (Sprint 11 rewrite).
 *
 * Three guiding principles, in priority order:
 *  1. Identity (when a reference image is sent) and outfit must dominate the
 *     first ~40% of the prompt — diffusion models bias toward early tokens.
 *  2. Every aesthetic instruction is reframed as "amateur iPhone photo" so the
 *     output never drifts into magazine/studio territory. We explicitly state
 *     what we DON'T want even though Flux Kontext Pro has no negative_prompt
 *     channel — encoding negatives in the prompt itself works on this model.
 *  3. When the user provides an explicit `outfit`, we don't let style
 *     templates contradict it (the old fashion_campaign / street_style copy
 *     described luxury menswear and ended up overriding the user input).
 */
export function buildFullPrompt(input: PromptBuildInput): string {
  const parts: string[] = [];
  const gender: Gender = input.gender ?? "female";
  const genderWord = genderLabel(gender);

  // ── 1. Camera + identity hook (first tokens win) ─────────────────────────
  // Sprint 11.1 — push harder for the "friend took it on iPhone with flash"
  // look. The previous prompt still leaned slightly polished; this version
  // explicitly bans pro lighting and forces flash/awkward composition cues.
  parts.push(
    "real candid iPhone photo, snapped by a friend on an iPhone, " +
      "iPhone flash on, harsh direct frontal flash, " +
      "slight flash overexposure on skin, sharp hard shadow cast behind on the wall or floor, " +
      "casual TikTok / Instagram story snapshot, real unposed moment, " +
      "NOT a magazine shoot, NOT a studio photo, NOT professional photography, " +
      "NO softbox, NO ring light, NO color grading, NO retouching"
  );

  if (input.useReferenceFace) {
    parts.push(
      "same exact person as the reference photo, identical facial identity, " +
        "preserve the reference face shape, eyes, nose, mouth, jawline, skin tone and ethnicity, " +
        "same person in a new pose and setting, not a lookalike, not a similar person, " +
        "do not change age or gender, do not beautify or smooth skin beyond a real iPhone photo"
    );
  }

  // ── 2. Outfit (front-loaded so it survives the rest of the prompt) ───────
  const outfit = input.outfit?.trim();
  const hasExplicitOutfit = Boolean(outfit && outfit.length > 0);
  if (hasExplicitOutfit) {
    parts.push(
      `wearing ${outfit}, outfit clearly visible, full outfit details preserved, ` +
        "real fabric texture and folds"
    );
  }

  // ── 3. Person description ────────────────────────────────────────────────
  const personParts: string[] = [`a ${genderWord}`];
  if (input.age) personParts.push(`${input.age} years old`);
  if (input.ethnicity) personParts.push(input.ethnicity.toLowerCase());
  if (input.hairColor || input.hairStyle) {
    const hair = [input.hairColor, input.hairStyle].filter(Boolean).join(" ");
    personParts.push(`${hair.toLowerCase()} hair`);
  }
  if (input.bodyType) personParts.push(`${input.bodyType.toLowerCase()} build`);
  parts.push(personParts.join(", "));

  // ── 3b. Shared visual DNA (Sprint 14) ────────────────────────────────────
  // Inject the same 6 facial traits that were tied to the portrait so the
  // feed photos look like the same person across base + content. Without
  // this Kontext only sees the reference image bytes (which it sometimes
  // re-interprets loosely) — the explicit trait words give it a textual
  // anchor too. The cost is ~30 extra tokens; well under any model limit.
  if (input.appearanceVariations) {
    parts.push(
      `facial details: ${renderAppearanceVariations(input.appearanceVariations)}`
    );
  }

  // ── 4. Gender reinforcement (anti cross-gender clothing) ─────────────────
  if (gender === "male") {
    parts.push(
      "masculine man, masculine appearance, masculine clothing only, " +
        "NO feminine clothing, NO dress, NO skirt, NO makeup, NO lipstick, " +
        "NO earrings, NO feminine jewelry, short or masculine hair"
    );
  } else if (gender === "female") {
    parts.push("feminine woman, feminine appearance");
  }

  // ── 5. Environment: location > scene + accessories ──────────────────────
  if (input.location && input.location.trim().length > 0) {
    parts.push(
      `at ${input.location.trim()}, famous landmark visible in background, real recognizable location`
    );
  }

  if (input.scene) {
    const scene = SCENE_TEMPLATES[input.scene] ?? input.scene;
    parts.push(scene);
    const accessoriesSet = SCENE_ACCESSORIES[input.scene];
    if (accessoriesSet) parts.push(accessoriesSet[gender]);
  }

  if (input.lighting) {
    const light = LIGHTING_TEMPLATES[input.lighting] ?? input.lighting;
    parts.push(light);
  }

  // ── 6. Expression & pose ─────────────────────────────────────────────────
  if (input.expression) {
    const exprSet = EXPRESSION_TEMPLATES[input.expression];
    if (exprSet) parts.push(exprSet[gender]);
    else parts.push(input.expression);
  }
  if (input.pose) {
    const poseSet = POSE_TEMPLATES[input.pose];
    if (poseSet) parts.push(poseSet[gender]);
    else parts.push(input.pose);
  }

  // ── 7. Photography style (only if it doesn't fight the user outfit) ─────
  if (input.style) {
    const entry = STYLE_TEMPLATES[input.style];
    parts.push(entry ? entry[gender] : input.style);
  }

  // ── 8. NSFW addendum (last so it can be stripped easily) ─────────────────
  if (input.isNsfw && input.nsfwLevel) {
    const nsfw = NSFW_TEMPLATES[input.nsfwLevel] ?? "";
    if (nsfw) parts.push(nsfw);
  }

  // ── 9. Final iPhone-realism enforcer (closes the prompt) ────────────────
  // Strong closing weight — diffusion models also bias toward the LAST tokens.
  parts.push(
    "shot vertically on iPhone with the native camera app, iPhone flash fired, " +
      "slightly overexposed face from the flash, harsh shadow behind the subject, " +
      "real skin with visible pores and small blemishes, slightly oily T-zone shine, " +
      "no makeup retouching, faint under-eye shadow, asymmetrical natural face, " +
      "slight motion blur from a handheld iPhone, mild grain, " +
      "amateur framing not centered, slightly tilted, candid not posed, " +
      "looks like a real photo a friend just took at 11pm and posted to their story, " +
      "NOT AI-perfect, NOT smooth, NOT glossy, NOT magazine quality"
  );

  if (input.customPrompt) parts.push(input.customPrompt);

  // Kontext path — same bust-friendly 3:4 feel as Nano, slightly softer flash wording
  // so the model switch is less obvious in the feed (not a distant full-body shot).
  if (input.contentEngine === "kontext") {
    parts.push(
      "medium shot from mid-torso up, face clearly visible and recognizable, " +
        "natural candid Instagram story framing, subject fills most of the vertical frame, " +
        "consistent skin tone with the reference person, real iPhone snapshot energy"
    );
  }

  return parts.join(", ");
}

const FACE_LOCK_NEGATIVE =
  "different person, wrong face, face swap, morphing face, inconsistent face, " +
  "celebrity lookalike, twin confusion, changing ethnicity, plastic surgery look";

export type NegativePromptOptions = { lockFace?: boolean };

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
