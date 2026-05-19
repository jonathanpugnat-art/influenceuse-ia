/**
 * Placeholder for a future pipeline: Instagram / TikTok trend scraper → wizard chips.
 *
 * Planned flow (not implemented):
 * 1. Cron `fetch-trends` (Apify) stores hashtag posts + optional vision tags.
 * 2. Aggregate dominant looks per niche (hair, vibe, expression).
 * 3. Map aggregates to `AppearanceVariation` indices or outfit/scene seeds.
 * 4. Surface in Trends tab as "Appliquer ce look" → wizard appearance expert.
 *
 * Keep this module dependency-free so scraper work can ship independently.
 */

import type { AppearanceVariation } from "@/lib/prompts/image-prompts";

export type ScrapedLookSignal = {
  niche: string;
  /** e.g. "almond eyes", "freckles" — from vision API or manual tags */
  tags: string[];
  weight?: number;
};

/** No-op until scraper mapping exists. */
export function scrapedSignalsToVariationHints(
  _signals: ScrapedLookSignal[]
): Partial<AppearanceVariation> | null {
  return null;
}
