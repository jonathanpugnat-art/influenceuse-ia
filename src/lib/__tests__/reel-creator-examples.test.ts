import { describe, it, expect } from "vitest";
import {
  REEL_CREATOR_EXAMPLES,
  getReelExampleById,
} from "@/lib/reel-creator-examples";

describe("reel-creator-examples", () => {
  it("has unique ids and valid videoType for each recipe", () => {
    const ids = new Set<string>();
    for (const ex of REEL_CREATOR_EXAMPLES) {
      expect(ex.id).toBe(ex.labelKey);
      expect(ex.sceneDescription.length).toBeGreaterThan(20);
      expect(ex.script.length).toBeGreaterThan(20);
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);
    }
  });

  it("getReelExampleById returns a recipe", () => {
    const ex = getReelExampleById("grwm_mirror");
    expect(ex?.videoType).toBe("grwm");
  });
});
