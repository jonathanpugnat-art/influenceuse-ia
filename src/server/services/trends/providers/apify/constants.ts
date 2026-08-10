export const APIFY_RUN_TIMEOUT_MS = 240_000;
/** Pay-per-use Creative Center hashtags — no separate monthly actor rent. */
export const APIFY_TIKTOK_ACTOR_DEFAULT =
  "khadinakbar/tiktok-trending-hashtags-scraper";
/** Legacy actor (requires Store rent after trial). Override via APIFY_TIKTOK_ACTOR. */
export const APIFY_TIKTOK_ACTOR_LEGACY =
  "scrapeengine/tiktok-trending-hashtags-scraper";
export const APIFY_TIKTOK_VIDEO_ACTOR_DEFAULT = "clockworks/tiktok-scraper";
export const APIFY_INSTAGRAM_ACTOR_DEFAULT = "apify/instagram-hashtag-scraper";

/** Default max items kept after ranking (override via TRENDS_FETCH_LIMIT). */
export const TRENDS_FETCH_LIMIT_DEFAULT = 120;

/**
 * Drop scraped videos below this play/view count so the feed stays viral.
 * Override via TRENDS_MIN_VIDEO_VIEWS (set 0 to disable).
 */
export const TRENDS_MIN_VIDEO_VIEWS_DEFAULT = 100_000;

/** Cap per hashtag for clockworks/tiktok-scraper resultsPerPage. */
export const TIKTOK_RESULTS_PER_HASHTAG_CAP = 35;

export const APIFY_INSTAGRAM_HASHTAGS_DEFAULT = [
  "fashion",
  "fitness",
  "lifestyle",
  "travel",
  "food",
  "ootd",
  "grwm",
  "reels",
  "viral",
  "beauty",
  "makeup",
  "aesthetic",
];
