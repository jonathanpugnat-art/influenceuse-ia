import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import * as instagram from "@/server/services/instagram.service";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/auth/instagram/start?influencerId=<id>
 *
 * Entry point of the Instagram OAuth flow. Verifies ownership of the
 * influencer, builds the Facebook OAuth dialog URL with the right scopes
 * + state, and redirects the browser. The callback that exchanges the
 * code for tokens lives at /api/auth/instagram (sibling route.ts).
 *
 * Security:
 * - Clerk auth is enforced — anonymous users get bounced to /sign-in
 * - The influencerId is validated against the DB and must belong to the
 *   caller (no IDOR), otherwise the user is redirected with an error
 * - The state passed to Facebook is the influencerId itself. We re-check
 *   ownership on the callback too in case the state was tampered with
 *   between hops (defence in depth)
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", APP_URL));
  }

  const influencerId = req.nextUrl.searchParams.get("influencerId");
  if (!influencerId) {
    return NextResponse.redirect(
      new URL("/influencers?instagram_error=missing_influencer_id", APP_URL)
    );
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.redirect(
      new URL("/influencers?instagram_error=user_not_found", APP_URL)
    );
  }

  const influencer = await db.influencer.findUnique({
    where: { id: influencerId },
    select: { id: true, userId: true },
  });
  if (!influencer || influencer.userId !== user.id) {
    return NextResponse.redirect(
      new URL("/influencers?instagram_error=invalid_influencer", APP_URL)
    );
  }

  try {
    const redirectUri = `${APP_URL}/api/auth/instagram`;
    const authUrl = instagram.getAuthUrl(redirectUri, influencerId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(
        `/influencers/${influencerId}/edit?instagram_error=${encodeURIComponent(message)}`,
        APP_URL
      )
    );
  }
}
