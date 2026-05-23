/**
 * Hostnames allowed for /api/media/download proxy (SSRF guard).
 */

export function isAllowedMediaDownloadUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;

    const allowed = new Set<string>();

    if (process.env.R2_PUBLIC_URL) {
      allowed.add(new URL(process.env.R2_PUBLIC_URL).hostname);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      try {
        allowed.add(new URL(appUrl).hostname);
      } catch {
        /* ignore */
      }
    }

    // Replicate output URLs before persistence to R2 (legacy rows)
    allowed.add("replicate.delivery");
    allowed.add("pbxt.replicate.delivery");

    if (process.env.NODE_ENV === "development") {
      allowed.add("localhost");
      allowed.add("127.0.0.1");
    }

    return allowed.has(u.hostname);
  } catch {
    return false;
  }
}

export function filenameFromMediaUrl(url: string, fallback = "media"): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").pop();
    if (base && base.includes(".")) return base;
  } catch {
    /* ignore */
  }
  return `${fallback}-${Date.now()}.jpg`;
}
