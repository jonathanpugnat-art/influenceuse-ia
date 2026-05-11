import { describe, it, expect } from "vitest";
import {
  buildContentPlanSystemPrompt,
  buildIdeasSystemPrompt,
  JSON_REPAIR_INSTRUCTION,
} from "@/lib/prompts/content-plan-prompts";

describe("content-plan-prompts", () => {
  describe("buildContentPlanSystemPrompt", () => {
    it("includes all influencer context fields", () => {
      const p = buildContentPlanSystemPrompt({
        influencerName: "Lina",
        influencerGender: "female",
        niche: "FASHION",
        personality: "playful and bold",
        bio: "Paris-based fashion creator",
        language: "fr",
        platforms: ["INSTAGRAM", "TIKTOK"],
        days: 7,
        postsPerDay: 2,
        goals: "growth",
      });
      expect(p).toContain("Lina");
      expect(p).toContain("FASHION");
      expect(p).toContain("playful and bold");
      expect(p).toContain("Paris-based fashion creator");
      expect(p).toContain("INSTAGRAM, TIKTOK");
      expect(p).toContain("7 days");
      expect(p).toContain("2 post(s)/day");
      expect(p).toContain("français");
      expect(p).toContain("growth");
    });

    it("enforces masculine outfits warning", () => {
      const p = buildContentPlanSystemPrompt({
        influencerName: "Marc",
        influencerGender: "male",
        niche: "FITNESS",
        personality: "disciplined and motivating",
        bio: "calisthenics coach",
        language: "en",
        platforms: ["TIKTOK"],
        days: 3,
        postsPerDay: 1,
      });
      expect(p).toContain("Outfits MUST match the influencer gender");
      expect(p).toContain("NEVER suggest dresses");
    });

    it("requests strict JSON output", () => {
      const p = buildContentPlanSystemPrompt({
        influencerName: "Sam",
        influencerGender: "nonbinary",
        niche: "LIFESTYLE",
        personality: "calm and curious",
        bio: "minimalism daily",
        language: "en",
        platforms: ["INSTAGRAM"],
        days: 1,
        postsPerDay: 1,
      });
      expect(p).toContain("STRICT JSON");
      expect(p).toContain('"posts"');
      expect(p).toContain('"hashtags"');
    });
  });

  describe("buildIdeasSystemPrompt", () => {
    it("asks for an exact count of ideas as JSON array", () => {
      const p = buildIdeasSystemPrompt({
        influencerName: "Nora",
        niche: "TRAVEL",
        personality: "adventurous",
        language: "fr",
        platform: "INSTAGRAM",
        count: 5,
      });
      expect(p).toContain("EXACTLY 5 ideas");
      expect(p).toContain("JSON array");
      expect(p).toContain("INSTAGRAM");
      expect(p).toContain("TRAVEL");
      expect(p).toContain("Nora");
    });
  });

  describe("JSON_REPAIR_INSTRUCTION", () => {
    it("is non-empty and references JSON", () => {
      expect(JSON_REPAIR_INSTRUCTION.length).toBeGreaterThan(20);
      expect(JSON_REPAIR_INSTRUCTION.toLowerCase()).toContain("json");
    });
  });
});
