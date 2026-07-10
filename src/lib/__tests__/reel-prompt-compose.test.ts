import { describe, it, expect } from "vitest";
import {
  composeReelParamsFromPrompt,
  inferReelContentModeFromPrompt,
} from "@/lib/reel-prompt-compose";

describe("reel-prompt-compose", () => {
  it("routes boudoir prompts to NSFW on premium plan", () => {
    expect(
      inferReelContentModeFromPrompt("miroir lingerie chambre", {
        influencerIsNsfw: false,
        hasNsfwPlan: true,
      })
    ).toBe("NSFW");
  });

  it("composes vertical reel from one prompt", () => {
    const params = composeReelParamsFromPrompt({
      prompt: "GRWM miroir salle de bain, lumière matinale, sourire naturel",
      influencerIsNsfw: false,
      hasNsfwPlan: false,
    });
    expect(params.format).toBe("VERTICAL");
    expect(params.videoType).toBe("grwm");
    expect(params.script).toContain("GRWM");
    expect(params.generateSceneFrame).toBe(true);
  });
});
