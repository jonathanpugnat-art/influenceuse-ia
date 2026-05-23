/**
 * Real-IG-style reel recipes — pre-fill scene + motion; maps to backend `videoType`.
 */

export type ReelCreatorExampleId =
  | "grwm_mirror"
  | "ootd_bedroom"
  | "talking_desk"
  | "outfit_transition"
  | "day_coffee"
  | "gym_mirror";

export type ReelCreatorExample = {
  id: ReelCreatorExampleId;
  videoType: string;
  /** i18n key under content.reelExamples.<id> */
  labelKey: ReelCreatorExampleId;
  sceneDescription: string;
  outfit: string;
  script: string;
};

export const REEL_CREATOR_EXAMPLES: ReelCreatorExample[] = [
  {
    id: "grwm_mirror",
    labelKey: "grwm_mirror",
    videoType: "grwm",
    sceneDescription:
      "bathroom mirror, soft morning window light, toiletries on the counter, iPhone selfie angle, real apartment",
    outfit: "white towel wrap or casual lounge set",
    script:
      "she fixes her hair in the mirror, adjusts straps, small natural smile, subtle head turn — same bathroom throughout, handheld phone wobble",
  },
  {
    id: "ootd_bedroom",
    labelKey: "ootd_bedroom",
    videoType: "ootd",
    sceneDescription:
      "bedroom full-length mirror, messy bed in background, daylight, casual influencer room, vertical iPhone framing",
    outfit: "fitted jeans and cropped top, sneakers visible",
    script:
      "she steps back to show full outfit, gentle turn to the side, fixes hair, confident relaxed pose — no location change",
  },
  {
    id: "talking_desk",
    labelKey: "talking_desk",
    videoType: "talking_head",
    sceneDescription:
      "desk or car interior, window light on face, phone propped at eye level, shallow depth, casual creator setup",
    outfit: "simple t-shirt, minimal jewelry",
    script:
      "talking to camera with natural micro-expressions, slight nods, blinking, tiny hand gestures — stable framing, not exaggerated acting",
  },
  {
    id: "outfit_transition",
    labelKey: "outfit_transition",
    videoType: "transition",
    sceneDescription:
      "same bedroom corner, neutral wall, ring light or window light, TikTok transition framing",
    outfit: "outfit A then outfit B (describe both in motion field if needed)",
    script:
      "hand covers lens briefly then pulls away to reveal new outfit, quick snap energy, same room — trendy but still phone-filmed",
  },
  {
    id: "day_coffee",
    labelKey: "day_coffee",
    videoType: "day_in_life",
    sceneDescription:
      "kitchen counter, making coffee, morning light, mugs and kettle visible, authentic apartment vibe",
    outfit: "oversized hoodie, messy bun",
    script:
      "pours coffee, stirs, takes a sip, glances at camera with a soft smile — one continuous calm clip, handheld drift",
  },
  {
    id: "gym_mirror",
    labelKey: "gym_mirror",
    videoType: "workout",
    sceneDescription:
      "busy gym, full body in frame, same outfit as reference, people training softly blurred in background, indoor gym lighting",
    outfit: "sports bra and leggings, gym shoes",
    script:
      "talking to camera while moving naturally, gentle body sway, micro-expressions, promoting the brand casually — handheld iPhone, single take",
  },
];

export function getReelExampleById(id: string): ReelCreatorExample | undefined {
  return REEL_CREATOR_EXAMPLES.find((e) => e.id === id);
}
