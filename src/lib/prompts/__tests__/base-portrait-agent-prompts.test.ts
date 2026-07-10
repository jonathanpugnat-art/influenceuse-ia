import { describe, expect, it } from "vitest";
import {
  buildBasePortraitRecommendUserPrompt,
  validateBasePortraitRecommend,
} from "@/lib/prompts/base-portrait-agent-prompts";

describe("base-portrait-agent-prompts", () => {
  it("builds user prompt with brief and catalog", () => {
    const prompt = buildBasePortraitRecommendUserPrompt({
      locale: "fr",
      niche: "ADULT",
      gender: "female",
      brief: "Influenceuse OF premium parisienne",
      portraits: [
        {
          id: "p1",
          ethnicity: "Latina",
          bodyType: "Curvy",
          isNsfw: true,
          tags: ["premium", "boudoir"],
        },
      ],
    });
    expect(prompt).toContain("INFLUENCER BRIEF");
    expect(prompt).toContain("id=p1");
  });

  it("validates recommended ids", () => {
    const parsed = validateBasePortraitRecommend({
      recommendedIds: ["a", "b"],
      rationale: "Aligné avec le positionnement premium.",
    });
    expect(parsed.recommendedIds).toEqual(["a", "b"]);
  });
});
