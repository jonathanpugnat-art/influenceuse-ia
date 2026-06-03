import { describe, expect, it } from "vitest";
import {
  applyStudioLook,
  buildLookSceneDescription,
  getOutfitOptionsForLook,
  getStudioLook,
  PHOTO_STUDIO_LOOKS,
} from "@/lib/photo-studio-looks";
import { hasUserSceneDescription } from "@/lib/photo-scene-user";

describe("photo-studio-looks", () => {
  it("exposes one look per content template", () => {
    expect(PHOTO_STUDIO_LOOKS.length).toBeGreaterThan(5);
    expect(getStudioLook("cafe-aesthetic")?.nameFr).toBeTruthy();
  });

  it("applyStudioLook fills scene and enables instagram shot", () => {
    const applied = applyStudioLook("cafe-aesthetic", "female");
    expect(applied.lookId).toBe("cafe-aesthetic");
    expect(applied.instagramShot).toBe(true);
    expect(applied.scene).toBe("cafe");
    expect(hasUserSceneDescription(applied.sceneDescription)).toBe(true);
    expect(applied.pose).toBeTruthy();
    expect(applied.outfit).toBeTruthy();
  });

  it("buildLookSceneDescription appends optional detail", () => {
    const base = buildLookSceneDescription("beach-vibes");
    const withDetail = buildLookSceneDescription("beach-vibes", "sunset glow");
    expect(withDetail).toContain(base);
    expect(withDetail).toContain("sunset glow");
  });

  it("getOutfitOptionsForLook returns default plus alternatives", () => {
    const options = getOutfitOptionsForLook("cafe-aesthetic", "female");
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]).toBeTruthy();
  });
});
