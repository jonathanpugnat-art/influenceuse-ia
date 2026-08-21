/**
 * Turn raw Replicate / storage / config errors into short French messages
 * for the photo/reel preview UI.
 */

export type GenerationErrorContext = {
  contentMode?: "SFW" | "NSFW";
};

/** Social lane — Google Nano / Kontext safety block. */
export const SOCIAL_SAFETY_USER_MESSAGE =
  "Le moteur Social a filtré cette scène. Reformule en anglais, style éditorial mode (ex. « lace lounge outfit », « bathroom mirror fashion ») — ou passe en mode Premium (🔒) pour FLUX uncensored.";

/** Premium lane — FLUX uncensored failure. */
export const PREMIUM_GENERATION_USER_MESSAGE =
  "La génération Premium (FLUX uncensored) a échoué. Vérifie REPLICATE_API_TOKEN et PREMIUM_IMAGE_PROVIDER=replicate. Monte le niveau NSFW (Soft / Explicite) ou reformule si Aura bloque un terme interdit.";

export const SUGGESTIVE_REQUIRES_PREMIUM_MESSAGE =
  "Contenu suggestif en mode Social — passe en mode Premium (🔒) pour générer avec FLUX uncensored (plan Creator requis).";

/**
 * Default-path face-lock failure — surfaced when PuLID (or the Pro/Agency
 * LoRA / Novita InstantID on NSFW) refuses the render for a non-safety
 * reason. We deliberately do NOT fall back to plain T2I here because the
 * user would silently get another person; they need to retry or fix the
 * portrait reference instead.
 */
export const FACE_LOCK_USER_MESSAGE =
  "Le verrouillage du visage a échoué. Réessaie dans quelques instants. Si le problème persiste, régénère le portrait de base de l'influenceuse (onglet Modifier) — Aura refuse volontairement de générer un autre visage en fallback.";

export const MISSING_FACE_REFERENCE_MESSAGE =
  "Aucun portrait de référence disponible pour verrouiller le visage. Termine l'étape « portrait » de l'assistant ou régénère le portrait de base de l'influenceuse.";

/** @deprecated Use SOCIAL_SAFETY_USER_MESSAGE */
export const NSFW_USER_MESSAGE = SOCIAL_SAFETY_USER_MESSAGE;

const PREMIUM_GEN_PREFIX = "[premium-gen]";
const SOCIAL_SAFETY_PREFIX = "[social-safety]";
const FACE_LOCK_PREFIX = "[face-lock]";

export function formatGenerationErrorForUser(
  raw: string | null | undefined,
  opts?: GenerationErrorContext
): string {
  if (!raw?.trim()) {
    return "La génération a échoué. Réessayez ou modifiez la scène.";
  }

  const msg = raw.trim();

  if (msg.startsWith(PREMIUM_GEN_PREFIX)) {
    const detail = msg.slice(PREMIUM_GEN_PREFIX.length).trim();
    return detail.length > 20 ? detail : PREMIUM_GENERATION_USER_MESSAGE;
  }

  if (msg.startsWith(SOCIAL_SAFETY_PREFIX)) {
    return SOCIAL_SAFETY_USER_MESSAGE;
  }

  if (msg.startsWith(FACE_LOCK_PREFIX)) {
    const detail = msg.slice(FACE_LOCK_PREFIX.length).trim();
    if (/no reference|missing.*face|no face reference|MISSING_FACE_REF/i.test(detail)) {
      return MISSING_FACE_REFERENCE_MESSAGE;
    }
    return detail.length > 20
      ? `${FACE_LOCK_USER_MESSAGE} (Détail : ${detail.slice(0, 200)})`
      : FACE_LOCK_USER_MESSAGE;
  }

  if (isReplicateTokenMissingError(msg)) {
    return "Replicate n'est pas configuré sur le serveur (REPLICATE_API_TOKEN manquant). Redémarre le serveur après avoir ajouté la clé dans `.env` ou `.env.local`.";
  }

  if (
    msg.includes("Crédits insuffisants") ||
    msg.toLowerCase().includes("insufficient credit")
  ) {
    return msg;
  }

  if (msg.includes(SUGGESTIVE_REQUIRES_PREMIUM_MESSAGE)) {
    return SUGGESTIVE_REQUIRES_PREMIUM_MESSAGE;
  }

  if (isContentSafetyFilterError(msg)) {
    return opts?.contentMode === "NSFW"
      ? PREMIUM_GENERATION_USER_MESSAGE
      : SOCIAL_SAFETY_USER_MESSAGE;
  }

  if (msg.includes("PremiumPromptBlockedError") || msg.includes("termes interdits")) {
    return msg;
  }

  if (
    msg.includes("PremiumImageModerationError") ||
    msg.includes("contenu trop explicite")
  ) {
    return msg;
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

  if (/Premium image generation is not configured/i.test(msg)) {
    return PREMIUM_GENERATION_USER_MESSAGE;
  }

  if (/Premium image generation requires/i.test(msg)) {
    return PREMIUM_GENERATION_USER_MESSAGE;
  }

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

/** Google Nano / Replicate E005 and similar moderation blocks. */
export function isReplicateTokenMissingError(msg: string): boolean {
  return (
    /REPLICATE_API_TOKEN is not configured/i.test(msg) ||
    /REPLICATE_API_TOKEN is missing/i.test(msg) ||
    /but REPLICATE_API_TOKEN is missing/i.test(msg)
  );
}

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
    msg.includes(SOCIAL_SAFETY_USER_MESSAGE) ||
    msg.includes(SOCIAL_SAFETY_PREFIX)
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

export function throwSocialSafetyError(): never {
  throw new Error(SOCIAL_SAFETY_PREFIX);
}

export function throwPremiumGenerationError(detail?: string): never {
  throw new Error(
    detail?.trim()
      ? `${PREMIUM_GEN_PREFIX} ${detail.trim()}`
      : PREMIUM_GEN_PREFIX
  );
}

/** Face-lock provider (PuLID / LoRA / InstantID) refused — no silent T2I fallback. */
export function throwFaceLockError(detail?: string): never {
  throw new Error(
    detail?.trim() ? `${FACE_LOCK_PREFIX} ${detail.trim()}` : FACE_LOCK_PREFIX
  );
}

export function throwMissingFaceReferenceError(): never {
  throw new Error(`${FACE_LOCK_PREFIX} MISSING_FACE_REF`);
}

export function isFaceLockError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.startsWith(FACE_LOCK_PREFIX);
}
