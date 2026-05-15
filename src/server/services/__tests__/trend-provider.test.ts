import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  DevStubProvider,
  ApifyTrendsProvider,
  GenericHttpProvider,
  resolveTrendsProvider,
  __test__,
} from "@/server/services/trend-provider";

describe("trend-provider", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.TRENDS_PROVIDER;
    delete process.env.APIFY_TOKEN;
    delete process.env.APIFY_TIKTOK_ACTOR;
    delete process.env.APIFY_INSTAGRAM_ACTOR;
    delete process.env.APIFY_TIKTOK_COUNTRY;
    delete process.env.APIFY_TIKTOK_PERIOD;
    delete process.env.APIFY_INSTAGRAM_HASHTAGS;
    delete process.env.TRENDS_HTTP_URL;
    delete process.env.TRENDS_HTTP_TOKEN;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("DevStubProvider", () => {
    it("is configured outside production", async () => {
      const p = new DevStubProvider();
      expect(p.isConfigured()).toBe(true);
      const items = await p.fetchRawTrends({ locale: "en" });
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.externalId).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(["TIKTOK", "INSTAGRAM", "ONLYFANS"]).toContain(item.platform);
      }
    });
    it("honors limit ctx", async () => {
      const p = new DevStubProvider();
      const items = await p.fetchRawTrends({ limit: 1 });
      expect(items.length).toBe(1);
    });
  });

  describe("ApifyTrendsProvider", () => {
    it("reports unconfigured without APIFY_TOKEN", () => {
      expect(new ApifyTrendsProvider().isConfigured()).toBe(false);
    });
    it("reports configured as soon as APIFY_TOKEN is set", () => {
      process.env.APIFY_TOKEN = "secret";
      expect(new ApifyTrendsProvider().isConfigured()).toBe(true);
    });
  });

  describe("Apify mappers", () => {
    describe("mapTikTokRow", () => {
      it("maps a typical TikTok hashtag row to a RawTrendItem", () => {
        const r = __test__.mapTikTokRow(
          {
            hashtag_id: "abc",
            hashtag_name: "fyp",
            industry_info: { label: "Apparel & Beauty" },
            video_views: 12_000_000,
            publish_cnt: 50_000,
            analytics: { rank_change_readable: "Up" },
          },
          { country: "FR", period: "7" }
        );
        expect(r).not.toBeNull();
        expect(r!.platform).toBe("TIKTOK");
        expect(r!.title).toBe("#fyp");
        expect(r!.hashtags).toEqual(["fyp"]);
        expect(r!.nicheTags).toEqual(["FASHION"]);
        expect(r!.sourceUrl).toContain("tiktok.com/tag/fyp");
        expect(r!.region).toBe("FR");
        // 12M views → growth score ~ between 60 and 90
        expect(r!.growthScore).toBeGreaterThan(60);
        expect(r!.growthScore).toBeLessThan(95);
      });
      it("returns null when hashtag_name is missing", () => {
        const r = __test__.mapTikTokRow(
          { hashtag_id: "x", video_views: 1 },
          { country: "US", period: "7" }
        );
        expect(r).toBeNull();
      });
    });

    describe("aggregateInstagramPosts", () => {
      it("groups posts by source hashtag and sums engagement", () => {
        const out = __test__.aggregateInstagramPosts([
          {
            inputUrl: "https://www.instagram.com/explore/tags/fitness/",
            caption: "Morning run 🌅 #fitness #running",
            hashtags: ["fitness", "running"],
            likesCount: 100,
            commentsCount: 5,
          },
          {
            inputUrl: "https://www.instagram.com/explore/tags/fitness/",
            caption: "PR day! #fitness #gym",
            hashtags: ["fitness", "gym"],
            likesCount: 200,
            commentsCount: 10,
          },
          {
            inputUrl: "https://www.instagram.com/explore/tags/fashion/",
            caption: "OOTD #fashion #ootd",
            hashtags: ["fashion", "ootd"],
            likesCount: 50,
            commentsCount: 2,
          },
        ]);
        expect(out.length).toBe(2);
        const fit = out.find((t) => t.title === "#fitness");
        expect(fit).toBeDefined();
        expect(fit!.platform).toBe("INSTAGRAM");
        expect(fit!.nicheTags).toContain("FITNESS");
        expect(fit!.hashtags).toEqual(
          expect.arrayContaining(["fitness", "running", "gym"])
        );
        expect(fit!.sourceUrl).toContain("/explore/tags/fitness/");
      });
      it("returns empty array on empty input", () => {
        expect(__test__.aggregateInstagramPosts([])).toEqual([]);
      });
      it("skips posts without an identifiable source hashtag", () => {
        const out = __test__.aggregateInstagramPosts([
          { caption: "no tag here", likesCount: 100 },
        ]);
        expect(out).toEqual([]);
      });
    });

    describe("viewsToGrowthScore", () => {
      it("returns undefined for non-positive values", () => {
        expect(__test__.viewsToGrowthScore(0)).toBeUndefined();
        expect(__test__.viewsToGrowthScore(undefined)).toBeUndefined();
      });
      it("is monotonic in views", () => {
        const a = __test__.viewsToGrowthScore(1000)!;
        const b = __test__.viewsToGrowthScore(100_000)!;
        const c = __test__.viewsToGrowthScore(10_000_000)!;
        expect(a).toBeLessThan(b);
        expect(b).toBeLessThan(c);
        expect(c).toBeLessThanOrEqual(100);
      });
    });

    describe("mapTikTokIndustryToNiche", () => {
      it("maps fitness/sport to FITNESS", () => {
        expect(__test__.mapTikTokIndustryToNiche("Sports & Outdoors")).toEqual([
          "FITNESS",
        ]);
      });
      it("falls back to GENERAL for unknown labels", () => {
        expect(__test__.mapTikTokIndustryToNiche("Pet Supplies")).toEqual([
          "GENERAL",
        ]);
        expect(__test__.mapTikTokIndustryToNiche(undefined)).toEqual([
          "GENERAL",
        ]);
      });
    });

    describe("inferNicheFromHashtags", () => {
      it("picks up multiple niches from hashtag set", () => {
        const out = __test__.inferNicheFromHashtags([
          "fashion",
          "ootd",
          "travel",
        ]);
        expect(out).toEqual(expect.arrayContaining(["FASHION", "TRAVEL"]));
      });
      it("falls back to GENERAL when nothing matches", () => {
        expect(__test__.inferNicheFromHashtags(["xyz", "qqq"])).toEqual([
          "GENERAL",
        ]);
      });
    });

    describe("env resolvers", () => {
      it("resolveTikTokCountry uses ctx.region, then env, then US", () => {
        expect(__test__.resolveTikTokCountry({ region: "fr" })).toBe("FR");
        process.env.APIFY_TIKTOK_COUNTRY = "de";
        expect(__test__.resolveTikTokCountry()).toBe("DE");
        delete process.env.APIFY_TIKTOK_COUNTRY;
        expect(__test__.resolveTikTokCountry()).toBe("US");
      });
      it("resolveTikTokPeriod clamps to allowed values", () => {
        expect(__test__.resolveTikTokPeriod()).toBe("7");
        process.env.APIFY_TIKTOK_PERIOD = "30";
        expect(__test__.resolveTikTokPeriod()).toBe("30");
        process.env.APIFY_TIKTOK_PERIOD = "999";
        expect(__test__.resolveTikTokPeriod()).toBe("7");
      });
      it("resolveInstagramHashtags parses CSV", () => {
        process.env.APIFY_INSTAGRAM_HASHTAGS = "#fashion , Fitness, #ootd ";
        expect(__test__.resolveInstagramHashtags()).toEqual([
          "fashion",
          "fitness",
          "ootd",
        ]);
      });
      it("resolveInstagramHashtags falls back to defaults", () => {
        const list = __test__.resolveInstagramHashtags();
        expect(list.length).toBeGreaterThan(0);
        expect(list).toEqual(expect.arrayContaining(["fashion", "fitness"]));
      });
    });
  });

  describe("GenericHttpProvider", () => {
    it("reports unconfigured without TRENDS_HTTP_URL", () => {
      expect(new GenericHttpProvider().isConfigured()).toBe(false);
    });
    it("reports configured with TRENDS_HTTP_URL", () => {
      process.env.TRENDS_HTTP_URL = "https://example.com/feed";
      expect(new GenericHttpProvider().isConfigured()).toBe(true);
    });
  });

  describe("resolveTrendsProvider", () => {
    it("prefers stub when nothing else is configured (dev)", () => {
      const p = resolveTrendsProvider();
      expect(p?.id).toBe("stub");
    });
    it("picks Apify when APIFY_TOKEN is set", () => {
      process.env.APIFY_TOKEN = "tk";
      const p = resolveTrendsProvider();
      expect(p?.id).toBe("apify");
    });
    it("honors explicit TRENDS_PROVIDER=http", () => {
      process.env.TRENDS_PROVIDER = "http";
      process.env.TRENDS_HTTP_URL = "https://example.com/feed";
      const p = resolveTrendsProvider();
      expect(p?.id).toBe("http");
    });
    it("returns null when forced http but URL is missing", () => {
      process.env.TRENDS_PROVIDER = "http";
      const p = resolveTrendsProvider();
      expect(p).toBeNull();
    });
  });
});
