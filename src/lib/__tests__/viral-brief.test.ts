import { describe, expect, it } from "vitest";
import {
  trendTopPickFromItem,
  viralBriefFromApplyPhoto,
  viralBriefFromTrendPick,
  viralBriefToPhotoCreatorSeed,
  reelBriefFromTrendPick,
  reelBriefToReelCreatorParams,
} from "@/lib/viral-brief";

describe("viral-brief", () => {
  it("maps trend pick to photo creator seed", () => {
    const pick = trendTopPickFromItem({
      id: "trend-1",
      title: "GRWM morning routine",
      platform: "TIKTOK",
      growthScore: 88,
      hashtags: ["grwm", "morning"],
      formatBrief: {
        contentType: "PHOTO",
        mood: "cozy",
        sceneDescription: "Bedroom mirror selfie, soft morning light",
        pose: "selfie",
        expression: "natural",
        outfit: "oversized white tee",
        lighting: "soft window light",
        cameraStyle: "iPhone mirror selfie",
        hook: "Morning reset",
        customPrompt: "",
        inspirationNotes: "GRWM pacing",
        confidence: "high",
        analyzedFrom: "vision",
      },
    });

    const brief = viralBriefFromTrendPick(pick, "studio_agent");
    expect(brief.trendItemId).toBe("trend-1");
    expect(brief.sceneDescription).toContain("Bedroom mirror");
    expect(brief.outfit).toBe("oversized white tee");
    expect(brief.trendContext?.brief?.mood).toBe("cozy");

    const seed = viralBriefToPhotoCreatorSeed(brief, "inf-1");
    expect(seed.influencerId).toBe("inf-1");
    expect(seed.trendItemId).toBe("trend-1");
    expect(seed.instagramShot).toBe(true);
  });

  it("maps apply photo blob to viral brief", () => {
    const brief = viralBriefFromApplyPhoto({
      type: "PHOTO",
      platform: "INSTAGRAM",
      influencerId: "inf-1",
      scene: "gym",
      sceneDescription: "Locker mirror selfie",
      pose: "selfie",
      outfit: "black leggings set",
      expression: "natural",
      customPrompt: "",
      hook: "Post workout",
      hashtags: ["fitness"],
      confidence: "high",
      citations: [],
      trendItemId: "t-1",
      recommendationId: "r-1",
      trendContext: { title: "Gym trend", hashtags: ["fitness"] },
    });

    expect(brief.recommendationId).toBe("r-1");
    expect(brief.source).toBe("trend_apply");
    expect(brief.hook).toBe("Post workout");
  });

  it("maps trend pick to reel creator params", () => {
    const brief = reelBriefFromTrendPick(
      {
        id: "trend-reel",
        title: "Gym mirror check",
        platform: "TIKTOK",
        growthScore: 80,
        hashtags: ["legday", "fitness"],
        hook: "POV leg day",
        sceneDescription: "Gym mirror selfie",
        mood: "energetic",
        cameraStyle: "iphone mirror",
        outfit: "black leggings",
        formatBrief: {
          contentType: "REEL",
          mood: "energetic",
          sceneDescription: "Gym mirror selfie, fluorescent light",
          pose: "selfie",
          expression: "playful",
          outfit: "black leggings set",
          lighting: "fluorescent",
          cameraStyle: "iphone mirror selfie",
          hook: "POV leg day",
          customPrompt: "",
          videoType: "workout",
          reelDurationSec: 15,
          inspirationNotes: "mirror pacing",
          confidence: "high",
          analyzedFrom: "vision",
        },
      },
      "inf-1",
      { soundName: "Beat", motionSourceVideoUrl: "https://cdn.example.com/v.mp4" }
    );

    expect(brief.trendItemId).toBe("trend-reel");
    expect(brief.duration).toBe(15);
    expect(brief.videoType).toBe("workout");
    expect(brief.fromTrend).toBe(true);

    const params = reelBriefToReelCreatorParams(brief, "inf-1");
    expect(params.script).toContain("POV");
    expect(params.motionSourceVideoUrl).toContain("v.mp4");
  });
});
