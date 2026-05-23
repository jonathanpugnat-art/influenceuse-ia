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
//   - SFW borderline scenarios (see nano-borderline.ts — maintained via bench-nano-keywords)
//                                  → Flux Kontext Pro   (Google safety blocks)
//   - SFW content without face ref → Flux 1.1 Pro
//   - NSFW                         → Flux Dev Uncensored
//   - Wizard base portrait         → Nano Banana (Flux 1.1 Pro fallback)
// Beta period (2026-05): the FREE tier is intentionally generous (500 credits
// instead of 50) so early adopters can fully exercise the app — generate
// multiple influencers, run several content batches — without ever hitting a
// paywall during the closed-bêta window. The `creditsLimit` we persist on
// `User.creditsLimit` keeps reading from this constant, so existing FREE
// users automatically get the bump on their next sign-in (no migration).
// Drop back to 50 when the beta ends and the paid plans are open.
export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    maxInfluencers: 1,
    credits: 500,
    hasVideo: false,
    hasNsfw: false,
    hasAutoPublish: false,
    hasAdvancedAnalytics: false,
    hasContentPlan: false,
    hasBatchGeneration: false,
    hasWebhooks: false,
    /** v0.12 — trend feed visible? FREE gets a 3-card teaser only. */
    hasTrends: false,
    trendsMaxFeed: 3,
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
    hasTrends: true,
    trendsMaxFeed: 15,
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
    hasTrends: true,
    trendsMaxFeed: 50,
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
    hasTrends: true,
    trendsMaxFeed: 200,
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
  /** TTS narration for talking reels (Replicate Kokoro or REPLICATE_TTS_MODEL). */
  REEL_NARRATION: 0.5,
  CAPTION: 0.5,
  BASE_IMAGE: 2,
  /** 3 extra Kontext angles from the chosen wizard portrait (profile, 3/4, full body). */
  IDENTITY_PACK: 3,
  HASHTAGS: 0.25,
  /** Per-post cost when generating a multi-day editorial plan. */
  CONTENT_PLAN_PER_POST: 0.5,
  /** Idea brainstorm (returns ~5-15 short ideas). */
  IDEAS: 0.25,
  /**
   * v0.12 — Trends. Reading the cached feed is free (no LLM call).
   * Generating LLM-personalized recommendations for an influencer costs
   * ~1 caption-equivalent: it's a single small JSON LLM call covering
   * 5-15 trends in one shot.
   */
  TREND_FEED: 0,
  TREND_ANALYSIS: 0.5,
  /**
   * v0.13 — Per-card personalization. The user picks ONE trend they like
   * and gets a tailored hook. Cheaper than the bulk path because it's a
   * single tiny LLM call (~200 tokens). Lets users explore the feed
   * without committing to the full 0.5-credit bulk pass.
   */
  TREND_ANALYSIS_ONE: 0.1,
  /** Vision/text analysis of scraped post media (one trend). */
  TREND_FORMAT_ANALYZE: 0.2,
} as const;
