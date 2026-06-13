/** Cookie used to return the user to the wizard after Instagram OAuth. */
export const INSTAGRAM_OAUTH_RETURN_COOKIE = "instagram_oauth_return_to";

/** Only allow same-app relative paths (open redirect guard). */
export function sanitizeOAuthReturnPath(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("://")) return null;
  return path;
}

export function buildWizardInstagramReturnPath(
  locale: string,
  query: Record<string, string> = {}
): string {
  const params = new URLSearchParams({ step: "3", ...query });
  return `/${locale}/influencers/new?${params.toString()}`;
}
