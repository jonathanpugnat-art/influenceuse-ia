import { describe, expect, it } from "vitest";
import {
  briefToPromptContext,
  type TrendFormatBrief,
} from "@/lib/trends/trend-format-brief";

const baseBrief: TrendFormatBrief = {
  contentType: "PHOTO",
  mood: "cozy golden-hour vibe",
  sceneDescription: "Woman by a sunlit window in a Paris apartment.",
  pose: "candid",
  expression: "natural",
  outfit: "oversized knit sweater",
  lighting: "warm window backlight",
  cameraStyle: "iPhone front camera, slight flash",
  hook: "POV: lazy Sunday morning",
  customPrompt: "soft grain",
  inspirationNotes: "borrowed the cozy GRWM pacing",
  confidence: "high",
  analyzedFrom: "vision",
};

describe("briefToPromptContext", () => {
  it("merges title, hashtags and the rich analyzed brief", () => {
    const ctx = briefToPromptContext(baseBrief, "  Cozy morning  ", [
      "cozy",
      "grwm",
    ]);
    expect(ctx).toEqual({
      title: "Cozy morning",
      hashtags: ["cozy", "grwm"],
      brief: {
        cameraStyle: "iPhone front camera, slight flash",
        lighting: "warm window backlight",
        mood: "cozy golden-hour vibe",
        inspirationNotes: "borrowed the cozy GRWM pacing",
      },
    });
  });

  it("omits the brief block when no visual fields are present", () => {
    const empty: TrendFormatBrief = {
      ...baseBrief,
      cameraStyle: "",
      lighting: "",
      mood: "",
      inspirationNotes: "",
    };
    const ctx = briefToPromptContext(empty, "Title", ["tag"]);
    expect(ctx).toEqual({ title: "Title", hashtags: ["tag"] });
    expect(ctx?.brief).toBeUndefined();
  });

  it("carries inspiration image URLs for generation", () => {
    const ctx = briefToPromptContext(null, "GRWM", ["grwm"], [
      "https://cdn.example.com/cover.jpg",
    ]);
    expect(ctx?.inspirationImageUrls).toEqual([
      "https://cdn.example.com/cover.jpg",
    ]);
  });

  it("returns metadata-only context when brief is null", () => {
    const ctx = briefToPromptContext(null, "Just a title", []);
    expect(ctx).toEqual({ title: "Just a title" });
  });

  it("returns undefined when nothing usable is provided", () => {
    expect(briefToPromptContext(null, "   ", [])).toBeUndefined();
  });
});
