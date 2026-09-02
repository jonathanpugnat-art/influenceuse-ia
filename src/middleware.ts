import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n";
import { isIntlBypassPath, isPublicPath } from "@/lib/public-paths";

const intlMiddleware = createMiddleware(routing);

const hasClerkKeys = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default hasClerkKeys
  ? clerkMiddleware(async (_auth, req: NextRequest) => {
      const pathname = req.nextUrl.pathname;
      if (isIntlBypassPath(pathname)) {
        return NextResponse.next();
      }
      if (!isPublicPath(pathname)) {
        await _auth.protect();
      }
      return intlMiddleware(req);
    })
  : (req: NextRequest) => {
      if (isIntlBypassPath(req.nextUrl.pathname)) {
        return NextResponse.next();
      }
      return intlMiddleware(req);
    };

export const config = {
  matcher: [
    "/((?!_next/|favicon\\.ico|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
