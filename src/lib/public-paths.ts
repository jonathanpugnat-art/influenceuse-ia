/**
 * Marketing / legal / auth routes that must stay reachable without a session.
 * Unprefixed paths are public so next-intl can redirect them to /fr/... instead
 * of Clerk returning a 404.
 */
export function isIntlBypassPath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true;
  return pathname === "/robots.txt" || pathname === "/sitemap.xml";
}

export function isPublicPath(pathname: string): boolean {
  if (isIntlBypassPath(pathname)) return true;
  if (pathname === "/" || pathname === "/fr" || pathname === "/en") return true;

  if (/^\/(fr|en)\/sign-(in|up)(\/|$)/.test(pathname)) return true;
  if (/^\/sign-(in|up)(\/|$)/.test(pathname)) return true;

  if (/^\/(fr|en)\/home\b/.test(pathname)) return true;
  if (/^\/home\b/.test(pathname)) return true;

  if (/^\/(fr|en)\/preview\/landing-premium\b/.test(pathname)) return true;

  if (/^\/(fr|en)\/(changelog|pricing|privacy|terms|data-deletion|mentions)\b/.test(pathname)) {
    return true;
  }
  if (/^\/(changelog|pricing|privacy|terms|data-deletion|mentions)\b/.test(pathname)) {
    return true;
  }

  return false;
}
