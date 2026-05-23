/**
 * Human-readable photo context for captions, hashtags, and pre-generation preview.
 */

import {
  inferSceneContext,
  usesMirrorPose,
  type PhotoScenePoseInput,
} from "@/lib/photo-scene-pose";

export type PhotoContentContextInput = PhotoScenePoseInput & {
  pose: string;
  outfit?: string;
  expression?: string;
  photoStyle?: string;
  timeOfDay?: string;
  location?: string;
  customPrompt?: string;
  contentMode?: "SFW" | "NSFW";
  nsfwLevel?: string;
};

const POSE_LABELS_FR: Record<string, string> = {
  portrait: "Portrait (buste / selfie)",
  fullBody: "Plein corps (fit check)",
  selfie: "Selfie miroir",
  action: "En mouvement (marche)",
  candid: "Candid spontané",
};

const POSE_LABELS_EN: Record<string, string> = {
  portrait: "Portrait (close-up / selfie)",
  fullBody: "Full body (fit check)",
  selfie: "Mirror selfie",
  action: "In motion (walking)",
  candid: "Candid spontaneous",
};

const EXPRESSION_LABELS_FR: Record<string, string> = {
  smile: "grand sourire",
  seductive: "regard séducteur",
  serious: "cool / sérieux",
  mysterious: "pensif",
  playful: "rire",
  natural: "naturel / détendu",
};

const STYLE_LABELS_FR: Record<string, string> = {
  natural: "naturel iPhone",
  editorial: "éditorial",
  cinematic: "cinématique",
  vintage: "vintage",
  hdr: "HDR",
};

const LIGHTING_LABELS_FR: Record<string, string> = {
  golden_hour: "golden hour",
  natural: "lumière naturelle",
  blue_hour: "blue hour",
  neon: "néons / nuit",
};

function label(
  map: Record<string, string>,
  key: string | undefined,
  fallback: string
): string {
  if (!key) return fallback;
  return map[key] ?? key;
}

/**
 * Rich description for caption/hashtag LLM — matches what the user configured.
 */
export function buildPhotoContentDescription(
  input: PhotoContentContextInput,
  language: "fr" | "en" = "fr"
): string {
  const sceneText = input.sceneDescription?.trim();
  const context = inferSceneContext(input);
  const poseLabel =
    language === "fr"
      ? label(POSE_LABELS_FR, input.pose, input.pose)
      : label(POSE_LABELS_EN, input.pose, input.pose);

  const lines: string[] = [];

  const isPremium = input.contentMode === "NSFW";

  if (language === "fr") {
    lines.push(
      isPremium
        ? "Type de contenu : photo OnlyFans / Premium (suggestif, lingerie ou boudoir, pas de nudité explicite)."
        : "Type de contenu : photo Instagram/TikTok (influenceuse)."
    );
    if (isPremium) {
      lines.push(
        `Intensité : ${input.nsfwLevel === "soft" ? "boudoir doux" : "lingerie suggestif"}.`
      );
    }
    if (sceneText) {
      lines.push(`Lieu et ambiance (exactement ce qui doit apparaître) : ${sceneText}`);
    }
    if (input.location?.trim()) {
      lines.push(`Repère visible : ${input.location.trim()}`);
    }
    lines.push(`Pose : ${poseLabel}${usesMirrorPose(input.pose, context) ? " (avec miroir cohérent)" : context === "outdoor" ? " (en extérieur, sans miroir)" : ""}`);
    if (input.outfit?.trim()) {
      lines.push(`Tenue portée : ${input.outfit.trim()}`);
    }
    lines.push(
      `Expression : ${label(EXPRESSION_LABELS_FR, input.expression, input.expression ?? "naturelle")}`
    );
    lines.push(
      `Style photo : ${label(STYLE_LABELS_FR, input.photoStyle, "naturel")}, éclairage : ${label(LIGHTING_LABELS_FR, input.timeOfDay, "naturel")}`
    );
    if (input.customPrompt?.trim()) {
      lines.push(`Détails supplémentaires : ${input.customPrompt.trim()}`);
    }
    lines.push(
      "La caption doit décrire cette scène précise (lieu, activité, tenue, humeur) — pas un autre contexte générique."
    );
  } else {
    lines.push(
      isPremium
        ? "Content type: OnlyFans / Premium photo (suggestive lingerie/boudoir, not explicit nudity)."
        : "Content type: Instagram/TikTok influencer photo."
    );
    if (isPremium) {
      lines.push(`Intensity: ${input.nsfwLevel === "soft" ? "soft boudoir" : "suggestive lingerie"}.`);
    }
    if (sceneText) {
      lines.push(`Setting and mood (must match the image): ${sceneText}`);
    }
    if (input.location?.trim()) {
      lines.push(`Landmark: ${input.location.trim()}`);
    }
    lines.push(`Pose: ${poseLabel}`);
    if (input.outfit?.trim()) {
      lines.push(`Outfit: ${input.outfit.trim()}`);
    }
    lines.push(`Expression: ${input.expression ?? "natural"}`);
    lines.push(`Photo style: ${input.photoStyle ?? "natural"}, lighting: ${input.timeOfDay ?? "natural"}`);
    if (input.customPrompt?.trim()) {
      lines.push(`Extra details: ${input.customPrompt.trim()}`);
    }
    lines.push("The caption must match this exact scene — not a generic unrelated post.");
  }

  return lines.join("\n");
}

export type GenerationPreviewLine = {
  key: string;
  value: string;
};

/** Structured preview rows for the photo creator UI. */
export function buildGenerationPreviewLines(
  input: PhotoContentContextInput
): GenerationPreviewLine[] {
  const context = inferSceneContext(input);
  const sceneText =
    input.sceneDescription?.trim() ||
    (input.scene && input.scene !== "custom" ? input.scene : "—");

  const poseLabel = label(POSE_LABELS_FR, input.pose, input.pose);
  let poseNote = "";
  if (context === "outdoor" && ["portrait", "fullBody", "selfie"].includes(input.pose)) {
    poseNote = " (version extérieur, sans miroir)";
  } else if (usesMirrorPose(input.pose, context)) {
    poseNote = " (miroir cohérent avec le lieu)";
  }

  const lines: GenerationPreviewLine[] = [
    { key: "scene", value: sceneText },
    { key: "pose", value: `${poseLabel}${poseNote}` },
  ];

  if (input.location?.trim()) {
    lines.push({ key: "location", value: input.location.trim() });
  }
  if (input.outfit?.trim()) {
    lines.push({ key: "outfit", value: input.outfit.trim() });
  }
  lines.push({
    key: "expression",
    value: label(EXPRESSION_LABELS_FR, input.expression, "naturelle"),
  });
  lines.push({
    key: "style",
    value: `${label(STYLE_LABELS_FR, input.photoStyle, "naturel")} · ${label(LIGHTING_LABELS_FR, input.timeOfDay, "naturel")}`,
  });
  if (input.customPrompt?.trim()) {
    lines.push({ key: "extra", value: input.customPrompt.trim() });
  }

  return lines;
}
