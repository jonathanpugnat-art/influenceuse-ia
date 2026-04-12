import { describe, it, expect } from "vitest";
import {
  buildFullPrompt,
  buildNegativePrompt,
  buildBasePortraitPrompt,
  NEGATIVE_PROMPT_SFW,
  NEGATIVE_PROMPT_NSFW,
  NSFW_TEMPLATES,
} from "@/lib/prompts/image-prompts";

describe("image-prompts", () => {
  describe("buildFullPrompt", () => {
    it("generates a coherent prompt with all main parameters", () => {
      const result = buildFullPrompt({
        age: 25,
        ethnicity: "Caucasian",
        hairColor: "blonde",
        hairStyle: "long",
        bodyType: "slim",
        fashionStyle: "casual",
        scene: "beach",
        pose: "fullBody",
        expression: "smile",
        style: "natural",
        lighting: "golden_hour",
        outfit: "summer dress",
        customPrompt: "wind in hair",
      });
      expect(result).toContain("25 years old");
      expect(result).toContain("caucasian");
      expect(result).toContain("blonde long hair");
      expect(result).toContain("slim build");
      expect(result).toContain("wearing summer dress");
      expect(result).toContain("real beach");
      expect(result).toContain("OOTD");
      expect(result).toContain("genuine big smile");
      expect(result).toContain("golden hour");
      expect(result).toContain("iPhone 15 Pro");
      expect(result).toContain("Instagram");
      expect(result).toContain("wind in hair");
    });

    it("includes NSFW template only when isNsfw is true and nsfwLevel is set", () => {
      const sfw = buildFullPrompt({
        isNsfw: false,
        nsfwLevel: "suggestive",
        expression: "natural",
      });
      expect(sfw).not.toContain(NSFW_TEMPLATES.suggestive);
      expect(sfw).not.toContain("lingerie");

      const nsfw = buildFullPrompt({
        isNsfw: true,
        nsfwLevel: "suggestive",
        expression: "natural",
      });
      expect(nsfw).toContain(NSFW_TEMPLATES.suggestive);
      expect(nsfw).toContain("lingerie");
    });

    it("does not add NSFW when isNsfw is true but nsfwLevel is unknown", () => {
      const result = buildFullPrompt({
        isNsfw: true,
        nsfwLevel: "unknown_key",
        expression: "natural",
      });
      expect(result).not.toContain("explicit");
      expect(result).toContain("iPhone 15 Pro");
    });

    it("uses fallback for unknown scene/pose/expression keys", () => {
      const result = buildFullPrompt({
        scene: "custom_scene",
        pose: "custom_pose",
        expression: "custom_expr",
      });
      expect(result).toContain("custom_scene");
      expect(result).toContain("custom_pose");
      expect(result).toContain("custom_expr");
    });

    it("always ends with quality and can append customPrompt", () => {
      const result = buildFullPrompt({
        customPrompt: "extra detail",
      });
      expect(result).toContain("iPhone 15 Pro");
      expect(result).toContain("Instagram");
      expect(result).toContain("extra detail");
    });
  });

  describe("buildNegativePrompt", () => {
    it("returns SFW negative prompt when isNsfw is false", () => {
      const result = buildNegativePrompt(false);
      expect(result).toBe(NEGATIVE_PROMPT_SFW);
      expect(result).toContain("nsfw");
      expect(result).toContain("nude");
    });

    it("returns NSFW negative prompt when isNsfw is true", () => {
      const result = buildNegativePrompt(true);
      expect(result).toBe(NEGATIVE_PROMPT_NSFW);
      expect(result).not.toContain("nsfw");
      expect(result).not.toContain("nude");
    });
  });

  describe("buildBasePortraitPrompt", () => {
    it("replaces all placeholders with input values", () => {
      const result = buildBasePortraitPrompt({
        age: 28,
        ethnicity: "Asian",
        hairColor: "black",
        hairStyle: "straight",
        bodyType: "athletic",
        fashionStyle: "streetwear",
      });
      expect(result).toContain("28");
      expect(result).toContain("asian");
      expect(result).toContain("black");
      expect(result).toContain("straight");
      expect(result).toContain("athletic");
      expect(result).toContain("streetwear");
    });
  });
});
