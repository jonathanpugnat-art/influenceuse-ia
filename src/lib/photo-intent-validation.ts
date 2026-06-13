/**
 * Validates photo generation params for semantic coherence before API call.
 */

export type PhotoIntentIssue = {
  code: "suggestive_in_social" | "scene_outfit_mismatch" | "missing_outfit";
  severity: "warning" | "error";
  messageFr: string;
  messageEn: string;
  suggestedLane?: "premium" | "social";
};

const SUGGESTIVE_TERMS =
  /\b(lingerie|boudoir|dentelle|lace lingerie|sexy|sensuel|séduis|seductive|provocat|nu\b|nude|topless|bikini|underwear|sous-vêtement)\b/i;

const SOCIAL_SCENES =
  /\b(café|cafe|coffee|restaurant|street|rue|gym|sport|plage|beach|airport|aéroport|office|bureau|park|parc)\b/i;

const PREMIUM_SCENES =
  /\b(bedroom|chambre|boudoir|intimate|intime|silk sheets|draps|mirror selfie miroir chambre)\b/i;

const PREMIUM_OUTFITS =
  /\b(lingerie|body satin|dentelle|lace|robe de chambre|bustier|bra and panties|ensemble boudoir)\b/i;

const SOCIAL_OUTFITS =
  /\b(jean|casual|sweat|hoodie|blazer street|sport|gym|crop top and jeans|t-shirt)\b/i;

export function validatePhotoIntent(input: {
  contentMode: "SFW" | "NSFW";
  sceneDescription?: string;
  outfit?: string;
  scene?: string;
  locale?: "fr" | "en";
}): PhotoIntentIssue[] {
  const issues: PhotoIntentIssue[] = [];
  const scene = `${input.sceneDescription ?? ""} ${input.scene ?? ""}`.trim();
  const outfit = (input.outfit ?? "").trim();
  const locale = input.locale ?? "fr";

  if (!outfit) {
    issues.push({
      code: "missing_outfit",
      severity: "error",
      messageFr: "Une tenue est requise pour générer la photo.",
      messageEn: "An outfit is required to generate the photo.",
    });
  }

  const hasSuggestive =
    SUGGESTIVE_TERMS.test(scene) || SUGGESTIVE_TERMS.test(outfit);

  if (input.contentMode === "SFW" && hasSuggestive) {
    issues.push({
      code: "suggestive_in_social",
      severity: "warning",
      messageFr:
        "Contenu suggestif détecté en mode Social — le rendu peut être adapté pour Instagram. Passe en mode Premium pour garder l'intention.",
      messageEn:
        "Suggestive content detected in Social mode — output may be adapted for Instagram. Switch to Premium to preserve intent.",
      suggestedLane: "premium",
    });
  }

  if (
    input.contentMode === "SFW" &&
    PREMIUM_OUTFITS.test(outfit) &&
    SOCIAL_SCENES.test(scene)
  ) {
    issues.push({
      code: "scene_outfit_mismatch",
      severity: "warning",
      messageFr:
        "Tenue suggestive avec une scène lifestyle — résultat probablement incohérent. Ajuste la scène ou passe en Premium.",
      messageEn:
        "Suggestive outfit with a lifestyle scene — result may be inconsistent. Adjust the scene or switch to Premium.",
      suggestedLane: "premium",
    });
  }

  if (
    input.contentMode === "NSFW" &&
    SOCIAL_OUTFITS.test(outfit) &&
    PREMIUM_SCENES.test(scene) === false &&
    SOCIAL_SCENES.test(scene)
  ) {
    issues.push({
      code: "scene_outfit_mismatch",
      severity: "warning",
      messageFr:
        "Tenue casual en mode Premium — envisage une scène boudoir ou une tenue plus adaptée.",
      messageEn:
        "Casual outfit in Premium mode — consider a boudoir scene or more fitting outfit.",
      suggestedLane: "premium",
    });
  }

  return issues.map((issue) => issue);
}

export function getPhotoIntentMessage(
  issue: PhotoIntentIssue,
  locale: "fr" | "en"
): string {
  return locale === "fr" ? issue.messageFr : issue.messageEn;
}
