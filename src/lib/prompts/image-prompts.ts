// ──────────────────────────────────────────────
// Image Generation Prompt Templates
// ──────────────────────────────────────────────

/** Base portrait template — high quality for face reference (wizard only) */
export const BASE_PORTRAIT_TEMPLATE =
  "ultra photorealistic RAW photo, shot on Canon EOS R5, 85mm f/1.2 lens, " +
  "portrait of a {age} year old {ethnicity} woman, " +
  "{hair_color} {hair_style} hair, {body_type} build, {fashion_style} fashion, " +
  "flawless skin with realistic texture and subtle pores, " +
  "sharp detailed eyes with catchlight, " +
  "professional studio lighting, soft key light, cinematic lighting, " +
  "8k, hyperrealistic, national geographic quality, " +
  "kodak portra 400 film emulation, natural color grading, vogue beauty editorial";

/** Templates per scene — casual real-life locations */
export const SCENE_TEMPLATES: Record<string, string> = {
  studio:
    "simple room with white walls, natural window light, full length mirror, casual home setting",
  beach:
    "real beach, natural daylight, sand and ocean, beach towel and sunscreen nearby, other beachgoers in distance, slightly overexposed from sun",
  urban:
    "real city sidewalk, shops and pedestrians in background, crosswalk, parked cars, natural street lighting, slightly busy",
  gym: "regular gym with other people working out, fluorescent overhead lighting, rubber floor, dumbbells and machines, gym mirror, water bottle",
  bedroom:
    "real bedroom, unmade bed, phone charger on nightstand, normal room lighting, laundry basket in corner, everyday life",
  restaurant:
    "normal restaurant table with real food and drinks, other diners visible, overhead restaurant lighting, menu on table, napkins",
  nature:
    "park or hiking trail, trees and grass, natural daylight, other hikers in distance, dirt path, wildflowers",
  cafe: "real coffee shop, ordering counter in background, paper coffee cup on table, laptop or phone visible, other customers, overhead lights",
  rooftop:
    "apartment rooftop or balcony, city buildings in background, plastic chairs, drinks on table, sunset, urban view",
  pool: "normal pool area, concrete deck, pool towels on loungers, sunscreen bottle, other swimmers, bright midday sun, pool noodles",
};

/** Templates per pose — expressive, natural social media poses */
export const POSE_TEMPLATES: Record<string, string> = {
  portrait:
    "casual selfie angle, natural head tilt, hand touching hair or adjusting sunglasses, slight duck lips or natural smile, phone visible in reflection",
  fullBody:
    "standing casually in front of mirror, one hand on hip, other hand holding phone, bag on shoulder, weight shifted to one side, OOTD pose",
  selfie:
    "mirror selfie in bathroom or elevator, peace sign or blowing a kiss, phone covering part of face, ring light reflection in eyes, messy background",
  action:
    "walking and laughing, hair caught in wind, coffee cup in hand, mid-step, shopping bags swinging, jacket half off shoulder",
  candid:
    "caught mid-laugh looking at friend off camera, hand covering mouth, drink in other hand, mid-conversation, genuine surprise expression",
  sitting:
    "sitting cross-legged at cafe table, chin resting on hand, iced latte in front, phone on table, AirPods in ears, scrolling through phone",
  profile:
    "looking out window or at view, wind in hair, holding ice cream or drink, sun hitting face, lost in thought moment",
};

/** Scene-specific accessories for realism */
export const SCENE_ACCESSORIES: Record<string, string> = {
  studio:
    "ring light visible, phone tripod, makeup palette on table",
  beach:
    "oversized sunglasses on head, straw tote bag, iced drink with straw, beach reads magazine, anklet jewelry",
  urban:
    "designer sunglasses, crossbody bag, iced coffee in hand, AirPods, layered gold necklaces, scrunchie on wrist",
  gym: "wireless earbuds, fitness tracker watch, shaker bottle, resistance bands, gym gloves, hair tied in messy bun with scrunchie",
  bedroom:
    "silk pajamas, messy bun with claw clip, coffee mug, phone with cute case, fuzzy slippers, skincare products on nightstand",
  restaurant:
    "wine glass on table, clutch purse, statement earrings, candlelight reflecting on jewelry, dessert plate",
  nature:
    "hiking backpack, baseball cap, water bottle, trail running shoes, friendship bracelets",
  cafe: "iced oat milk latte, MacBook or iPad on table, tote bag on chair, reading glasses pushed up on head, pastry on plate",
  rooftop:
    "cocktail glass, oversized blazer draped on shoulders, clutch purse, statement heels, city lights reflecting in sunglasses",
  pool: "oversized sunglasses, straw sun hat, tropical cocktail with umbrella, pool float nearby, waterproof phone pouch, gold body chain",
};

/** Templates per expression — vivid and social-media natural */
export const EXPRESSION_TEMPLATES: Record<string, string> = {
  smile:
    "genuine big smile showing teeth, squinting eyes, laugh lines, cheeks pushed up, happy and carefree",
  seductive:
    "subtle smirk, one eyebrow slightly raised, lips slightly parted, confident gaze, chin slightly down",
  serious:
    "straight face, editorial stare, lips pressed together, strong jawline, intense but natural",
  playful:
    "tongue slightly out, winking, peace sign near face, silly fun expression, Gen Z energy",
  mysterious:
    "looking away with half smile, mysterious side-eye, wind blowing hair across face, enigmatic",
  natural:
    "resting face, natural neutral expression, soft eyes, closed mouth gentle smile, relaxed",
  laughing:
    "throwing head back laughing, eyes closed from laughing, hand on chest, genuine burst of laughter, joyful moment",
  surprised:
    "mouth open in surprise, wide eyes, hands on cheeks, excited reaction, OMG face",
};

