import { describe, it, expect } from "vitest";
import {
  hasUserSceneDescription,
  shouldEnrichForImagePrompt,
  stripScenePropsSuffix,
  looksNonEnglish,
} from "@/lib/photo-scene-user";

describe("photo-scene-user", () => {
  it("hasUserSceneDescription requires minimum length after trim", () => {
    expect(hasUserSceneDescription("")).toBe(false);
    expect(hasUserSceneDescription("plage")).toBe(false);
    expect(hasUserSceneDescription("plage au coucher du soleil")).toBe(true);
  });

  it("stripScenePropsSuffix removes props suffix", () => {
    expect(stripScenePropsSuffix("café parisien [Props: sac à main]")).toBe("café parisien");
  });

  it("looksNonEnglish detects French hints", () => {
    expect(looksNonEnglish("sunny beach in Bali")).toBe(false);
    expect(looksNonEnglish("plage au coucher du soleil")).toBe(true);
  });

  it("shouldEnrichForImagePrompt for French or short English scenes", () => {
    expect(shouldEnrichForImagePrompt("plage au coucher du soleil")).toBe(true);
    expect(
      shouldEnrichForImagePrompt(
        "real beach in daylight with golden sand and soft waves in the background"
      )
    ).toBe(false);
    expect(shouldEnrichForImagePrompt("short scene", "robe noire élégante")).toBe(true);
  });
});
