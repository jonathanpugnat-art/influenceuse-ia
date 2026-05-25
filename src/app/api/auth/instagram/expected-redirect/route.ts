import { NextResponse } from "next/server";
import {
  buildAlternateInstagramRedirectUris,
  getAppUrl,
  getInstagramOAuthRedirectUri,
} from "@/lib/app-url";

/**
 * GET /api/auth/instagram/expected-redirect
 * Public: exact OAuth redirect URI(s) Aura sends to Meta (for dashboard copy-paste).
 */
export async function GET() {
  const redirectUri = getInstagramOAuthRedirectUri();
  const hasCredentials = Boolean(
    (process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID) &&
      (process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET)
  );

  return NextResponse.json(
    {
      redirectUri,
      alternateRedirectUris: buildAlternateInstagramRedirectUris(redirectUri),
      appUrl: getAppUrl(),
      credentialsConfigured: hasCredentials,
      facebookLoginConfigIdSet: Boolean(process.env.FACEBOOK_LOGIN_CONFIG_ID),
      metaChecklist: [
        "Paramètres de l'app → De base → Domaines de l'app : aurainfluenceai.com",
        "Facebook Login for Business → Paramètres → URI de redirection OAuth valides (liste EN HAUT, pas seulement le validateur)",
        "Ajouter redirectUri + alternateRedirectUris ci-dessus, puis Enregistrer",
        "Rôles → Testeur : ton compte Facebook (app en Développement)",
        "Vercel : INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, NEXT_PUBLIC_APP_URL puis Redeploy",
        "Si Login for Business : Configurations → config Instagram → noter config_id → FACEBOOK_LOGIN_CONFIG_ID sur Vercel",
      ],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
