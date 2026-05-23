import { describe, it, expect } from "vitest";
import {
  mapVideoTypeToReelKey,
  mergeRecommendationWithBrief,
} from "@/lib/trends/trend-format-brief";

describe("trend-format-brief", () => {
  it("maps reel video hints", () => {
    expect(mapVideoTypeToReelKey("GRWM morning routine")).toBe("grwm");
    expect(mapVideoTypeToReelKey("snap transition trend")).toBe("transition");
  });

  it("merges brief scene into recommendation fields", () => {
    const merged = mergeRecommendationWithBrief(
      {
        type: "PHOTO",
        platform: "INSTAGRAM",
        scene: "studio",
        pose: "portrait",
        expression: "smile",
        outfit: "",
        customPrompt: "",
        hook: "test hook",
      },
      {
        contentType: "PHOTO",
        mood: "cozy",
        sceneDescription: "coffee shop terrace, morning light, no mirror",
        pose: "candid",
        expression: "natural",
        outfit: "beige blazer",
        lighting: "soft daylight",
        cameraStyle: "iPhone candid",
        hook: "Morning coffee run",
        customPrompt: "busy street blurred",
        confidence: "high",
        analyzedFrom: "vision",
        inspirationNotes: "cafe POV format",
      }
    );
    expect(merged.sceneDescription).toContain("coffee shop terrace");
    expect(merged.outfit).toBe("beige blazer");
  });
});
