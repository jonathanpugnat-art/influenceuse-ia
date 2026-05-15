/**
 * Beta-time payments switch.
 *
 * During the v0.11 closed bêta we deliberately keep Stripe in TEST mode so we
 * can ship without going through Stripe LIVE KYC (SIRET, RIB, identity check
 * — 24h-48h to validate). The app is otherwise fully payment-aware: tRPC
 * still has the `billing.*` router, the webhook still verifies signatures,
 * the Customer Portal still works — they just point to test mode.
 *
 * To keep the UX honest while payments are disabled we hide every "Upgrade"
 * surface in the dashboard:
 *   - The pricing-cards CTA buttons collapse to a "Bêta gratuite" badge.
 *   - The low-balance banner hides its upgrade link.
 *   - The post-error upgrade modal stops auto-opening.
 *   - The billing page swaps the plan grid for an info banner.
 *
 * Flip `BETA_HIDE_PAYMENTS=false` (or remove the var entirely) the day Stripe
 * LIVE is approved and you want users to start paying. No code change needed.
 *
 * The helper is intentionally synchronous and read-only so it can be called
 * both server-side (Server Components, tRPC procedures) and exposed to
 * Client Components through `NEXT_PUBLIC_BETA_HIDE_PAYMENTS` for parity.
 */
export function isPaymentsEnabled(): boolean {
  // Server-side: prefer the server-only flag (single source of truth).
  if (typeof window === "undefined") {
    return (
      (process.env.BETA_HIDE_PAYMENTS ?? "").toLowerCase() !== "true"
    );
  }
  // Client-side: read the NEXT_PUBLIC_ mirror (server flag is unavailable in
  // the browser bundle). Both are set together on Vercel.
  return (
    (process.env.NEXT_PUBLIC_BETA_HIDE_PAYMENTS ?? "").toLowerCase() !== "true"
  );
}

/** Inverse helper — clearer at call-sites where you want to gate banners. */
export function isBetaFreeMode(): boolean {
  return !isPaymentsEnabled();
}
