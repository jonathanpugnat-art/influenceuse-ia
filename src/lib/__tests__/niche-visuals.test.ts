import { describe, expect, it } from "vitest";
import {
  coerceNicheCategory,
  isNicheProfileUsable,
  parseNicheProfile,
} from "@/lib/niche-profile";
import {
  NICHE_VISUAL_PRESETS,
  resolveNicheVisuals,
} from "@/lib/niche-visual-presets";
import { buildSceneBlock } from "@/lib/prompts/image-prompts";

describe("niche-profile", () => {
  it("coerces localized/lowercase niche aliases", () => {
    expect(coerceNicheCategory("fitness")).toBe("FITNESS");
    expect(coerceNicheCategory("Mode")).toBe("FASHION");
    expect(coerceNicheCategory("onlyfans")).toBe("ADULT");
    expect(coerceNicheCategory("inconnu")).toBeUndefined();
  });

  it("returns a defaulted profile from the fallback category", () => {
    const profile = parseNicheProfile(undefined, "FITNESS");
    expect(profile?.nicheCategory).toBe("FITNESS");
    expect(profile?.contentPillars).toEqual([]);
    expect(profile?.visualCodes.settings).toEqual([]);
  });

  it("returns null when no category can be resolved", () => {
    expect(parseNicheProfile({ subNiche: "x" })).toBeNull();
  });

  it("salvages the category when optional fields are malformed", () => {
    const profile = parseNicheProfile(
      { nicheCategory: "FOOD", contentPillars: "not-an-array" },
      "FITNESS"
    );
    expect(profile?.nicheCategory).toBe("FOOD");
  });

  it("flags usable profiles", () => {
    expect(isNicheProfileUsable(parseNicheProfile(undefined, "FITNESS"))).toBe(
      false
    );
    expect(
      isNicheProfileUsable(
        parseNicheProfile({ nicheCategory: "FITNESS", subNiche: "crossfit" })
      )
    ).toBe(true);
  });
});

describe("resolveNicheVisuals", () => {
  it("falls back to the niche preset with no profile", () => {
    const visuals = resolveNicheVisuals("FITNESS");
    expect(visuals).toEqual(NICHE_VISUAL_PRESETS.FITNESS);
  });

  it("lets profile codes override the preset", () => {
    const profile = parseNicheProfile({
      nicheCategory: "FITNESS",
      visualCodes: { settings: ["powerlifting gym"], lighting: "harsh" },
    });
    const visuals = resolveNicheVisuals("FITNESS", profile);
    expect(visuals?.settings).toEqual(["powerlifting gym"]);
    expect(visuals?.lighting).toBe("harsh");
    // wardrobe not provided by profile → preset fills the gap
    expect(visuals?.wardrobe).toEqual(NICHE_VISUAL_PRESETS.FITNESS.wardrobe);
  });

  it("returns undefined without niche or profile", () => {
    expect(resolveNicheVisuals(undefined)).toBeUndefined();
  });
});

describe("buildSceneBlock niche injection", () => {
  it("injects the niche setting when no explicit scene is given", () => {
    const block = buildSceneBlock({
      nicheVisuals: resolveNicheVisuals("FITNESS"),
    });
    expect(block).toContain("niche setting:");
    expect(block).toContain("color palette:");
  });

  it("does not override an explicit scene/location", () => {
    const block = buildSceneBlock({
      location: "Paris",
      lighting: "studio",
      nicheVisuals: resolveNicheVisuals("FITNESS"),
    });
    expect(block).not.toContain("niche setting:");
    // explicit lighting wins → no niche lighting line
    expect(block).not.toContain("bright natural daylight");
  });
});
