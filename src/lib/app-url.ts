/**
 * Canonical public origin. Fal Seedance/Remix webhooks must hit
 * `/api/webhooks/fal-seedance` and `/api/webhooks/fal-remix` on the
 * www host — apex (`aurainfluenceai.com`) is remapped so a mis-set
 * `NEXT_PUBLIC_APP_URL` cannot silently drop callbacks.
 */
export const PROD_APP_ORIGIN = "https://www.aurainfluenceai.com";
const PROD_APEX_HOST = "aurainfluenceai.com";
const PROD_WWW_HOST = "www.aurainfluenceai.com";

/**
 * Canonical app URL for OAuth redirects and outbound Fal webhooks.
 * Production apex → www, always https.
 */
export function getAppUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  try {
    const url = new URL(raw);
    if (url.hostname === PROD_APEX_HOST || url.hostname === PROD_WWW_HOST) {
      return PROD_APP_ORIGIN;
    }
    return raw;
  } catch {
    return raw;
  }
}

/** Hostname only — safe to log (no secrets, no query string). */
export function getAppUrlHost(): string {
  try {
    return new URL(getAppUrl()).host;
  } catch {
    return "unknown";
  }
}

export function getInstagramOAuthRedirectUri(): string {
  return `${getAppUrl()}/api/auth/instagram`;
}

export function getTikTokOAuthRedirectUri(): string {
  return `${getAppUrl()}/api/auth/tiktok`;
}

/** www ↔ apex variants to register in Meta when both resolve to the same app. */
export function buildAlternateInstagramRedirectUris(canonical: string): string[] {
  const path = "/api/auth/instagram";
  try {
    const u = new URL(canonical);
    const host = u.hostname;
    const alternates: string[] = [];
    if (host.startsWith("www.")) {
      alternates.push(`${u.protocol}//${host.slice(4)}${path}`);
    } else if (!host.includes("localhost")) {
      alternates.push(`${u.protocol}//www.${host}${path}`);
    }
    return alternates.filter((uri) => uri !== canonical);
  } catch {
    return [];
  }
}
