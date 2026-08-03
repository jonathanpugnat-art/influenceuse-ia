import { describe, expect, it } from "vitest";
import { buildLoraTriggerWord } from "@/lib/lora";
import {
  resolveReelMotionMode,
  shouldUseMotionControl,
} from "@/lib/video-motion-config";
import { formatBriefToReelSeed } from "@/lib/trends/trend-format-brief";

describe("P1 LoRA + motion config", () => {
  it("buildLoraTriggerWord is stable and unique per influencer", () => {
    const a = buildLoraTriggerWord("inf_abc123", "Luna");
    const b = buildLoraTriggerWord("inf_xyz789", "Luna");
    expect(a).toMatch(/^AURA_/);
    expect(a).not.toBe(b);
  });

  it("shouldUseMotionControl when persisted mp4 is present", () => {
    expect(
      shouldUseMotionControl({
        motionSourceVideoUrl: "https://cdn.example.com/trend-video-1.mp4",
      })
    ).toBe(true);
    expect(shouldUseMotionControl({ motionSourceVideoUrl: null })).toBe(false);
  });

  it("resolveReelMotionMode routes to motion_control with source video", () => {
    expect(
      resolveReelMotionMode({
        motionSourceVideoUrl: "https://cdn.example.com/trend.mp4",
        fromTrend: true,
      })
    ).toBe("motion_control");
  });

  it("formatBriefToReelSeed carries sound + motion video", () => {
    const seed = formatBriefToReelSeed(
      {
        contentType: "REEL",
        mood: "playful",
        sceneDescription: "mirror dance in bedroom",
        pose: "candid",
        expression: "playful",
        outfit: "crop top",
        lighting: "neon",
        cameraStyle: "handheld",
        hook: "POV trend",
        customPrompt: "",
        videoType: "dance",
        confidence: "high",
        analyzedFrom: "vision",
        inspirationNotes: "dance pacing",
      },
      "inf1",
      ["fyp"],
      {
        soundName: "Trending Beat",
        motionSourceVideoUrl: "https://cdn.example.com/trend.mp4",
      }
    );
    expect(seed.music).toBe("Trending Beat");
    expect(seed.motionSourceVideoUrl).toBe("https://cdn.example.com/trend.mp4");
    expect(seed.fromTrend).toBe(true);
  });
});
