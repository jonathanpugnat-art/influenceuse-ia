import { describe, it, expect } from "vitest";
import { buildReelNarrationText } from "@/lib/reel-narration";

describe("buildReelNarrationText", () => {
  it("prefers script when long enough", () => {
    expect(
      buildReelNarrationText({
        script: "Bonjour à tous, voici mon avis produit du jour.",
        sceneDescription: "Gym",
      })
    ).toContain("avis produit");
  });

  it("merges scene and outfit when script is short", () => {
    const text = buildReelNarrationText({
      script: "Hi",
      sceneDescription: "Modern cafe, morning light",
      outfit: "Beige blazer",
    });
    expect(text).toContain("Modern cafe");
    expect(text).toContain("Beige blazer");
  });
});
