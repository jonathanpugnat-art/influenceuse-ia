// Plans use marketing names (Free / Creator / Pro / Agency) — `name` is
// what we render in the UI. The internal Prisma enum keys
// (FREE / STARTER / PRO / ENTERPRISE) are kept for backward compat and
// mapped 1:1 to the live Stripe Products:
//
//   STARTER     → "Aura.AI Starter"  29 €/mo   (price_1Sk5SWJyqJordrOMUfO0ZRPv)
//   PRO         → "Aura.AI Pro"      79 €/mo   (price_1Sk5SXJyqJordrOMX0BoztAh)
//   ENTERPRISE  → "Aura.AI Elite"   199 €/mo   (price_1Sk5SYJyqJordrOMZTEK4x8a)
//
// Stripe is the source of truth for prices — change the Stripe Price and
// update the `price` field below in the same PR.
//
// Image model routing (decided after the A/B/C bench of 2026-05-15):
//   - All SFW content photos (any plan, with face reference)
//                                  → Google Nano Banana (default)
//   - SFW borderline scenarios (beach/lingerie/intimate)
//                                  → Flux Kontext Pro   (Google safety blocks)
//   - SFW content without face ref → Flux 1.1 Pro
//   - NSFW                         → Flux Dev Uncensored
//   - Wizard base portrait         → Flux 1.1 Pro
export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    maxInfluencers: 1,
    credits: 50,
    hasVideo: false,
    hasNsfw: false,
    hasAutoPublish: false,
    hasAdvancedAnalytics: false,
    hasContentPlan: false,
    hasBatchGeneration: false,
    hasWebhooks: false,
  },
  STARTER: {
    name: "Creator",
    price: 29,
    maxInfluencers: 2,
    credits: 500,
    hasVideo: false,
    hasNsfw: false,
    hasAutoPublish: true,
    hasAdvancedAnalytics: false,
    hasContentPlan: true,
    hasBatchGeneration: false,
    hasWebhooks: false,
  },
  PRO: {
    name: "Pro",
    price: 79,
    maxInfluencers: 5,
    credits: 1500,
    hasVideo: true,
    hasNsfw: true,
    hasAutoPublish: true,
    hasAdvancedAnalytics: false,
    hasContentPlan: true,
    hasBatchGeneration: true,
    hasWebhooks: true,
  },
  ENTERPRISE: {
    name: "Agency",
    price: 199,
    maxInfluencers: Infinity,
    credits: 5000,
    hasVideo: true,
    hasNsfw: true,
    hasAutoPublish: true,
    hasAdvancedAnalytics: true,
    hasContentPlan: true,
    hasBatchGeneration: true,
    hasWebhooks: true,
  },
} as const;

/**
 * UI helper — translates a Prisma `Plan` enum value to its marketing name.
 * Centralized so renames stay consistent across header, badges, modals.
 */
export function getPlanDisplayName(plan: keyof typeof PLANS): string {
  return PLANS[plan].name;
}

// Credit costs are calibrated against real Replicate per-call cost so the
// margin holds even on the heaviest plan (Agency 199 €). Reference (2026-05):
//
//   PHOTO   (Nano Banana / Flux 1.1 Pro)   ≈ $0.04   per image
//   REEL    (Kling-2 default / Wan 2.5)    ≈ $0.55   per clip   →  ~14× a photo
//   CAPTION (DeepSeek chat)                ≈ $0.001  per call
//
// The previous REEL=5 ratio (1 reel = 5 photos) let an Agency user burn
// 100 reels × $0.55 ≈ $55 of Replicate on a $199 plan, which collapsed the
// margin to ~0 once Clerk + R2 + Stripe fees were taken into account. The
// new REEL=8 ratio brings the worst-case Agency to ~$34 of Replicate and
// caps the credit budget to ~62 reels — a realistic ceiling for an agency.
export const CREDIT_COSTS = {
  PHOTO: 1,
  REEL: 8,
  CAPTION: 0.5,
  BASE_IMAGE: 2,
  HASHTAGS: 0.25,
  /** Per-post cost when generating a multi-day editorial plan. */
  CONTENT_PLAN_PER_POST: 0.5,
  /** Idea brainstorm (returns ~5-15 short ideas). */
  IDEAS: 0.25,
} as const;
