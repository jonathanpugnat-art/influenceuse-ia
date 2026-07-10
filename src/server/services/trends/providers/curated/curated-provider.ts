import type { ProviderContext, RawTrendItem, TrendsProvider } from "../types";
import { CURATED_TRENDS, explorePageUrl } from "./curated-data";

/**
 * Curated provider — ships a static dataset of evergreen short-form formats.
 */
export class CuratedTrendsProvider implements TrendsProvider {
  readonly id = "curated";

  isConfigured(): boolean {
    return true;
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    const locale: "fr" | "en" = ctx?.locale === "fr" ? "fr" : "en";
    const items: RawTrendItem[] = CURATED_TRENDS.map((c) => {
      const sourceUrl = explorePageUrl(c.platform, c.primaryHashtag);
      return {
        externalId: c.externalId,
        platform: c.platform,
        title: c.title[locale],
        description: c.description[locale],
        hashtags: c.hashtags,
        soundName: c.soundName,
        growthScore:
          c.growthScore +
          (locale === "fr" ? -1 : 1) +
          Math.floor(Math.random() * 3 - 1),
        sourceUrl,
        thumbnailUrl: c.thumbnailUrl,
        thumbnailUrlAlt: c.thumbnailUrlAlt,
        embedUrl: undefined,
        authorHandle: undefined,
        nicheTags: c.nicheTags,
        isNsfw: false,
        mediaKind: "image",
        mediaUrls: [c.thumbnailUrl, c.thumbnailUrlAlt].filter(
          (u): u is string => Boolean(u)
        ),
        locale,
        region: ctx?.region,
      };
    });

    return items.slice(0, ctx?.limit ?? items.length);
  }
}
