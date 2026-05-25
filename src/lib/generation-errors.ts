/**
 * Turn raw Replicate / storage / config errors into short French messages
 * for the photo/reel preview UI.
 */
export function formatGenerationErrorForUser(raw: string | null | undefined): string {
  if (!raw?.trim()) {
    return "La génération a échoué. Réessayez ou modifiez la scène.";
  }

  const msg = raw.trim();

  if (msg.includes("REPLICATE_API_TOKEN")) {
    return "Replicate n'est pas configuré sur le serveur (REPLICATE_API_TOKEN manquant).";
  }

  if (
    msg.includes("Crédits insuffisants") ||
    msg.toLowerCase().includes("insufficient credit")
  ) {
    return msg;
  }

  if (isContentSafetyFilterError(msg)) {
    return NSFW_USER_MESSAGE;
  }

  if (/localhost|127\.0\.0\.1/i.test(msg) || msg.includes(LOCALHOST_REF_MESSAGE)) {
    return LOCALHOST_REF_MESSAGE;
  }

  if (/invalid.*url|cannot extract url|422|failed to download|fetch.*image/i.test(msg)) {
    return "L'image de référence (portrait) n'est pas accessible par le moteur IA. Regénérez le portrait ou désactivez « Verrouiller le visage ».";
  }

  if (/429|rate.?limit|throttle/i.test(msg)) {
    return "Trop de requêtes vers Replicate. Attendez une minute puis réessayez.";
  }

  if (/5\d\d|service unavailable|gateway timeout/i.test(msg)) {
    return "Replicate est temporairement indisponible. Réessayez dans quelques minutes.";
  }

  if (/R2_PUBLIC_URL|non publique|URL non publique/i.test(msg)) {
    return "Le stockage des images n'expose pas d'URL publique (R2_PUBLIC_URL). Contactez le support ou réessayez sans verrouillage visage.";
  }

  // Strip noisy Error: prefix and Replicate stack blobs
  const cleaned = msg.replace(/^Error:\s*/i, "").slice(0, 280);
  return cleaned.length > 20 ? cleaned : "La génération a échoué. Réessayez.";
}

/** Coaching copy for the scene-first photo step (décor seul). */
export function formatPhotoSceneErrorForUser(
  raw: string | null | undefined
): string {
  const msg = raw?.trim() ?? "";

  if (
    /person|people|face|character|humain|crowd|foule|man|woman|girl|boy/i.test(
      msg
    )
  ) {
    return "Décrivez surtout le lieu (lumière, mobilier, ambiance) sans personnages visibles, puis regénérez le décor (1 crédit).";
  }

  if (isContentSafetyFilterError(msg)) {
    return "Le décor a été filtré. Reformulez en mode éditorial (lieu, lumière, style) sans termes explicites, puis regénérez (1 crédit).";
  }

  if (/429|rate.?limit|throttle/i.test(msg)) {
    return "Beaucoup de générations en cours. Attendez une minute, puis regénérez le décor.";
  }

  if (msg.includes("Crédits insuffisants")) {
    return msg;
  }

  return "Le décor n'a pas donné le résultat espéré. Simplifiez la scène (lieu + lumière), évitez les foules, puis regénérez le décor (1 crédit).";
}

export const NSFW_USER_MESSAGE =
  "Le moteur IA a refusé cette scène (filtre de sécurité). Réessaie en anglais avec des termes « mode / éditorial » : ex. « lace lounge outfit », « bathroom mirror fashion », « fully clothed » — évite les mots explicites.";

/** Google Nano / Replicate E005 and similar moderation blocks. */
export function isContentSafetyFilterError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("nsfw") ||
    lower.includes("safety") ||
    lower.includes("sensitive") ||
    lower.includes("content filtered") ||
    lower.includes("flagged") ||
    /\be005\b/i.test(msg) ||
    msg.includes(NSFW_USER_MESSAGE)
  );
}

export const LOCALHOST_REF_MESSAGE =
  "En développement local, Replicate ne peut pas lire une image hébergée sur localhost. Désactive « Verrouiller le visage » ou configure R2 avec une URL publique (R2_PUBLIC_URL).";

/** Reference portrait must be an absolute http(s) URL reachable by Replicate. */
export function isReplicateAccessibleImageUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(u)) return false;
  return true;
}
