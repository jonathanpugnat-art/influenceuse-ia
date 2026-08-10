import type { Platform } from "@/generated/prisma/client";

/**
 * A raw trend signal as returned by a provider. All fields are best-effort —
 * a provider may only know the title and a hashtag and that's fine.
 */
export interface RawTrendItem {
  /** Identifier in the source system (URL, slug, hashtag id…). Used for dedup. */
  externalId: string;
  platform: Platform;
  title: string;
  description?: string;
  /** Hashtags WITHOUT the leading `#`. */
  hashtags: string[];
  /** Trending audio / song name if any. */
  soundName?: string;
  /** Generic "how hot is this" score, 0..100. */
  growthScore?: number;
  /** Raw play/view count when the provider exposes it (used to rank viral posts). */
  viewCount?: number;
  sourceUrl?: string;
  thumbnailUrl?: string;
  thumbnailUrlAlt?: string;
  embedUrl?: string;
  authorHandle?: string;
  nicheTags?: string[];
  isNsfw?: boolean;
  locale?: string;
  region?: string;
  mediaUrls?: string[];
  /** image | video | carousel | hashtag_signal */
  mediaKind?: string;
}

export interface ProviderContext {
  region?: string;
  locale?: string;
  limit?: number;
}

export interface TrendsProvider {
  readonly id: string;
  isConfigured(): boolean;
  fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]>;
}
