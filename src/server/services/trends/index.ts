/**
 * Trends module — barrel exports.
 * Import from `@/server/services/trends` or the `trends.service` façade.
 */

// Constants
export {
  TREND_FEED_TTL_HOURS,
  TREND_FETCH_TTL_HOURS,
  KNOWN_NICHE_TAGS,
  TRENDS_AUTO_ANALYZE_LIMIT,
} from "./constants";

// Normalization & pure helpers
export {
  hashPayload,
  normalizeNicheTags,
  matchesNiche,
  normalizeHashtags,
  clampScene,
  clampPose,
  clampExpression,
  clampContentType,
  clampPlatform,
} from "./normalization";

// Schemas
export {
  trendRecommendationFieldsSchema,
  type TrendRecommendationFields,
} from "./schemas";

// Costs
export {
  trendAnalysisCost,
  trendAnalysisOneCost,
  trendFormatAnalyzeCost,
} from "./costs";

// Feed
export {
  dedupeTrendFeedItems,
  resolveTrendCreatorTarget,
} from "./feed/feed-dedupe";
export {
  refreshTrendItemsFeedTtl,
  getFeedForInfluencer,
  getGlobalTrendFeed,
  getWizardTrendInspiration,
  getTopTrendsForInfluencer,
  type FeedOptions,
} from "./feed/feed-queries";

// Fetch (cron)
export { runTrendsFetch } from "./fetch/run-trends-fetch";
export type { CronRunResult } from "./fetch/cron-types";

// Format analysis
export {
  ensureTrendFormatAnalyzed,
  analyzeTopTrendsFormat,
} from "./analysis/format-analysis";

// Personalization
export {
  personalizeFeedForInfluencer,
  personalizeSingleTrendForInfluencer,
  type PersonalizationResult,
} from "./personalization/personalize";

// Apply → creator params
export {
  recommendationToPhotoParams,
  recommendationToCreatorParams,
  type ApplyToPhotoParamsResult,
  type ApplyToCreatorResult,
} from "./apply/recommendation-params";

// Hydration
export {
  hydrateTrendPhotoInput,
  type TrendPhotoHydration,
} from "./hydration/hydrate-photo-input";
export {
  hydrateTrendReelInput,
  type TrendReelHydration,
} from "./hydration/hydrate-reel-input";
