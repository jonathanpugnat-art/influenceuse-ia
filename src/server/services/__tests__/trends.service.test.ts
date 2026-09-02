/**
 * Pure-logic tests for trends.service.ts. We avoid the DB entirely — the
 * Prisma client is dynamically imported by the service so as long as we
 * exercise only the pure helpers, no real connection is needed.
 */
import { describe, expect, it } from "vitest";
import {
  clampContentType,
  clampExpression,
  clampPlatform,
  clampPose,
  clampScene,
  dedupeTrendFeedItems,
  hashPayload,
  KNOWN_NICHE_TAGS,
  matchesNiche,
  normalizeHashtags,
  normalizeNicheTags,
  recommendationToPhotoParams,
  resolveTrendCreatorTarget,
  trendRecommendationFieldsSchema,
} from "@/server/services/trends.service";

describe("trends.service / pure helpers", () => {
  describe("hashPayload", () => {
    it("is stable across key order", () => {
      const a = hashPayload({ a: 1, b: 2 });
      const b = hashPayload({ b: 2, a: 1 });
      expect(a).toBe(b);
    });
    it("changes when content changes", () => {
      expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    });
  });

  describe("normalizeNicheTags", () => {
    it("uppercases and dedupes known tags", () => {
      expect(normalizeNicheTags(["fashion", "Fashion", "FOOD"])).toEqual([
        "FASHION",
        "FOOD",
      ]);
    });
    it("drops unknown tags and falls back to GENERAL when empty", () => {
      expect(normalizeNicheTags(["sportsball", "???"])).toEqual(["GENERAL"]);
      expect(normalizeNicheTags([])).toEqual(["GENERAL"]);
      expect(normalizeNicheTags(undefined)).toEqual(["GENERAL"]);
    });
    it("covers every known niche tag", () => {
      for (const tag of KNOWN_NICHE_TAGS) {
        expect(normalizeNicheTags([tag.toLowerCase()])).toContain(tag);
      }
    });
  });

  describe("matchesNiche", () => {
    it("matches direct niche", () => {
      expect(matchesNiche(["FITNESS"], "FITNESS")).toBe(true);
    });
    it("matches via GENERAL", () => {
      expect(matchesNiche(["GENERAL", "FASHION"], "TECH")).toBe(true);
    });
    it("returns true on empty (no over-filter)", () => {
      expect(matchesNiche([], "TECH")).toBe(true);
    });
    it("returns false on mismatch without GENERAL", () => {
      expect(matchesNiche(["FASHION"], "GAMING")).toBe(false);
    });
  });

  describe("normalizeHashtags", () => {
    it("strips # prefix and lowercases", () => {
      expect(normalizeHashtags(["#FOO", "Bar", "  baz  "])).toEqual([
        "foo",
        "bar",
        "baz",
      ]);
    });
    it("dedupes", () => {
      expect(normalizeHashtags(["foo", "#foo", "FOO"])).toEqual(["foo"]);
    });
    it("caps at 30 entries", () => {
      const many = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      expect(normalizeHashtags(many).length).toBe(30);
    });
  });

  describe("enum clampers", () => {
    it("clampScene falls back to studio for unknown", () => {
      expect(clampScene("beach")).toBe("beach");
      expect(clampScene("mars")).toBe("studio");
    });
    it("clampPose falls back to portrait", () => {
      expect(clampPose("selfie")).toBe("selfie");
      expect(clampPose("???")).toBe("portrait");
    });
    it("clampExpression falls back to natural", () => {
      expect(clampExpression("smile")).toBe("smile");
      expect(clampExpression("angry")).toBe("natural");
    });
    it("clampContentType falls back to PHOTO", () => {
      expect(clampContentType("REEL")).toBe("REEL");
      expect(clampContentType("STORY")).toBe("PHOTO");
    });
    it("clampPlatform falls back to INSTAGRAM", () => {
      expect(clampPlatform("TIKTOK")).toBe("TIKTOK");
      expect(clampPlatform("FACEBOOK")).toBe("INSTAGRAM");
    });
  });

  describe("trendRecommendationFieldsSchema", () => {
    const valid = {
      trendId: "abc",
      hook: "Morning run, who's in?",
      concept: "20s vlog at sunrise.",
      type: "REEL",
      platform: "TIKTOK",
      scene: "urban",
      pose: "action",
      expression: "smile",
      outfit: "tank top + leggings",
      customPrompt: "soft morning light",
      confidence: "high",
      citations: ["trend.title", "trend.hashtags[0]"],
    };
    it("accepts a valid recommendation", () => {
      const r = trendRecommendationFieldsSchema.safeParse(valid);
      expect(r.success).toBe(true);
    });
    it("rejects an unknown type", () => {
      const r = trendRecommendationFieldsSchema.safeParse({
        ...valid,
        type: "STORY",
      });
      expect(r.success).toBe(false);
    });
    it("rejects an empty hook", () => {
      const r = trendRecommendationFieldsSchema.safeParse({ ...valid, hook: "" });
      expect(r.success).toBe(false);
    });
  });

  describe("recommendationToPhotoParams", () => {
    const baseFields = {
      trendId: "t1",
      hook: "Hook test",
      concept: "Concept",
      type: "PHOTO" as const,
      platform: "INSTAGRAM" as const,
      scene: "bedroom",
      pose: "portrait",
      expression: "natural",
      outfit: "black sports bra",
      customPrompt: "miroir chambre, lumière matinale, préparation avant run",
      confidence: "high" as const,
      citations: ["trend.title"],
    };

    it("uses customPrompt alone without generic bedroom sceneBase", () => {
      const blob = recommendationToPhotoParams(
        {
          id: "rec1",
          trendItemId: "t1",
          generatedFields: baseFields,
        },
        "inf1",
        ["grwm", "fitness"]
      );
      expect(blob.sceneDescription).toBe(baseFields.customPrompt);
      expect(blob.sceneDescription).not.toMatch(/bedroom.*miroir/i);
    });

    it("falls back to sceneBase when customPrompt is empty", () => {
      const blob = recommendationToPhotoParams(
        {
          id: "rec1",
          trendItemId: "t1",
          generatedFields: { ...baseFields, customPrompt: "" },
        },
        "inf1",
        ["grwm"]
      );
      expect(blob.sceneDescription.length).toBeGreaterThan(0);
      expect(blob.sceneDescription).not.toBe(baseFields.customPrompt);
    });

    it("returns trendContext from stored fields", () => {
      const blob = recommendationToPhotoParams(
        {
          id: "rec1",
          trendItemId: "t1",
          generatedFields: {
            ...baseFields,
            trendTitle: "GRWM morning routine",
            trendHashtags: ["grwm", "morning"],
          },
        },
        "inf1",
        ["fallback"]
      );
      expect(blob.trendContext?.title).toBe("GRWM morning routine");
      expect(blob.trendContext?.hashtags).toEqual(["grwm", "morning"]);
    });
  });

  describe("dedupeTrendFeedItems", () => {
    const base = {
      snapshotId: "snap",
      description: null,
      hashtags: ["fitness"],
      soundName: null,
      growthScore: 50,
      viewCount: null,
      likesCount: null,
      commentsCount: null,
      sourceUrl: null,
      thumbnailUrl: null,
      thumbnailUrlAlt: null,
      embedUrl: null,
      authorHandle: null,
      nicheTags: ["FITNESS"],
      isNsfw: false,
      locale: null,
      region: null,
      mediaUrls: [],
      formatBrief: null,
      fetchedAt: new Date("2026-07-01"),
      expiresAt: new Date("2026-07-04"),
      sourceVideoUrl: null,
      videoFrameUrls: [],
      formatAnalyzedAt: null,
      formatAnalysisModel: null,
      contentHash: null,
    };

    it("keeps video post over hashtag signal for same tag", () => {
      const signal = {
        ...base,
        id: "signal",
        platform: "TIKTOK" as const,
        title: "#fitness",
        mediaKind: "hashtag_signal",
        growthScore: 90,
      };
      const video = {
        ...base,
        id: "video",
        platform: "TIKTOK" as const,
        title: "Leg day mirror",
        mediaKind: "video",
        thumbnailUrl: "https://cdn.example.com/cover.jpg",
        growthScore: 70,
      };
      const out = dedupeTrendFeedItems([signal, video]);
      expect(out).toHaveLength(1);
      expect(out[0]?.id).toBe("video");
    });

    it("keeps distinct video posts even when they share a niche tag", () => {
      const a = {
        ...base,
        id: "a",
        platform: "TIKTOK" as const,
        title: "Leg day mirror",
        hashtags: ["legday"],
        mediaKind: "video",
        growthScore: 80,
      };
      const b = {
        ...base,
        id: "b",
        platform: "TIKTOK" as const,
        title: "Gym GRWM",
        hashtags: ["grwm"],
        mediaKind: "video",
        growthScore: 75,
      };
      const out = dedupeTrendFeedItems([a, b]);
      expect(out).toHaveLength(2);
    });

    it("ranks higher likes before growthScore", () => {
      const popular = {
        ...base,
        id: "popular",
        platform: "INSTAGRAM" as const,
        title: "OOTD",
        hashtags: ["ootd"],
        mediaKind: "image" as const,
        likesCount: 80_000,
        growthScore: 40,
      };
      const weaker = {
        ...base,
        id: "weaker",
        platform: "INSTAGRAM" as const,
        title: "Cafe",
        hashtags: ["cafe"],
        mediaKind: "image" as const,
        likesCount: 6_000,
        growthScore: 90,
      };
      const out = dedupeTrendFeedItems([weaker, popular]);
      expect(out[0]?.id).toBe("popular");
    });
  });

  describe("resolveTrendCreatorTarget", () => {
    it("routes REEL formatBrief to reel studio", () => {
      expect(
        resolveTrendCreatorTarget({
          mediaKind: "image",
          formatBrief: {
            contentType: "REEL",
            mood: "x",
            sceneDescription: "gym",
            pose: "selfie",
            expression: "natural",
            outfit: "leggings",
            lighting: "fluorescent",
            cameraStyle: "iphone",
            hook: "leg day",
            customPrompt: "",
            inspirationNotes: "mirror",
            confidence: "high",
            analyzedFrom: "vision",
          },
        })
      ).toBe("reel");
    });
  });
});