/** Templates per photography style — social media aesthetic */
export const STYLE_TEMPLATES: Record<string, string> = {
  natural:
    "no filter, no editing, straight from camera, authentic iPhone photo",
  editorial:
    "slightly edited, Instagram filter aesthetic, clean but not over-processed",
  cinematic:
    "slightly moody, natural contrast, indie film still aesthetic",
  vintage:
    "slightly faded colors, warm tone, VSCO filter aesthetic",
  hdr: "vivid natural colors, clear sharp detail, HDR iPhone mode",
  minimalist:
    "clean simple background, minimal clutter, aesthetic composition",
  glamour:
    "good natural lighting, flattering angle, Instagram baddie aesthetic",
  fashion_campaign:
    "well-dressed, shopping bag or luxury store, casual luxury, effortless style",
  street_style:
    "urban fashion, walking on sidewalk, shot by friend across the street",
  travel:
    "tourist location, travel outfit, backpack or luggage visible, exploring new place",
};

/** Templates per lighting — realistic, not dramatic */
export const LIGHTING_TEMPLATES: Record<string, string> = {
  golden_hour:
    "natural golden hour sunlight, warm but not over-saturated, realistic sun flare",
  blue_hour:
    "early evening natural light, cool tones, street lights starting to turn on",
  studio:
    "simple room lighting, overhead light, natural and flat, no dramatic shadows",
  natural: "natural daylight, overcast or sunny, no artificial enhancement, realistic",
  dramatic:
    "indoor lighting with some shadows, natural contrast, window light from one side",
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
  suggestive:
    "lingerie, seductive pose, alluring expression, boudoir photography, sensual",
  soft: "artistic boudoir, sensual intimate pose, intimate setting, soft focus, skin visible",
  explicit: "explicit content, adult content, nsfw, nude",
};

/** Default Replicate generation parameters — content photos (Instagram style) */
export const DEFAULT_IMAGE_PARAMS = {
  width: 1024,
  height: 1024,
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

// ──────────────────────────────────────────────
// Prompt Builder
// ──────────────────────────────────────────────

export interface PromptBuildInput {
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
  isNsfw?: boolean;
  nsfwLevel?: string;
  customPrompt?: string;
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
}): string {
  return BASE_PORTRAIT_TEMPLATE.replace("{age}", String(input.age))
    .replace("{ethnicity}", input.ethnicity.toLowerCase())
    .replace("{hair_color}", input.hairColor.toLowerCase())
    .replace("{hair_style}", input.hairStyle.toLowerCase())
    .replace("{body_type}", input.bodyType.toLowerCase())
    .replace("{fashion_style}", input.fashionStyle.toLowerCase());
}

/**
 * Builds a full content generation prompt.
 * Style: casual social media / iPhone — not editorial magazine.
 */
export function buildFullPrompt(input: PromptBuildInput): string {
  const parts: string[] = [];

  parts.push(
    "candid photo taken on iPhone 15 Pro, casual social media photo, natural unedited look"
  );

  if (input.style) {
    const style = STYLE_TEMPLATES[input.style] ?? input.style;
    parts.push(style);
  }

  if (input.scene) {
    const scene = SCENE_TEMPLATES[input.scene] ?? input.scene;
    parts.push(scene);
    const accessories = SCENE_ACCESSORIES[input.scene];
    if (accessories) parts.push(accessories);
  }

  if (input.lighting) {
    const light = LIGHTING_TEMPLATES[input.lighting] ?? input.lighting;
    parts.push(light);
  }

  const personParts: string[] = ["a woman"];
  if (input.age) personParts.push(`${input.age} years old`);
  if (input.ethnicity) personParts.push(input.ethnicity.toLowerCase());
  if (input.hairColor || input.hairStyle) {
    const hair = [input.hairColor, input.hairStyle].filter(Boolean).join(" ");
    personParts.push(`${hair.toLowerCase()} hair`);
  }
  if (input.bodyType) personParts.push(`${input.bodyType.toLowerCase()} build`);
  if (input.outfit) personParts.push(`wearing ${input.outfit}`);
  parts.push(personParts.join(", "));

  if (input.expression) {
    const expr = EXPRESSION_TEMPLATES[input.expression] ?? input.expression;
    parts.push(expr);
  }

  if (input.pose) {
    const pose = POSE_TEMPLATES[input.pose] ?? input.pose;
    parts.push(pose);
  }

  if (input.isNsfw && input.nsfwLevel) {
    const nsfw = NSFW_TEMPLATES[input.nsfwLevel] ?? "";
    if (nsfw) parts.push(nsfw);
  }

  parts.push(
    "taken on iPhone 15 Pro, casual social media photo, " +
      "natural flat lighting, no dramatic lighting, no color grading, " +
      "real skin with natural imperfections, visible skin texture, slight blemishes, " +
      "natural relaxed pose, not overly posed, slightly imperfect composition, " +
      "neutral color temperature, no filters, no editing, " +
      "real fabric texture on clothing, visible clothing wrinkles, " +
      "sharp focus, 4k, Instagram story quality, TikTok aesthetic, " +
      "photo looks like it was taken by a friend, not a photographer"
  );

  if (input.customPrompt) parts.push(input.customPrompt);

  return parts.join(", ");
}

/**
 * Returns the appropriate negative prompt.
 */
export function buildNegativePrompt(isNsfw: boolean): string {
  return isNsfw ? NEGATIVE_PROMPT_NSFW : NEGATIVE_PROMPT_SFW;
}
