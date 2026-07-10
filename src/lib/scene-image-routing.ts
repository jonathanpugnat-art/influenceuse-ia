import { LORA_DEFAULT_SCALE } from "@/lib/lora";
import type { TrendPromptContext } from "@/lib/trends/trend-format-brief";

export type SceneEnvironment = "indoor" | "outdoor" | "mixed" | "unknown";

export type SceneRoute = {
  environment: SceneEnvironment;
  loraScale: number;
  img2imgStrength: number;
  negativeSceneTerms: string[];
  /** When true, skip Flux LoRA and use Kontext/Nano (A/B or complex scenes). */
  preferKontextOverLora: boolean;
  mirrorSelfie: boolean;
};

const OUTDOOR_SIGNAL_RE =
  /\b(beach|plage|ocean|mer|sea|sunset|sunrise|golden hour|golden-hour|rooftop|street|sidewalk|terrace|terrasse|park|forest|forêt|nature|mountain|montagne|outdoor|outside|sky|ciel|sand|sable|palm|jardin|garden|boardwalk|promenade)\b/i;

const INDOOR_SIGNAL_RE =
  /\b(indoor|inside|intérieur|bedroom|chambre|bathroom|salle de bain|locker|vestiaire|dressing|closet|gym\b|fitness center|studio\b|kitchen|cuisine|living room|salon|office|bureau|hotel room|chambre d'hôtel|fluorescent|locker room|mirror.*gym|gym.*mirror)\b/i;

const MIRROR_SIGNAL_RE = /\b(mirror|miroir)\b/i;

const NIGHT_SIGNAL_RE =
  /\b(at night|nighttime|night time|nuit|midnight|after dark|city lights at night|neon at night)\b/i;

const ANTI_OUTDOOR_TERMS = [
  "outdoor",
  "beach",
  "ocean",
  "sand",
  "sky",
  "trees",
  "field",
  "sunset",
  "golden hour",
  "palm trees",
  "mountains",
  "terrace café",
] as const;

const ANTI_INDOOR_TERMS = [
  "indoor",
  "bedroom",
  "bathroom",
  "locker room",
  "gym interior",
  "fluorescent office",
  "living room",
  "kitchen",
  "closet",
] as const;

function sceneEnumHint(scene?: string): SceneEnvironment | null {
  if (!scene?.trim()) return null;
  const key = scene.trim().toLowerCase();
  if (
    key === "beach" ||
    key === "nature" ||
    key === "rooftop" ||
    key === "urban" ||
    key === "pool"
  ) {
    return "outdoor";
  }
  if (
    key === "bedroom" ||
    key === "gym" ||
    key === "restaurant" ||
    key === "cafe" ||
    key === "studio"
  ) {
    return "indoor";
  }
  return null;
}

function detectEnvironment(text: string, scene?: string): SceneEnvironment {
  const outdoor = OUTDOOR_SIGNAL_RE.test(text);
  const indoor = INDOOR_SIGNAL_RE.test(text);
  if (outdoor && indoor) return "mixed";
  if (outdoor) return "outdoor";
  if (indoor) return "indoor";
  return sceneEnumHint(scene) ?? "unknown";
}

function collectSceneText(opts: {
  scene?: string;
  sceneDescription?: string;
  customPrompt?: string;
  trendBrief?: TrendPromptContext["brief"];
}): string {
  return [
    opts.sceneDescription,
    opts.customPrompt,
    opts.trendBrief?.lighting,
    opts.trendBrief?.cameraStyle,
    opts.trendBrief?.mood,
    opts.trendBrief?.inspirationNotes,
    opts.scene,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");
}

/**
 * Heuristic routing for LoRA hybrid vs Kontext and scene-specific negatives.
 * Keeps trained identity without letting LoRA bias overwrite indoor/outdoor briefs.
 */
export function resolveSceneRoute(opts: {
  scene?: string;
  sceneDescription?: string;
  customPrompt?: string;
  pose?: string;
  trendBrief?: TrendPromptContext["brief"];
  hasLora?: boolean;
}): SceneRoute {
  const text = collectSceneText(opts);
  const environment = detectEnvironment(text, opts.scene);
  const mirrorSelfie =
    MIRROR_SIGNAL_RE.test(text) || opts.pose === "selfie";

  let loraScale = LORA_DEFAULT_SCALE;
  let img2imgStrength = 0.82;
  const negativeSceneTerms: string[] = [];
  let preferKontextOverLora = false;

  switch (environment) {
    case "indoor":
      negativeSceneTerms.push(...ANTI_OUTDOOR_TERMS);
      loraScale = 0.72;
      if (mirrorSelfie) {
        negativeSceneTerms.push("outdoor terrace", "beach background");
        loraScale = 0.68;
        img2imgStrength = 0.8;
      }
      break;
    case "outdoor":
      negativeSceneTerms.push(...ANTI_INDOOR_TERMS);
      loraScale = 0.78;
      if (NIGHT_SIGNAL_RE.test(text)) {
        negativeSceneTerms.push(
          "golden hour",
          "sunset",
          "daylight",
          "morning light",
          "warm afternoon sun"
        );
        loraScale = 0.7;
      }
      break;
    case "mixed":
      loraScale = 0.7;
      img2imgStrength = 0.78;
      break;
    default:
      loraScale = LORA_DEFAULT_SCALE;
  }

  if (opts.hasLora && opts.trendBrief) {
    loraScale = Math.min(loraScale, 0.72);
  }

  if (
    process.env.LORA_SKIP_COMPLEX_SCENES === "true" &&
    (environment !== "unknown" || mirrorSelfie)
  ) {
    preferKontextOverLora = true;
  }

  return {
    environment,
    loraScale,
    img2imgStrength,
    negativeSceneTerms: [...new Set(negativeSceneTerms)],
    preferKontextOverLora,
    mirrorSelfie,
  };
}

export function appendSceneNegativeTerms(
  baseNegative: string,
  terms: string[]
): string {
  if (!terms.length) return baseNegative;
  const suffix = terms.join(", ");
  return baseNegative.trim() ? `${baseNegative.trim()}, ${suffix}` : suffix;
}
