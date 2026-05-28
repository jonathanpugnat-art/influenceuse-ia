/**
 * Instagram OAuth — Instagram Login (direct) vs Facebook Login for Business.
 */

export type InstagramOAuthProvider = "instagram_login" | "facebook_login";

export function getInstagramOAuthProvider(): InstagramOAuthProvider {
  const mode = process.env.INSTAGRAM_OAUTH_MODE?.trim().toLowerCase();
  if (mode === "facebook") return "facebook_login";
  return "instagram_login";
}

export function usesInstagramDirectLogin(): boolean {
  return getInstagramOAuthProvider() === "instagram_login";
}

export function getInstagramLoginAppId(): string | undefined {
  return (
    process.env.INSTAGRAM_LOGIN_APP_ID?.trim() ||
    process.env.INSTAGRAM_APP_ID?.trim() ||
    process.env.FACEBOOK_APP_ID?.trim()
  );
}

/** Which env var supplies the Instagram Login client_id (for diagnostics). */
export function getInstagramLoginAppIdSource():
  | "INSTAGRAM_LOGIN_APP_ID"
  | "INSTAGRAM_APP_ID"
  | "FACEBOOK_APP_ID"
  | null {
  if (process.env.INSTAGRAM_LOGIN_APP_ID?.trim()) return "INSTAGRAM_LOGIN_APP_ID";
  if (process.env.INSTAGRAM_APP_ID?.trim()) return "INSTAGRAM_APP_ID";
  if (process.env.FACEBOOK_APP_ID?.trim()) return "FACEBOOK_APP_ID";
  return null;
}

export function getInstagramLoginAppSecret(): string | undefined {
  return (
    process.env.INSTAGRAM_LOGIN_APP_SECRET?.trim() ||
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
    process.env.FACEBOOK_APP_SECRET?.trim()
  );
}

export function getFacebookLoginAppId(): string | undefined {
  return process.env.INSTAGRAM_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim();
}

export function getFacebookLoginAppSecret(): string | undefined {
  return process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim();
}

export const INSTAGRAM_LOGIN_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;
