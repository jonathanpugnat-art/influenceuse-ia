import { defaultLocale } from "@/i18n";

/**
 * Messages utilisateur pour les erreurs OAuth / connexion Instagram (Meta).
 */

const META_PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /service.?indisponible|temporarily unavailable|not available|isn'?t available/i,
    message:
      "Meta affiche « service indisponible » : l’app Facebook est souvent en mode Développement (seuls admin/testeurs peuvent se connecter), la vérification Business est incomplète, ou ton compte Facebook doit être confirmé. Voir la checklist ci-dessous.",
  },
  {
    test: /access_denied|user denied|cancelled/i,
    message: "Connexion annulée. Tu peux réessayer quand tu veux.",
  },
  {
    test: /NO_FB_PAGE/i,
    message:
      "Aucune Page Facebook trouvée. Crée une Page (même vide), puis lie-la à Instagram : Paramètres Instagram → Compte → Liens → Facebook.",
  },
  {
    test: /NO_IG_BUSINESS/i,
    message:
      "Aucun Instagram Professionnel lié à ta Page. Passe ton compte en Business ou Creator et relie-le à la Page Facebook.",
  },
  {
    test: /INSTAGRAM_APP_ID|non configuré/i,
    message:
      "La connexion Instagram n’est pas configurée côté serveur (clés Meta manquantes). Contacte le support Aura.",
  },
];

export function formatInstagramOAuthError(raw: string): string {
  const decoded = decodeURIComponent(raw).trim();
  for (const { test, message } of META_PATTERNS) {
    if (test.test(decoded)) return message;
  }
  if (decoded.length > 200) {
    return "Erreur Meta lors de la connexion. Consulte la checklist Meta ci-dessous.";
  }
  return decoded;
}

export function instagramSocialRedirectUrl(
  appUrl: string,
  influencerId: string | null,
  query: Record<string, string | undefined>
): URL {
  // App routes live under /fr/... (localePrefix: "always")
  const path = influencerId
    ? `${appUrl}/${defaultLocale}/influencers/${influencerId}`
    : `${appUrl}/${defaultLocale}/influencers`;
  const url = new URL(path);
  if (influencerId) url.searchParams.set("tab", "social");
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url;
}
