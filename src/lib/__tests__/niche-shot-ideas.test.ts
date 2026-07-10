import { describe, expect, it } from "vitest";
import {
  buildNicheShotIdeas,
  nicheShotToPhotoSeed,
} from "@/lib/niche-shot-ideas";
import { parseNicheProfile } from "@/lib/niche-profile";

describe("niche-shot-ideas", () => {
  const profile = parseNicheProfile({
    nicheCategory: "FITNESS",
    subNiche: "crossfit",
    contentPillars: ["WOD du jour", "Nutrition", "Recovery"],
    visualCodes: {
      settings: ["salle de sport", "parc"],
      wardrobe: ["legging + brassière"],
      lighting: "lumière matinale",
      palette: ["gris", "noir"],
      framing: ["plan mouvement"],
    },
  })!;

  it("builds shot ideas from content pillars", () => {
    const ideas = buildNicheShotIdeas(profile);
    expect(ideas.length).toBeGreaterThanOrEqual(2);
    expect(ideas[0]?.title).toBe("WOD du jour");
    expect(ideas[0]?.sceneDescription).toContain("salle de sport");
  });

  it("returns empty when profile is not usable", () => {
    expect(buildNicheShotIdeas(parseNicheProfile(undefined, "FITNESS"))).toEqual(
      []
    );
  });

  it("maps a shot idea to a photo creator seed", () => {
    const idea = buildNicheShotIdeas(profile)[0]!;
    const seed = nicheShotToPhotoSeed(idea, "inf_123");
    expect(seed.influencerId).toBe("inf_123");
    expect(seed.sceneDescription).toBe(idea.sceneDescription);
    expect(seed.useFaceReference).toBe(true);
  });
});
