import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n";

const intlMiddleware = createMiddleware(routing);

const hasClerkKeys = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/fr" || pathname === "/en") return true;
  if (/^\/(fr|en)\/sign-(in|up)/.test(pathname)) return true;
  if (/^\/(fr|en)\/home\b/.test(pathname)) return true;
  if (/^\/(fr|en)\/preview\/landing-premium\b/.test(pathname)) return true;
  if (/^\/(fr|en)\/changelog\b/.test(pathname)) return true;
  if (/^\/(fr|en)\/pricing\b/.test(pathname)) return true;
  // Sprint 14 — legal pages must be reachable without auth so Meta /
  // Stripe / Clerk can scrape them during App Review and so any user
  // (signed-in or not) can read them from the marketing footer.
  if (/^\/(fr|en)\/(privacy|terms|data-deletion)\b/.test(pathname)) return true;
  // Same routes without a locale prefix (Meta scrapes the bare URL).
  if (
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/data-deletion"
  ) {
    return true;
  }
  if (pathname.startsWith("/api/webhooks")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  // Sprint 9 — public REST API (uses its own Bearer token auth).
  if (pathname.startsWith("/api/public/")) return true;
  // Health check for monitoring.
  if (pathname === "/api/health") return true;
  return false;
}

export default hasClerkKeys
  ? clerkMiddleware(async (_auth, req: NextRequest) => {
      if (isApiRoute(req.nextUrl.pathname)) {
        return NextResponse.next();
      }
      if (!isPublicPath(req.nextUrl.pathname)) {
        await _auth.protect();
      }
      return intlMiddleware(req);
    })
  : (req: NextRequest) => {
      if (isApiRoute(req.nextUrl.pathname)) {
        return NextResponse.next();
      }
      return intlMiddleware(req);
    };

export const config = {
  matcher: [
    "/((?!_next/|favicon\\.ico|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
