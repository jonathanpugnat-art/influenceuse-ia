/**
 * Hostnames allowed for /api/media/download proxy (SSRF guard).
 * https only. Redirect targets must pass this check again.
 */

import { isBlockedOutboundHostname } from "@/lib/outbound-url-guard";

export const MAX_MEDIA_DOWNLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_MEDIA_REDIRECTS = 5;

export function isAllowedMediaDownloadUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (isBlockedOutboundHostname(u.hostname)) return false;

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

    return allowed.has(u.hostname);
  } catch {
    return false;
  }
}

export function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export function resolveMediaRedirectUrl(
  location: string,
  currentUrl: string
): string | null {
  try {
    return new URL(location, currentUrl).href;
  } catch {
    return null;
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
