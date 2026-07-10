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
    "lingerie fully worn, seductive pose, alluring expression, boudoir photography, sensual, tasteful, not nude, not explicit",
  soft:
    "artistic boudoir, sensual intimate pose, intimate setting, soft focus, lingerie or silk robe, not nude, not explicit",
  explicit: "explicit content, adult content, nsfw, nude",
};
