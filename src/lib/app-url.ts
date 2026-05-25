/**
 * Canonical app URL for OAuth redirects (must match Meta "Valid OAuth Redirect URIs").
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
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
