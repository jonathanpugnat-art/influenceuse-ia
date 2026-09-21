/**
 * State machine for the Remix page's identity-pack health hint.
 *
 * Kept as a tiny pure helper so the UI branch selection is testable
 * without spinning up React / tRPC / MSW — the actual banner + CTA
 * wiring lives in `content/remix/page.tsx`.
 */

export type IdentityPackStatus = "ready" | "generating" | "failed" | "missing";

export interface IdentityHintInput {
  hasFrontal: boolean;
  hasReferences: boolean;
  referenceCount: number;
  identityPackStatus: IdentityPackStatus;
  /**
   * Wizard base portrait (`Influencer.baseImageUrl`). An avatar-only
   * character can still have `hasFrontal` via `avatarUrl`, but
   * `generateIdentityPack` rejects it.
   */
  hasBaseImage: boolean;
  /** Server rejects identity-pack generation for NSFW characters. */
  isNsfw: boolean;
}

export type IdentityPackGenerateBlock = "nsfw" | "no_base";

export type IdentityHintState =
  | { kind: "ok"; referenceCount: number }
  | { kind: "no_frontal" }
  | { kind: "generating" }
  | { kind: "failed" }
  | { kind: "missing" }
  | { kind: "unavailable"; reason: IdentityPackGenerateBlock };

/**
 * Why `generateIdentityPack` / `regenerateIdentityPack` would reject
 * this character. NSFW wins over a missing base portrait: both block
 * the paid CTA, and the NSFW reason stays true even after a portrait
 * is added.
 */
export function identityPackGenerateBlock(input: {
  isNsfw: boolean;
  hasBaseImage: boolean;
}): IdentityPackGenerateBlock | null {
  if (input.isNsfw) return "nsfw";
  if (!input.hasBaseImage) return "no_base";
  return null;
}

/**
 * Map a remix identity preview to the banner variant we render.
 *
 * Rules (checked in order):
 *  1. No frontal portrait at all → wizard-first, no CTA.
 *  2. Pack is currently generating → waiting banner, CTA disabled.
 *  3. Generate would be rejected (NSFW, or no base portrait) and there
 *     is nothing ready to show → explain why, no paid / retry CTA.
 *  4. Pack has status `failed` → retry CTA (regenerate, free).
 *  5. Pack is missing (no refs yet) → primary CTA (generate, paid).
 *  6. Everything is present → green banner, no CTA.
 */
export function identityHintState(input: IdentityHintInput): IdentityHintState {
  if (!input.hasFrontal) {
    return { kind: "no_frontal" };
  }
  if (input.identityPackStatus === "generating") {
    return { kind: "generating" };
  }
  const blocked = identityPackGenerateBlock(input);
  if (
    blocked &&
    (input.identityPackStatus === "failed" || !input.hasReferences)
  ) {
    return { kind: "unavailable", reason: blocked };
  }
  if (input.identityPackStatus === "failed") {
    return { kind: "failed" };
  }
  if (!input.hasReferences) {
    return { kind: "missing" };
  }
  return { kind: "ok", referenceCount: input.referenceCount };
}

/** Poll cadence while a pack is building or a retry has not flipped status yet. */
export const IDENTITY_PACK_POLL_MS = 5_000;

/**
 * `regenerateIdentityPack` returns before `scheduleAfter` writes
 * `generating`. Keep polling at least this long so a refetch that still
 * sees `failed` does not stop the watch.
 */
export const IDENTITY_RETRY_WATCH_MS = 120_000;

export interface IdentityRetryWatch {
  influencerId: string;
  startedAt: number;
}

/**
 * True while we are still waiting for the post-retry row to leave the
 * pre-retry `failed` snapshot. A watch for another character, an expired
 * watch, or a status that already moved on (`generating` / `ready` /
 * `missing`) is inactive.
 */
export function isIdentityRetryWatchActive(input: {
  watch: IdentityRetryWatch | null;
  influencerId: string;
  status: IdentityPackStatus | undefined;
  now: number;
}): boolean {
  const watch = input.watch;
  if (!watch || watch.influencerId !== input.influencerId) return false;
  if (input.now - watch.startedAt > IDENTITY_RETRY_WATCH_MS) return false;
  if (input.status && input.status !== "failed") return false;
  return true;
}

/**
 * Drop the watch once this character's status leaves `failed`, or when
 * the window expires. A watch for a different character is left intact.
 */
export function settleIdentityRetryWatch(input: {
  watch: IdentityRetryWatch | null;
  influencerId: string;
  status: IdentityPackStatus | undefined;
  now: number;
}): IdentityRetryWatch | null {
  if (
    !isIdentityRetryWatchActive({
      watch: input.watch,
      influencerId: input.influencerId,
      status: input.status,
      now: input.now,
    })
  ) {
    if (input.watch && input.watch.influencerId !== input.influencerId) {
      return input.watch;
    }
    return null;
  }
  return input.watch;
}

/**
 * Poll while the server says `generating`, and also while a retry watch
 * is active — otherwise the first refetch can still read `failed` and
 * polling never starts.
 */
export function identityPreviewRefetchInterval(input: {
  status: IdentityPackStatus | undefined;
  watch: IdentityRetryWatch | null;
  influencerId: string;
  now: number;
}): number | false {
  if (input.status === "generating") return IDENTITY_PACK_POLL_MS;
  if (
    isIdentityRetryWatchActive({
      watch: input.watch,
      influencerId: input.influencerId,
      status: input.status,
      now: input.now,
    })
  ) {
    return IDENTITY_PACK_POLL_MS;
  }
  return false;
}

/**
 * While the retry watch is active and the row is still the old `failed`,
 * render the waiting banner. The mutation has already returned; the
 * background job has not flipped status yet.
 */
export function identityPackUnavailableCopy(
  reason: IdentityPackGenerateBlock
): string {
  switch (reason) {
    case "nsfw":
      return "Le pack d'identité (profil, 3/4, corps entier) n'est pas disponible pour un personnage NSFW. Le remix reste possible avec le portrait actuel.";
    case "no_base":
      return "Ce personnage n'a pas de portrait de base — un avatar ne suffit pas. Termine l'assistant de création avant de générer le pack d'identité.";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

export function resolveDisplayedIdentityPackStatus(input: {
  status: IdentityPackStatus;
  watch: IdentityRetryWatch | null;
  influencerId: string;
  now: number;
}): IdentityPackStatus {
  if (
    input.status === "failed" &&
    isIdentityRetryWatchActive({
      watch: input.watch,
      influencerId: input.influencerId,
      status: input.status,
      now: input.now,
    })
  ) {
    return "generating";
  }
  return input.status;
}
