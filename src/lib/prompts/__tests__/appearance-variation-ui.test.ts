import { describe, it, expect } from "vitest";
import {
  normalizeAppearanceVariation,
  fingerprintFromWizard,
  APPEARANCE_EXPERT_SECTIONS,
} from "@/lib/prompts/appearance-variation-ui";
import { APPEARANCE_VARIATIONS } from "@/lib/prompts/image-prompts";

describe("appearance-variation-ui", () => {
  it("normalizes out-of-range indices", () => {
    const v = normalizeAppearanceVariation({
      faceShape: 999,
      eyeShape: 0,
      eyeColor: 0,
      nose: 0,
      distinctiveFeature: 0,
      expression: 0,
    });
    expect(v.faceShape).toBe(APPEARANCE_VARIATIONS.faceShape.length - 1);
  });

  it("expert sections cover every variation key", () => {
    const keys = new Set(APPEARANCE_EXPERT_SECTIONS.map((s) => s.key));
    expect(keys.has("faceShape")).toBe(true);
    expect(keys.has("nose")).toBe(true);
    expect(keys.size).toBe(6);
  });

  it("fingerprint is stable for same inputs", () => {
    const variations = normalizeAppearanceVariation({
      faceShape: 1,
      eyeShape: 2,
      eyeColor: 3,
      nose: 0,
      distinctiveFeature: 4,
      expression: 5,
    });
    const a = fingerprintFromWizard(24, { gender: "female", ethnicity: "Caucasienne" }, variations);
    const b = fingerprintFromWizard(24, { gender: "female", ethnicity: "Caucasienne" }, variations);
    expect(a).toBe(b);
    expect(a).toHaveLength(8);
  });
});
