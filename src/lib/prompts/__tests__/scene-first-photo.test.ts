import { describe, it, expect } from "vitest";
import {
  buildScenePlatePrompt,
  buildSceneFirstComposePrompt,
} from "@/lib/prompts/scene-first-photo";

describe("scene-first-photo", () => {
  it("buildScenePlatePrompt forbids people and emphasizes environment", () => {
    const p = buildScenePlatePrompt({
      sceneDescription: "busy gym with mirror and dumbbells",
      lighting: "natural",
    });
    expect(p).toContain("busy gym");
    expect(p).toMatch(/no people/i);
    expect(p).toMatch(/no faces/i);
    expect(p).not.toMatch(/same person/i);
  });

  it("buildSceneFirstComposePrompt anchors identity and last reference environment", () => {
    const p = buildSceneFirstComposePrompt({
      gender: "female",
      age: 24,
      sceneDescription: "gym mirror selfie while training",
      outfit: "black leggings and sports bra",
      pose: "selfie",
      expression: "natural",
    });
    expect(p).toContain("first reference");
    expect(p).toContain("last reference image");
    expect(p).toContain("gym mirror selfie");
    expect(p).toContain("black leggings");
  });
});
