import { describe, expect, it } from "vitest";
import {
  inferStudioLookFromBrief,
  mapInstagramVideoPost,
  mapTikTokVideoRow,
  pickVisionUrlsFromTrend,
} from "@/lib/trends/trend-video-items";
import type { TrendFormatBrief } from "@/lib/trends/trend-format-brief";

describe("trend-video-items", () => {
  it("mapTikTokVideoRow builds video trend with embed", () => {
    const item = mapTikTokVideoRow({
      id: "7123",
      text: "GRWM morning ☕ #grwm #cafe",
      webVideoUrl: "https://www.tiktok.com/@luna/video/7123",
      videoUrl: "https://cdn.example.com/v.mp4",
      playCount: 500_000,
      covers: { default: "https://cdn.example.com/cover.jpg" },
      authorMeta: { uniqueId: "luna" },
      hashtags: [{ name: "grwm" }, { name: "cafe" }],
    });
    expect(item?.mediaKind).toBe("video");
    expect(item?.embedUrl).toContain("tiktok.com");
    expect(item?.mediaUrls).toContain("https://cdn.example.com/cover.jpg");
    expect(item?.hashtags).toEqual(["grwm", "cafe"]);
  });

  it("mapInstagramVideoPost requires video type or videoUrl", () => {
    expect(mapInstagramVideoPost({ type: "Image", url: "https://ig.com/p/x" })).toBeNull();
    const reel = mapInstagramVideoPost({
      type: "Video",
      shortCode: "abc",
      url: "https://www.instagram.com/reel/abc/",
      videoUrl: "https://cdn.example.com/r.mp4",
      displayUrl: "https://cdn.example.com/thumb.jpg",
      caption: "OOTD #fashion",
      hashtags: ["fashion", "ootd"],
      likesCount: 1200,
    });
    expect(reel?.mediaKind).toBe("video");
    expect(reel?.thumbnailUrl).toBe("https://cdn.example.com/thumb.jpg");
  });

  it("pickVisionUrlsFromTrend skips mp4", () => {
    const urls = pickVisionUrlsFromTrend({
      thumbnailUrl: "https://cdn.example.com/a.jpg",
      mediaUrls: ["https://cdn.example.com/v.mp4", "https://cdn.example.com/b.webp"],
    });
    expect(urls).toContain("https://cdn.example.com/a.jpg");
    expect(urls).toContain("https://cdn.example.com/b.webp");
    expect(urls.some((u) => u.includes(".mp4"))).toBe(false);
  });

  it("inferStudioLookFromBrief maps cafe and gym", () => {
    const cafe: TrendFormatBrief = {
      contentType: "PHOTO",
      mood: "cozy",
      sceneDescription: "coffee shop with latte art",
      pose: "candid",
      expression: "natural",
      outfit: "oversized sweater",
      lighting: "soft",
      cameraStyle: "iphone",
      hook: "Morning vibes",
      customPrompt: "",
      inspirationNotes: "cafe aesthetic",
      confidence: "high",
      analyzedFrom: "vision",
    };
    expect(inferStudioLookFromBrief(cafe)).toBe("cafe-aesthetic");
  });
});
