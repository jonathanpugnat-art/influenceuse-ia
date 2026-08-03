import type { GenderedTemplate } from "./types";

/** Poses — gendered for natural body language */
export const POSE_TEMPLATES: Record<string, GenderedTemplate> = {
  portrait: {
    female:
      "medium shot, friend took the photo from a few steps away, natural relaxed pose, slight smile, looking at camera, no phone visible, not a mirror shot",
    male:
      "medium shot, friend took the photo from a few steps away, relaxed confident pose, slight smirk, looking at camera, no phone visible, not a mirror shot",
    nonbinary:
      "medium shot, friend took the photo from a few steps away, natural relaxed pose, looking at camera, no phone visible, not a mirror shot",
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
