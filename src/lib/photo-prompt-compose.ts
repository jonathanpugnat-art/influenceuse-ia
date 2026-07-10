import type { PhotoParams } from "@/hooks/use-photo-creator";
import {
  inferExpressionFromSceneAndOutfit,
  inferPoseFromScene,
} from "@/lib/photo-scene-inference";
import {
  PREMIUM_PHOTO_SCENES,
  SUGGESTIVE_PHOTO_TERMS,
} from "@/lib/photo-intent-validation";
import { type InfluencerGender } from "@/lib/photo-niche-defaults";
import { pickLooksForIntent } from "@/lib/photo-studio-agent";
import {
  applyStudioLook,
  getOutfitOptionsForLook,
} from "@/lib/photo-studio-looks";
import { clampPremiumNsfwLevel } from "@/lib/premium-content";
import {
  mergePhotoParamsWithUserIntent,
  resolvePhotoUserIntent,
  extractOutfitFromUserPrompt,
} from "@/lib/photo-intent-resolver";

export { extractOutfitFromUserPrompt };

export type PromptComposeInput = {
  prompt: string;
  gender: InfluencerGender;
  influencerIsNsfw: boolean;
  hasNsfwPlan: boolean;
};

/** Pick SFW vs NSFW from prompt + influencer — no manual lane picker. */
export function inferContentModeFromPrompt(
  prompt: string,
  opts: Pick<PromptComposeInput, "influencerIsNsfw" | "hasNsfwPlan">
): "SFW" | "NSFW" {
  const text = prompt.trim();
  if (!opts.hasNsfwPlan) return "SFW";
  if (opts.influencerIsNsfw) return "NSFW";
  if (
    SUGGESTIVE_PHOTO_TERMS.test(text) ||
    PREMIUM_PHOTO_SCENES.test(text)
  ) {
    return "NSFW";
  }
  return "SFW";
}

function scoreOutfitForPrompt(outfit: string, prompt: string): number {
  const words = prompt
    .toLowerCase()
    .split(/[\s,;.!?]+/)
    .filter((w) => w.length > 3);
  const lower = outfit.toLowerCase();
  return words.reduce((acc, w) => (lower.includes(w) ? acc + 2 : acc), 0);
}

