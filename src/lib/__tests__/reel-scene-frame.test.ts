import { describe, it, expect } from "vitest";
import { buildReelSceneFrameParams, inferReelScenePreset } from "@/lib/reel-scene-frame";

describe("reel-scene-frame", () => {
  it("infers bathroom / grwm as bedroom preset", () => {
    expect(
      inferReelScenePreset("trying outfit in bathroom mirror", "grwm")
    ).toBe("bedroom");
  });

  it("builds scene description from script when scene field empty", () => {
    const p = buildReelSceneFrameParams({
      script: "She tries a red lace outfit in the bathroom mirror",
      videoType: "grwm",
    });
    expect(p.scene).toBe("bedroom");
    expect(p.sceneDescription).toContain("bathroom mirror");
    expect(p.outfit.toLowerCase()).toMatch(/lingerie|outfit|homewear/);
    expect(p.pose).toBe("candid");
    expect(p.style).toBe("candid");
  });

  it("prefers explicit sceneDescription over script", () => {
    const p = buildReelSceneFrameParams({
      script: "generic motion",
      sceneDescription: "Luxury hotel bathroom, marble tiles, warm light",
      outfit: "black silk robe",
      videoType: "talking_head",
    });
    expect(p.sceneDescription).toContain("Luxury hotel bathroom");
    expect(p.outfit).toBe("black silk robe");
  });
});
