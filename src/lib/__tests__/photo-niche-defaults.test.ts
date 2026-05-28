import { describe, it, expect } from "vitest";
import {
  getNichePhotoDefaults,
  getOutfitSuggestionsForNiche,
} from "@/lib/photo-niche-defaults";

describe("photo-niche-defaults", () => {
  it("returns gym scene and outfit for FITNESS female", () => {
    const d = getNichePhotoDefaults("FITNESS", "female");
    expect(d.scene).toBe("gym");
    expect(d.sceneDescription).toContain("gym");
    expect(d.outfit).toContain("Legging");
    expect(d.useFaceReference).toBe(true);
  });

  it("returns outfit suggestions per gender", () => {
    const male = getOutfitSuggestionsForNiche("FITNESS", "male");
    expect(male[0]).toContain("débardeur");
  });

  it("falls back to generic outfits when niche is unknown", () => {
    const list = getOutfitSuggestionsForNiche("UNKNOWN_NICHE", "female");
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((o) => o.includes("Robe") || o.includes("Jean"))).toBe(true);
  });
});
