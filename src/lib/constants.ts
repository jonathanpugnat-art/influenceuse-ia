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
//   - NSFW (Premium)                 → Together FLUX → self-host → Flux Dev Uncensored
//                                      + Sightengine post-filter (recommended prod)
//   - Wizard base portrait         → Nano Banana (Flux 1.1 Pro fallback)
// Paid beta open: FREE is a teaser only (50 credits). Paying users start at
// Creator (29 €) or Pro (79 €). Existing FREE users pick up the new limit on
// next sign-in via `User.creditsLimit` sync — no migration required.
export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    maxInfluencers: 1,
    credits: 50,
    hasVideo: false,
    hasSceneFirstPipeline: false,
    hasNsfw: false,
    hasAutoPublish: false,
    hasAdvancedAnalytics: false,
    hasContentPlan: false,
    hasBatchGeneration: false,
    hasWebhooks: false,
    /** v0.12 — trend feed visible? FREE gets a 3-card teaser only. */
    hasTrends: false,
    trendsMaxFeed: 3,
    hasCharacterLora: false,
  },
  STARTER: {
    name: "Creator",
    price: 29,
    maxInfluencers: 2,
    credits: 500,
    hasVideo: false,
    hasSceneFirstPipeline: false,
    hasNsfw: false,
    hasAutoPublish: true,
    hasAdvancedAnalytics: false,
    hasContentPlan: true,
    hasBatchGeneration: false,
    hasWebhooks: false,
    hasTrends: true,
    trendsMaxFeed: 15,
    hasCharacterLora: false,
  },
  PRO: {
    name: "Pro",
    price: 79,
    maxInfluencers: 5,
    credits: 1500,
    hasVideo: true,
    /** Two-step photo pipeline (scene plate → compose). */
    hasSceneFirstPipeline: true,
    hasNsfw: true,
    hasAutoPublish: true,
    hasAdvancedAnalytics: false,
    hasContentPlan: true,
    hasBatchGeneration: true,
    hasWebhooks: true,
    hasTrends: true,
    trendsMaxFeed: 50,
    hasCharacterLora: true,
  },
  ENTERPRISE: {
    name: "Agency",
    price: 199,
    maxInfluencers: Infinity,
    credits: 5000,
    hasVideo: true,
    hasSceneFirstPipeline: true,
    hasNsfw: true,
    hasAutoPublish: true,
    hasAdvancedAnalytics: true,
    hasContentPlan: true,
    hasBatchGeneration: true,
    hasWebhooks: true,
    hasTrends: true,
    trendsMaxFeed: 200,
    hasCharacterLora: true,
  },
} as const;

/**
 * UI helper — translates a Prisma `Plan` enum value to its marketing name.
 * Centralized so renames stay consistent across header, badges, modals.
 */
export function getPlanDisplayName(plan: keyof typeof PLANS): string {
  return PLANS[plan].name;
}

// Credit costs are calibrated against real per-call cost so the
// margin holds even on the heaviest plan (Agency 199 €). Reference (2026-05):
//
//   PHOTO   (Nano Banana / Flux T2I via FAL→Replicate)   ≈ $0.03–0.04   per image
//   REEL    (Kling v3 FAL→Replicate / Wan fallback)  ≈ $0.25–0.55   per clip
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
  /** TTS narration for talking reels — included (0) for Pro studio workflow. */
  REEL_NARRATION: 0,
  CAPTION: 0.5,
  BASE_IMAGE: 2,
  /**
   * Wizard step-2 preview. Same Nano-Banana model as the final 4 variants,
   * but a single reusable image — so the preview faithfully matches the
   * result instead of the old cheap-but-different FLUX Schnell render. Priced
   * below BASE_IMAGE since it produces one image the user can keep as their
   * portrait.
   */
  WIZARD_PREVIEW: 1,
  /** 3 extra Kontext angles from the chosen wizard portrait (profile, 3/4, full body). */
  IDENTITY_PACK: 3,
  /**
   * LoRA dataset (~12 Kontext angles) from base portrait.
   * Calibrated vs ~$0.48 API (18× Kontext) — see unit economics.
   */
  LORA_DATASET: 10,
  /**
   * LoRA training job (FAL fast trainer, ~500 steps, ~20-60 min).
   * Calibrated vs ~$2 API — full train ≈ 40 cr total with dataset.
   */
  LORA_TRAINING: 30,
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
  /**
   * Talking-head V1 (Hedra Avatar + ElevenLabs).
   *
   * Floor cost / second ≈ $0.08 (Hedra Character-3 listed at 8 Hedra credits
   * per second of output; ~$0.01 / Hedra credit on the Creator plan). TTS
   * via ElevenLabs is a rounding error (~1 EL credit per char). We apply
   * the same ≥3× margin rule as remix (8 Aura credits/s → billed $0.32/s
   * assuming 1 Aura credit ≈ $0.04).
   *
   * Duration is capped in the service to `MAX_TALKING_HEAD_SEC` so a 30s
   * reel costs 30 × 8 = 240 credits max. The estimator ceilings to whole
   * seconds so a 1-word test still holds a full second of credits.
   */
  TALKING_HEAD_PER_SEC: 8,
  /**
   * Seedance scene-video V1 (BytePlus Seedance 2.5 via fal.ai).
   *
   * Provider list price (fal.ai reference-to-video, measured 2026-08):
   *   720p ≈ $0.473/s   → 12 cr/s at floor, we bill 36 cr/s (~3× margin)
   *   480p ≈ $0.221/s   →  6 cr/s at floor, we bill 18 cr/s (~3× margin)
   *
   * Numbers come from the PRD (see docs/aura-launch-plan or the task
   * spec). Do NOT reuse PhotoAI's 30/60 constants — Aura credits are
   * $0.04 each so the maths is different.
   *
   * Duration is capped at `SEEDANCE_MAX_DURATION_SEC` in the config and
   * the credit hold ceils to whole seconds so a 10s clip = 360 credits
   * exactly (720p) or 180 credits (480p).
   */
  SEEDANCE_480P_PER_SEC: 18,
  SEEDANCE_720P_PER_SEC: 36,
} as const;

/**
 * Hard cap for a single talking-head V1 reel. Enforced client-side (the
 * script counter clamps at ~80 words → ~30s at 2.5 w/s) and server-side
 * (`clampTalkingHeadDuration`). Do NOT raise this without first checking
 * Hedra's `duration` cap via `GET /models?types=video`.
 */
export const MAX_TALKING_HEAD_SEC = 30;
/** Word cap that maps to MAX_TALKING_HEAD_SEC at ~2.5 words/sec. */
export const MAX_TALKING_HEAD_WORDS = 80;
/** Words-per-second estimate used by the client counter and the cost preview. */
export const TALKING_HEAD_WORDS_PER_SEC = 2.5;
