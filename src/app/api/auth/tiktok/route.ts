import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { encrypt } from "@/lib/encryption";
import * as tiktok from "@/server/services/tiktok.service";
import { defaultLocale } from "@/i18n";
import { getAppUrl } from "@/lib/app-url";
import { verifySignedOAuthState } from "@/lib/oauth-state";

const APP_URL = getAppUrl();

/**
 * GET /api/auth/tiktok
 * Callback OAuth TikTok : ?code=...&state=<signed state>
 * Vérifie le state signé (anti-CSRF), échange le code, chiffre les tokens,
 * sauvegarde dans SocialAccount, redirige.
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

  if (error) {
    const errorDesc = searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/${defaultLocale}/influencers?tiktok_error=${encodeURIComponent(errorDesc)}`, APP_URL)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}/influencers?tiktok_error=missing_code_or_state`, APP_URL)
    );
  }

  const redirectUri = `${APP_URL}/api/auth/tiktok`;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}/influencers?tiktok_error=user_not_found`, APP_URL)
    );
  }

  const influencerId = verifySignedOAuthState(state, user.id);
  if (!influencerId) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}/influencers?tiktok_error=invalid_state`, APP_URL)
    );
  }

  const influencer = await db.influencer.findUnique({
    where: { id: influencerId },
  });
  if (!influencer || influencer.userId !== user.id) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}/influencers?tiktok_error=invalid_influencer`, APP_URL)
    );
  }

  try {
    const data = await tiktok.exchangeCode(code, redirectUri);
    const encryptedAccess = encrypt(data.accessToken);
    const encryptedRefresh = data.refreshToken ? encrypt(data.refreshToken) : null;

    // Best-effort creator_info snapshot so the composer can render the
    // right privacy options immediately after connect. If it fails (e.g.
    // rate limit) we still save the account — the composer will retry
    // via the tRPC procedure.
    let privacyOptions: string[] | undefined;
    try {
      const creator = await tiktok.queryCreatorInfo(data.accessToken);
      privacyOptions = creator.privacyLevelOptions;
    } catch (err) {
      console.warn(
        `[oauth/tiktok] creator_info failed on connect: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    await db.socialAccount.upsert({
      where: {
        influencerId_platform: { influencerId, platform: "TIKTOK" },
      },
      create: {
        influencerId,
        platform: "TIKTOK",
        username: data.username ?? "tiktok",
        platformUserId: data.openId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: data.expiresAt,
        scopes: data.scopes,
        privacyOptions: privacyOptions ?? undefined,
        isConnected: true,
      },
      update: {
        username: data.username ?? undefined,
        platformUserId: data.openId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: data.expiresAt,
        scopes: data.scopes,
        privacyOptions: privacyOptions ?? undefined,
        isConnected: true,
      },
    });

    return NextResponse.redirect(
      new URL(`/${defaultLocale}/influencers/${influencerId}?tab=social&tiktok=connected`, APP_URL)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(
        `/${defaultLocale}/influencers/${influencerId}?tab=social&tiktok_error=${encodeURIComponent(message)}`,
        APP_URL
      )
    );
  }
}
