/**
 * Launch kill switches — env-driven, no redeploy of code needed (just update
 * the Vercel env + redeploy). Use these to instantly cut a whole lane when a
 * provider misbehaves in production instead of shipping a hotfix.
 *
 *   DISABLE_PREMIUM_IMAGES=true  → refuse Premium/NSFW photo generation
 *   DISABLE_REELS=true           → refuse reel generation
 */

export const PREMIUM_DISABLED_MESSAGE =
  "La génération Premium est temporairement désactivée pour maintenance. Le mode Social reste disponible.";

export const REELS_DISABLED_MESSAGE =
  "La génération de reels est temporairement désactivée pour maintenance. Les photos restent disponibles.";

export function isPremiumImagesDisabled(): boolean {
  return process.env.DISABLE_PREMIUM_IMAGES === "true";
}

export function isReelsDisabled(): boolean {
  return process.env.DISABLE_REELS === "true";
}
