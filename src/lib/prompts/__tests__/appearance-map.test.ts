import { describe, it, expect } from "vitest";
import {
  APPEARANCE_MAP,
  mapAppearance,
  mapProportionLevels,
  mapTattoos,
  mapWizardHairStyle,
} from "@/lib/prompts/appearance-map";
import { buildBasePortraitPrompt } from "@/lib/prompts/image-prompts";
import { fingerprintFromWizard } from "@/lib/prompts/appearance-variation-ui";

describe("appearance-map", () => {
  it("maps French wizard values to English prompt tokens", () => {
    expect(mapAppearance(APPEARANCE_MAP.ethnicity, "Caucasienne")).toBe(
      "caucasian"
    );
    expect(mapAppearance(APPEARANCE_MAP.hairColor, "Brun")).toBe("dark brown");
    expect(mapAppearance(APPEARANCE_MAP.bodyType, "Athlétique")).toBe(
      "athletic"
    );
    expect(mapWizardHairStyle("Mi-long, Ondulé")).toBe(
      "shoulder length wavy"
    );
  });

  it("passes through unknown values as lowercase", () => {
    expect(mapAppearance(APPEARANCE_MAP.ethnicity, "Martienne")).toBe(
      "martienne"
    );
  });

  it("passes through English values unchanged", () => {
    expect(mapAppearance(APPEARANCE_MAP.ethnicity, "caucasian")).toBe(
      "caucasian"
    );
    expect(mapAppearance(APPEARANCE_MAP.hairColor, "brown")).toBe("dark brown");
    expect(mapAppearance(APPEARANCE_MAP.bodyType, "athletic")).toBe("athletic");
  });

  it("returns empty string unchanged from mapAppearance", () => {
    expect(mapAppearance(APPEARANCE_MAP.ethnicity, "")).toBe("");
  });

  it("buildBasePortraitPrompt uses English tokens for French wizard input", () => {
    const prompt = buildBasePortraitPrompt({
      age: 24,
      gender: "female",
      ethnicity: "Caucasienne",
      hairColor: "Brun",
      hairStyle: "Mi-long, Ondulé",
      bodyType: "Athlétique",
      fashionStyle: "Casual",
    });
    expect(prompt).toContain("caucasian");
    expect(prompt).toContain("dark brown");
    expect(prompt).toContain("shoulder length wavy");
    expect(prompt).toContain("athletic");
    expect(prompt).not.toContain("caucasienne");
    expect(prompt).not.toContain("brun");
    expect(prompt).not.toContain("athlétique");
  });

  it("maps v2 appearance fields (skinTone, height, proportions, tattoos)", () => {
    expect(mapAppearance(APPEARANCE_MAP.skinTone, "Mate")).toBe(
      "tan olive skin"
    );
    expect(mapAppearance(APPEARANCE_MAP.height, "Grande")).toContain("tall");
    expect(mapProportionLevels({ bustLevel: 1, hipsLevel: -1 })).toContain(
      "bust"
    );
    expect(mapTattoos(["Bras", "Dos"])).toContain("arm");
  });

  it("grades proportions across the full -3..+3 scale", () => {
    expect(mapProportionLevels({ bustLevel: 3 })).toContain(
      "extra full voluptuous bust"
    );
    expect(mapProportionLevels({ bustLevel: -3 })).toContain("flat chest");
    expect(mapProportionLevels({ hipsLevel: 2 })).toContain(
      "very wide curvy hips"
    );
    // Out-of-range values clamp instead of producing empty tokens.
    expect(mapProportionLevels({ shouldersLevel: 9 })).toBeTruthy();
  });

  it("skips the neutral baseline for content prompts (includeNeutral: false)", () => {
    expect(
      mapProportionLevels({ bustLevel: 0, hipsLevel: 0, shouldersLevel: 0 })
    ).toContain("balanced");
    expect(
      mapProportionLevels(
        { bustLevel: 0, hipsLevel: 2, shouldersLevel: 0 },
        { includeNeutral: false }
      )
    ).toBe("very wide curvy hips");
  });

  it("maps atypical body types to English tokens", () => {
    expect(mapAppearance(APPEARANCE_MAP.bodyType, "Sablier")).toContain(
      "hourglass"
    );
    expect(mapAppearance(APPEARANCE_MAP.bodyType, "Abdos définis")).toContain(
      "defined abs"
    );
    expect(mapAppearance(APPEARANCE_MAP.bodyType, "Pulpeuse")).toContain(
      "voluptuous"
    );
  });

  it("buildBasePortraitPrompt includes v2 tokens", () => {
    const prompt = buildBasePortraitPrompt({
      age: 26,
      gender: "female",
      ethnicity: "Latina",
      hairColor: "Brun",
      hairStyle: "Long, Ondulé",
      bodyType: "Plus-size",
      fashionStyle: "Casual",
      skinTone: "Mate",
      height: "Grande",
      bustLevel: 1,
      hipsLevel: 0,
      shouldersLevel: -1,
      tattoos: ["Bras"],
      makeupLevel: "Glam",
    });
    expect(prompt).toContain("tan olive skin");
    expect(prompt).toContain("tall");
    expect(prompt).toContain("glamorous makeup");
  });

  it("fingerprintFromWizard changes when v2 fields change", () => {
    const variations = {
      faceShape: 0,
      eyeShape: 0,
      eyeColor: 0,
      nose: 0,
      distinctiveFeature: 0,
      expression: 0,
    };
    const base = fingerprintFromWizard(
      24,
      { gender: "female", ethnicity: "Latina", bodyType: "Curvy" },
      variations
    );
    const withSkin = fingerprintFromWizard(
      24,
      {
        gender: "female",
        ethnicity: "Latina",
        bodyType: "Curvy",
        skinTone: "Mate",
      },
      variations
    );
    expect(base).not.toBe(withSkin);
    expect(base).toMatch(/^[0-9a-f]{8}$/);
    expect(withSkin).toMatch(/^[0-9a-f]{8}$/);
  });
});
