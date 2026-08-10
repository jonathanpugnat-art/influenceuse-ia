/**
 * Trends provider module — barrel exports.
 */
export type {
  RawTrendItem,
  ProviderContext,
  TrendsProvider,
} from "./types";

export { CuratedTrendsProvider } from "./curated/curated-provider";
export { DevStubProvider } from "./dev-stub-provider";
export {
  ApifyTrendsProvider,
  ApifyProvider,
} from "./apify/apify-provider";
export { GenericHttpProvider } from "./http/http-provider";
export { resolveTrendsProvider } from "./resolve-provider";

export { extractPostMediaUrls } from "./apify/mappers";

import {
  mapInstagramVideoPost,
  mapTikTokVideoRow,
} from "@/lib/trends/trend-video-items";
import {
  aggregateInstagramPosts,
  dedupeTrendItems,
  extractPostMediaUrls,
  inferNicheFromHashtags,
  mapTikTokIndustryToNiche,
  mapTikTokRow,
  normalizeTikTokHashtagRow,
  viewsToGrowthScore,
} from "./apify/mappers";
import {
  resolveInstagramHashtags,
  resolveMinVideoViews,
  resolveTikTokCountry,
  resolveTikTokPeriod,
  resolveTikTokVideoHashtags,
  resolveTrendsFetchLimit,
} from "./apify/env-config";
import {
  keepHighReachItem,
  rankByReach,
} from "./apify/apify-provider";

/** Exported for unit tests. */
export const __test__ = {
  mapTikTokRow,
  normalizeTikTokHashtagRow,
  mapTikTokVideoRow,
  mapInstagramVideoPost,
  aggregateInstagramPosts,
  extractPostMediaUrls,
  mapTikTokIndustryToNiche,
  inferNicheFromHashtags,
  viewsToGrowthScore,
  resolveTikTokCountry,
  resolveTikTokPeriod,
  resolveInstagramHashtags,
  resolveTikTokVideoHashtags,
  resolveTrendsFetchLimit,
  resolveMinVideoViews,
  keepHighReachItem,
  rankByReach,
  dedupeTrendItems,
};
