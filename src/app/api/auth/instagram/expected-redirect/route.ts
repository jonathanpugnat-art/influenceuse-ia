import { NextResponse } from "next/server";
import {
  buildAlternateInstagramRedirectUris,
  getAppUrl,
  getInstagramOAuthRedirectUri,
} from "@/lib/app-url";
import {
  getInstagramLoginAppId,
  getInstagramLoginAppIdSource,
  getInstagramLoginAppSecret,
  getInstagramOAuthProvider,
  usesInstagramDirectLogin,
} from "@/lib/instagram-oauth-config";
import * as instagram from "@/server/services/instagram.service";

/**
 * GET /api/auth/instagram/expected-redirect
 * Public: OAuth redirect URI + mode (for Meta dashboard copy-paste).
 */
export async function GET() {
  const redirectUri = getInstagramOAuthRedirectUri();
  const instagramLogin = usesInstagramDirectLogin();
  const hasCredentials = instagramLogin
    ? Boolean(getInstagramLoginAppId() && getInstagramLoginAppSecret())
    : Boolean(
        (process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID) &&
          (process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET)
      );

  let sampleAuthUrl: string | null = null;
  try {
    sampleAuthUrl = instagram.getAuthUrl(redirectUri, "preview");
  } catch {
    sampleAuthUrl = null;
  }

  const metaChecklist = instagramLogin
    ? [
        "Meta → Instagram → API setup with Instagram login → Business login settings",
        `OAuth redirect URIs : ${redirectUri}`,
        "Instagram App ID + Instagram App Secret (section Business login, pas seulement App ID Facebook)",
        "Vercel : INSTAGRAM_OAUTH_MODE=instagram, INSTAGRAM_LOGIN_APP_ID, INSTAGRAM_LOGIN_APP_SECRET (ou INSTAGRAM_APP_ID/SECRET)",
        "Compte Instagram Professionnel requis",
      ]
    : [
        "Facebook Login for Business → Paramètres → URI de redirection OAuth valides",
        `Ajouter : ${redirectUri}`,
        "FACEBOOK_LOGIN_CONFIG_ID sur Vercel si Login for Business",
        "Rôles → Testeur (app en Développement)",
      ];

  const clientId = getInstagramLoginAppId();
  const clientIdSource = getInstagramLoginAppIdSource();
  const instagramLoginIdHint =
    "En mode instagram_login, client_id doit être l’Instagram App ID (Meta → Instagram → Business login settings), pas l’App ID Facebook du tableau de bord principal.";

  return NextResponse.json(
    {
      redirectUri,
      alternateRedirectUris: buildAlternateInstagramRedirectUris(redirectUri),
      appUrl: getAppUrl(),
      oauthMode: getInstagramOAuthProvider(),
      instagramLogin,
      credentialsConfigured: hasCredentials,
      clientId,
      clientIdSource,
      clientIdWarning:
        instagramLogin && clientIdSource !== "INSTAGRAM_LOGIN_APP_ID"
          ? instagramLoginIdHint
          : null,
      sampleAuthUrl,
      facebookLoginConfigIdSet: Boolean(process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim()),
      metaChecklist,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
