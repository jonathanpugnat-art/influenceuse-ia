import { describe, expect, it } from "vitest";
import {
  APIFY_TIKTOK_ACTOR_DEFAULT,
  APIFY_TIKTOK_ACTOR_LEGACY,
} from "@/server/services/trends/providers/apify/constants";
import {
  buildTikTokHashtagActorInput,
  isKhadinakbarHashtagActor,
} from "@/server/services/trends/providers/apify/tiktok-hashtag-actor";

describe("tiktok-hashtag-actor", () => {
  it("defaults to khadinakbar pay-per-use actor", () => {
    expect(APIFY_TIKTOK_ACTOR_DEFAULT).toBe(
      "khadinakbar/tiktok-trending-hashtags-scraper"
    );
    expect(isKhadinakbarHashtagActor(APIFY_TIKTOK_ACTOR_DEFAULT)).toBe(true);
    expect(isKhadinakbarHashtagActor(APIFY_TIKTOK_ACTOR_LEGACY)).toBe(false);
  });

  it("builds khadinakbar input shape", () => {
    expect(
      buildTikTokHashtagActorInput(APIFY_TIKTOK_ACTOR_DEFAULT, {
        country: "FR",
        period: "7",
        limit: 40,
      })
    ).toEqual({
      timePeriod: "7",
      country: "FR",
      industry: "All Industries",
      maxResults: 40,
      isNewToTop100: false,
      proxyConfiguration: { useApifyProxy: true },
    });
  });

  it("builds legacy scrapeengine input shape", () => {
    expect(
      buildTikTokHashtagActorInput(APIFY_TIKTOK_ACTOR_LEGACY, {
        country: "US",
        period: "30",
        limit: 80,
      })
    ).toEqual({
      result_type: "top100_with_analytics",
      country: "US",
      top100_period: "30",
      total_hashtags: 80,
      sort_order: "popular",
      industry: "",
      proxyConfiguration: { useApifyProxy: true },
    });
  });
});
