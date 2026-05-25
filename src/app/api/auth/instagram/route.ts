import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { encrypt } from "@/lib/encryption";
import {
  formatInstagramOAuthError,
  instagramSocialRedirectUrl,
} from "@/lib/instagram-oauth-errors";
import * as instagram from "@/server/services/instagram.service";
import { defaultLocale } from "@/i18n";
import { getAppUrl, getInstagramOAuthRedirectUri } from "@/lib/app-url";

const APP_URL = getAppUrl();

/**
 * GET /api/auth/instagram
 * Callback OAuth Instagram : ?code=...&state=influencerId
 * Échange le code, chiffre les tokens, sauvegarde dans SocialAccount, redirige.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL(`/${defaultLocale}/sign-in`, APP_URL));
  }

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const influencerIdFromState = searchParams.get("state");

  if (error) {
    const errorDesc = searchParams.get("error_description") ?? error;
    const friendly = formatInstagramOAuthError(errorDesc);
    return NextResponse.redirect(
      instagramSocialRedirectUrl(APP_URL, influencerIdFromState, {
        instagram_error: friendly,
      })
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      instagramSocialRedirectUrl(APP_URL, influencerIdFromState, {
        instagram_error: "Connexion interrompue (code ou state manquant). Réessaie.",
      })
    );
  }

  const influencerId = state;
  const redirectUri = getInstagramOAuthRedirectUri();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.redirect(
      instagramSocialRedirectUrl(APP_URL, influencerId, {
        instagram_error: "Session expirée. Reconnecte-toi à Aura puis réessaie.",
      })
    );
  }

  const influencer = await db.influencer.findUnique({
    where: { id: influencerId },
  });
  if (!influencer || influencer.userId !== user.id) {
    return NextResponse.redirect(
      instagramSocialRedirectUrl(APP_URL, influencerId, {
        instagram_error: "Profil influenceuse invalide.",
      })
    );
  }

  try {
    const data = await instagram.exchangeCode(code, redirectUri);
    const encryptedAccess = encrypt(data.accessToken);
    const encryptedRefresh = data.refreshToken ? encrypt(data.refreshToken) : null;

    await db.socialAccount.upsert({
      where: {
        influencerId_platform: { influencerId, platform: "INSTAGRAM" },
      },
      create: {
        influencerId,
        platform: "INSTAGRAM",
        username: data.username ?? "instagram",
        platformUserId: data.igUserId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: data.expiresAt,
        isConnected: true,
      },
      update: {
        username: data.username ?? undefined,
        platformUserId: data.igUserId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: data.expiresAt,
        isConnected: true,
      },
    });

    return NextResponse.redirect(
      instagramSocialRedirectUrl(APP_URL, influencerId, { instagram: "connected" })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const friendly = formatInstagramOAuthError(message);
    return NextResponse.redirect(
      instagramSocialRedirectUrl(APP_URL, influencerId, { instagram_error: friendly })
    );
  }
}
