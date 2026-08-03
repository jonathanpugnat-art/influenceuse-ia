import { describe, it, expect } from "vitest";
import {
  clampPremiumNsfwLevel,
  getPremiumPhotoDefaults,
  getSocialPhotoDefaults,
  laneFromContentMode,
} from "@/lib/premium-content";

describe("premium-content", () => {
  it("maps content mode to lane", () => {
    expect(laneFromContentMode("SFW")).toBe("social");
    expect(laneFromContentMode("NSFW")).toBe("premium");
  });

  it("preserves explicit nsfw level", () => {
    expect(clampPremiumNsfwLevel("explicit")).toBe("explicit");
    expect(clampPremiumNsfwLevel("soft")).toBe("soft");
    expect(clampPremiumNsfwLevel(undefined)).toBe("suggestive");
  });

  it("premium defaults use bedroom boudoir and NSFW suggestive", () => {
    const d = getPremiumPhotoDefaults();
    expect(d.contentMode).toBe("NSFW");
    expect(d.nsfwLevel).toBe("suggestive");
    expect(d.sceneDescription).toContain("boudoir");
    expect(d.useFaceReference).toBe(false);
  });

  it("social defaults use SFW and face reference", () => {
    const d = getSocialPhotoDefaults();
    expect(d.contentMode).toBe("SFW");
    expect(d.useFaceReference).toBe(true);
  });
});
