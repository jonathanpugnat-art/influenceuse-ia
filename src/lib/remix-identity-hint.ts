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
}

export type IdentityHintState =
  | { kind: "ok"; referenceCount: number }
  | { kind: "no_frontal" }
  | { kind: "generating" }
  | { kind: "failed" }
  | { kind: "missing" };

/**
 * Map a remix identity preview to the banner variant we render.
 *
 * Rules (checked in order):
 *  1. No frontal portrait at all → wizard-first, no CTA (they must
 *     finish the character wizard before we can build refs).
 *  2. Pack is currently generating → waiting banner, CTA disabled.
 *  3. Pack has status `failed` → retry CTA (regenerate, free).
 *  4. Pack is missing (no refs yet) → primary CTA (generate, paid).
 *  5. Everything is present → green banner, no CTA.
 */
export function identityHintState(
  input: IdentityHintInput
): IdentityHintState {
  if (!input.hasFrontal) {
    return { kind: "no_frontal" };
  }
  if (input.identityPackStatus === "generating") {
    return { kind: "generating" };
  }
  if (input.identityPackStatus === "failed") {
    return { kind: "failed" };
  }
  if (!input.hasReferences) {
    return { kind: "missing" };
  }
  return { kind: "ok", referenceCount: input.referenceCount };
}
