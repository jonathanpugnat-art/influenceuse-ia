import { describe, it, expect } from "vitest";
import {
  applyStudioLocation,
  applyStudioRecipe,
  isStudioLocationSelected,
  studioSceneRecapText,
} from "@/lib/photo-studio-scenes";
import { getSceneInspirationText } from "@/lib/prompts/image-prompts";

describe("photo-studio-scenes", () => {
  it("applyStudioLocation sets canonical scene description", () => {
    const patch = applyStudioLocation("beach");
    expect(patch.scene).toBe("beach");
    expect(patch.sceneDescription).toBe(getSceneInspirationText("beach"));
    expect(patch.pose).toBeTruthy();
  });

  it("isStudioLocationSelected is true only for matching canonical text", () => {
    const canonical = getSceneInspirationText("cafe");
    expect(
      isStudioLocationSelected("cafe", { scene: "cafe", sceneDescription: canonical })
    ).toBe(true);
    expect(
      isStudioLocationSelected("cafe", { scene: "cafe", sceneDescription: "custom café vibe" })
    ).toBe(false);
  });

  it("studioSceneRecapText prefers selected location label", () => {
    const canonical = getSceneInspirationText("nature");
    const recap = studioSceneRecapText(
      { scene: "nature", sceneDescription: canonical },
      (id) => (id === "nature" ? "Nature" : id)
    );
    expect(recap).toBe("Nature");
  });

  it("studioSceneRecapText falls back to trimmed custom description", () => {
    const recap = studioSceneRecapText(
      { scene: "custom", sceneDescription: "rooftop bar at sunset" },
      () => "unused"
    );
    expect(recap).toBe("rooftop bar at sunset");
  });

  it("applyStudioRecipe cafe intent sets outfit and scene", () => {
    const patch = applyStudioRecipe("cafe_morning", "female", "lifestyle");
    expect(patch.scene).toBeTruthy();
    expect(patch.outfit?.length).toBeGreaterThan(0);
  });
});
