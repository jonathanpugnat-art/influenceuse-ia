import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed OAuth `state` for the Instagram / TikTok account-linking flows.
 *
 * Before this helper the state was the raw influencerId, which allowed a
 * login CSRF: an attacker could send a victim a forged callback URL
 * (`?code=<attacker's code>&state=<victim's influencerId>`) and link the
 * attacker's IG/TikTok account to the victim's influencer. Binding the state
 * to the *initiating user* with an HMAC closes that hole — the callback only
 * accepts a state minted for the currently signed-in user.
 *
 * Format: `<influencerId>.<expiresAtMs>.<hmac-base64url>`
 * Key: ENCRYPTION_SECRET (already mandatory for token encryption).
 */

const STATE_TTL_MS = 15 * 60 * 1000;

function getStateSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error("ENCRYPTION_SECRET is not set — cannot sign OAuth state.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

/** Mint a signed state bound to (influencerId, dbUserId), valid 15 minutes. */
export function buildSignedOAuthState(
  influencerId: string,
  dbUserId: string
): string {
  const expiresAt = Date.now() + STATE_TTL_MS;
  const signature = sign(`${influencerId}.${expiresAt}.${dbUserId}`);
  return `${influencerId}.${expiresAt}.${signature}`;
}

/**
 * Verify a state received on the OAuth callback for the signed-in user.
 * Returns the influencerId when valid, null otherwise (tampered, expired,
 * or minted for another user).
 */
export function verifySignedOAuthState(
  state: string,
  dbUserId: string
): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [influencerId, expiresAtRaw, signature] = parts;

  const expiresAt = Number(expiresAtRaw);
  if (!influencerId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }

  const expected = sign(`${influencerId}.${expiresAt}.${dbUserId}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return influencerId;
}
