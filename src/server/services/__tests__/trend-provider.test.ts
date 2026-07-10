import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  CuratedTrendsProvider,
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

    describe("normalizeTikTokHashtagRow", () => {
      it("maps khadinakbar actor rows to scrapeengine-compatible shape", () => {
        const normalized = __test__.normalizeTikTokHashtagRow({
          hashtag_name: "grwm",
          hashtag_id: "123",
          video_views: 5_000_000,
          post_count: 12_000,
          industry_name: "Apparel & Beauty",
          rank_diff: 3,
        });
        expect(normalized).toEqual({
          hashtag_id: "123",
          hashtag_name: "grwm",
          industry_info: { label: "Apparel & Beauty" },
          video_views: 5_000_000,
          publish_cnt: 12_000,
          analytics: { rank_change_readable: "Up 3" },
        });
      });
      it("passes through scrapeengine rows unchanged", () => {
        const row = {
          hashtag_name: "fyp",
          industry_info: { label: "Entertainment" },
          video_views: 1,
        };
        expect(__test__.normalizeTikTokHashtagRow(row)).toEqual(row);
      });
    });

    describe("mapTikTokVideoRow", () => {
      it("maps a TikTok post to a video trend item", () => {
        const r = __test__.mapTikTokVideoRow({
          id: "99",
          webVideoUrl: "https://www.tiktok.com/@a/video/99",
          playCount: 100_000,
          covers: { default: "https://cdn.example.com/c.jpg" },
          text: "OOTD #fashion",
          hashtags: [{ name: "fashion" }],
        });
        expect(r?.mediaKind).toBe("video");
        expect(r?.mediaUrls?.length).toBeGreaterThan(0);
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
            displayUrl: "https://cdn.example.com/post1.jpg",
            type: "Image",
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
        expect(fit!.thumbnailUrl).toBe("https://cdn.example.com/post1.jpg");
        expect(fit!.mediaUrls).toContain("https://cdn.example.com/post1.jpg");
        expect(fit!.mediaKind).toBe("carousel");
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

  describe("CuratedTrendsProvider", () => {
    it("is always configured (no env keys required)", () => {
      expect(new CuratedTrendsProvider().isConfigured()).toBe(true);
    });
    it("returns 18 evergreen trends localized in EN by default", async () => {
      const items = await new CuratedTrendsProvider().fetchRawTrends();
      expect(items.length).toBeGreaterThanOrEqual(15);
      // Catalogue must always include the headline LIFESTYLE trend (used as
      // a smoke test — if this disappears the curator broke the catalog).
      expect(items.some((i) => i.externalId === "curated-day-in-life")).toBe(true);
      // Every item must be a valid RawTrendItem shape.
      for (const item of items) {
        expect(item.externalId).toMatch(/^curated-/);
        expect(item.title).toBeTruthy();
        expect(["TIKTOK", "INSTAGRAM"]).toContain(item.platform);
        expect(item.hashtags.length).toBeGreaterThan(0);
        expect(item.nicheTags?.length).toBeGreaterThan(0);
        expect(item.isNsfw).toBe(false);
      }
    });
    it("localizes titles when ctx.locale=fr", async () => {
      const items = await new CuratedTrendsProvider().fetchRawTrends({
        locale: "fr",
      });
      const grwm = items.find((i) => i.externalId === "curated-grwm-running");
      expect(grwm?.title).toContain("matinale");
    });
    it("honors limit ctx", async () => {
      const items = await new CuratedTrendsProvider().fetchRawTrends({
        limit: 5,
      });
      expect(items.length).toBe(5);
    });
    it("covers every Niche enum value across the catalog", async () => {
      const items = await new CuratedTrendsProvider().fetchRawTrends();
      const allNiches = new Set<string>();
      for (const item of items) {
        for (const n of item.nicheTags ?? []) allNiches.add(n);
      }
      // The catalog must cover the 6 main niches users will filter by.
      // ADULT is intentionally absent from the curated set (NSFW handling
      // belongs elsewhere) — GENERAL is always present as a catch-all.
      for (const niche of ["FASHION", "FITNESS", "LIFESTYLE", "TRAVEL", "FOOD", "TECH", "GAMING"]) {
        expect(allNiches.has(niche)).toBe(true);
      }
    });
    // Sprint 13.2 — every curated trend ships a hero thumbnail + a real
    // explore-page sourceUrl. Without these the new TrendCard renders a
    // gradient placeholder and the "see real videos" CTA is dead.
    it("ships a thumbnailUrl on every curated trend", async () => {
      const items = await new CuratedTrendsProvider().fetchRawTrends();
      for (const item of items) {
        expect(item.thumbnailUrl).toBeTruthy();
        expect(item.thumbnailUrl).toMatch(/^https:\/\/images\.unsplash\.com\//);
      }
    });
    it("ships a sourceUrl that points to the live hashtag explore page", async () => {
      const items = await new CuratedTrendsProvider().fetchRawTrends();
      for (const item of items) {
        expect(item.sourceUrl).toBeTruthy();
        // Must be the platform's official hashtag page so the CTA opens the
        // FRESHEST top videos for that tag (TikTok /tag/<x>, IG /explore/tags/<x>/).
        if (item.platform === "TIKTOK") {
          expect(item.sourceUrl).toMatch(/^https:\/\/www\.tiktok\.com\/tag\/[a-z0-9]+$/);
        } else if (item.platform === "INSTAGRAM") {
          expect(item.sourceUrl).toMatch(
            /^https:\/\/www\.instagram\.com\/explore\/tags\/[a-z0-9]+\/$/
          );
        }
      }
    });
    it("ships an alt thumbnail on every curated trend (for hover-swap)", async () => {
      const items = await new CuratedTrendsProvider().fetchRawTrends();
      for (const item of items) {
        expect(item.thumbnailUrlAlt).toBeTruthy();
        expect(item.thumbnailUrlAlt).not.toBe(item.thumbnailUrl);
      }
    });
  });

  describe("resolveTrendsProvider", () => {
    it("prefers curated over stub when nothing else is configured (real-world default)", () => {
      // After the v0.13 fallback chain change: Curated beats Stub because
      // it ships a real evergreen catalog vs. 3 demo items. This is the
      // contract the production deployment relies on when APIFY_TOKEN is
      // not yet purchased.
      const p = resolveTrendsProvider();
      expect(p?.id).toBe("curated");
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
    it("honors explicit TRENDS_PROVIDER=curated", () => {
      process.env.TRENDS_PROVIDER = "curated";
      const p = resolveTrendsProvider();
      expect(p?.id).toBe("curated");
    });
    it("returns null when forced http but URL is missing", () => {
      process.env.TRENDS_PROVIDER = "http";
      const p = resolveTrendsProvider();
      expect(p).toBeNull();
    });
  });
});
