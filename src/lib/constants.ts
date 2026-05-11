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

export const CREDIT_COSTS = {
  PHOTO: 1,
  REEL: 5,
  CAPTION: 0.5,
  BASE_IMAGE: 2,
  HASHTAGS: 0.25,
  /** Per-post cost when generating a multi-day editorial plan. */
  CONTENT_PLAN_PER_POST: 0.5,
  /** Idea brainstorm (returns ~5-15 short ideas). */
  IDEAS: 0.25,
} as const;