export function pickOutfitFromPrompt(
  prompt: string,
  options: string[]
): string | undefined {
  if (!options.length) return undefined;
  const scored = options
    .map((outfit) => ({ outfit, score: scoreOutfitForPrompt(outfit, prompt) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score && scored[0].score > 0) return scored[0].outfit;
  return options[0];
}

function inferNsfwLevel(prompt: string): PhotoParams["nsfwLevel"] {
  if (/\b(explicit|explicite|hardcore|nude|nu\b|topless)\b/i.test(prompt)) {
    return "explicit";
  }
  if (/\b(soft|provocat|sensuel|sexy|décolleté)\b/i.test(prompt)) {
    return "soft";
  }
  return "suggestive";
}

export function inferLightingFromPrompt(prompt: string): string | null {
  const p = prompt.toLowerCase();

  if (
    p.includes("blue hour") ||
    p.includes("crépuscule") ||
    p.includes("dusk") ||
    (p.includes("bleu") && p.includes("ciel")) ||
    p.includes("twilight") ||
    p.includes("après coucher") ||
    p.includes("heure bleue") ||
    p.includes("urban night") ||
    p.includes("ville la nuit") ||
    p.includes("paris by night") ||
    p.includes("street at night")
  ) {
    return "blue_hour";
  }

  if (
    p.includes("neon") ||
    p.includes("night") ||
    p.includes("nuit") ||
    p.includes("lumière violette") ||
    p.includes("purple light") ||
    p.includes("néon") ||
    p.includes("club") ||
    p.includes("bar ") ||
    p.includes("lampe") ||
    p.includes("bougie") ||
    p.includes("candle") ||
    p.includes("boudoir") ||
    p.includes("sombre") ||
    p.includes("dark room") ||
    p.includes("dim light") ||
    p.includes("lumière tamisée")
  ) {
    return "neon";
  }

  if (
    p.includes("golden hour") ||
    p.includes("coucher de soleil") ||
    p.includes("sunset") ||
    p.includes("lumière dorée") ||
    p.includes("golden light") ||
    p.includes("warm light") ||
    p.includes("lumière chaude") ||
    p.includes("terrace") ||
    p.includes("terrasse") ||
    p.includes("rooftop") ||
    p.includes("plage") ||
    p.includes("beach") ||
    (p.includes("matin") && p.includes("douce")) ||
    p.includes("morning light") ||
    p.includes("warm glow")
  ) {
    return "golden_hour";
  }

  if (
    p.includes("natural light") ||
    p.includes("lumière naturelle") ||
    p.includes("fenêtre") ||
    p.includes("window light") ||
    p.includes("daylight") ||
    p.includes("jour") ||
    p.includes("lumière du jour") ||
    p.includes("bright") ||
    p.includes("sunny") ||
    p.includes("ensoleillé")
  ) {
    return "natural";
  }

  return null;
}

export function inferPhotoStyleFromPrompt(
  prompt: string,
  contentMode: string
): string | null {
  const p = prompt.toLowerCase();

  if (contentMode === "NSFW") {
    if (
      p.includes("cinematic") ||
      p.includes("film") ||
      p.includes("movie") ||
      p.includes("cinématique") ||
      p.includes("dramatique") ||
      p.includes("dramatic") ||
      p.includes("boudoir") ||
      p.includes("dark") ||
      p.includes("sombre")
    ) {
      return "cinematic";
    }
    return "natural";
  }

  if (
    p.includes("cinematic") ||
    p.includes("cinématique") ||
    p.includes("film") ||
    p.includes("movie") ||
    p.includes("dramatic") ||
    p.includes("dramatique") ||
    p.includes("rooftop") ||
    p.includes("coucher de soleil") ||
    p.includes("sunset") ||
    p.includes("moody")
  ) {
    return "cinematic";
  }

  if (
    p.includes("editorial") ||
    p.includes("fashion") ||
    p.includes("vogue") ||
    p.includes("magazine") ||
    p.includes("mode") ||
    p.includes("lookbook") ||
    p.includes("chic") ||
    p.includes("élégant") ||
    p.includes("elegant") ||
    p.includes("restaurant") ||
    p.includes("café") ||
    p.includes("cafe")
  ) {
    return "editorial";
  }

  if (
    p.includes("vintage") ||
    p.includes("rétro") ||
    p.includes("retro") ||
    p.includes("film grain") ||
    p.includes("analog") ||
    p.includes("polaroid") ||
    p.includes("90s") ||
    p.includes("années 90") ||
    p.includes("y2k")
  ) {
    return "vintage";
  }

  if (
    p.includes("hdr") ||
    p.includes("vivid") ||
    p.includes("vibrant") ||
    p.includes("saturé") ||
    p.includes("contrasté") ||
    p.includes("high contrast")
  ) {
    return "hdr";
  }

  if (
    p.includes("street") ||
    p.includes("urban") ||
    p.includes("urbain") ||
    p.includes("rue") ||
    p.includes("city") ||
    p.includes("ville")
  ) {
    return "street_style";
  }

  return null;
}

/**
 * Turn a single natural-language prompt into photo params.
 * Routing (social vs premium model) stays server-side; we only set contentMode.
 */
export function composePhotoParamsFromPrompt(
  input: PromptComposeInput
): Partial<PhotoParams> {
  const prompt = input.prompt.trim();
  const userIntent = resolvePhotoUserIntent(prompt);
  const contentMode = inferContentModeFromPrompt(prompt, input);
  const looks = pickLooksForIntent(prompt, 1, contentMode);
  const lookId =
    looks[0]?.id ??
    (contentMode === "NSFW" ? "boudoir-bedroom" : "cafe-aesthetic");
  const base = applyStudioLook(lookId, input.gender, prompt, contentMode);
  const outfitOptions = getOutfitOptionsForLook(lookId, input.gender);

  const outfit = userIntent.outfit
    ? userIntent.outfit
    : pickOutfitFromPrompt(prompt, outfitOptions) ??
      base.outfit ??
      outfitOptions[0] ??
      "";

  const sceneInput = {
    scene: "custom",
    sceneDescription: userIntent.sceneDescription,
  };
  const pose = inferPoseFromScene(sceneInput, base.pose);
  const expression = inferExpressionFromSceneAndOutfit(
    prompt,
    outfit,
    base.expression ?? "natural"
  );

  const inferredLighting = inferLightingFromPrompt(prompt);
  const inferredStyle = inferPhotoStyleFromPrompt(prompt, contentMode);

  return mergePhotoParamsWithUserIntent(
    base,
    userIntent,
    {
      lookId,
      contentMode,
      timeOfDay: inferredLighting ?? base.timeOfDay ?? "natural",
      photoStyle: inferredStyle ?? base.photoStyle ?? "natural",
      nsfwLevel:
        contentMode === "NSFW"
          ? clampPremiumNsfwLevel(inferNsfwLevel(prompt))
          : base.nsfwLevel,
      outfit,
      pose,
      expression,
      scene: "custom",
      sceneDescription: userIntent.sceneDescription,
      sceneDetail: userIntent.sceneDescription,
      customPrompt: "",
      instagramShot: contentMode === "SFW",
      useFaceReference: contentMode === "SFW",
      sceneFirst: false,
    }
  );
}
