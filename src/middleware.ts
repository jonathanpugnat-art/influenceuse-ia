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
  if (pathname.startsWith("/api/webhooks")) return true;
  if (pathname.startsWith("/api/cron")) return true;
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
