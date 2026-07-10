import { describe, it, expect } from "vitest";
import { ensureWizardMinimumFields, isQuickWizardReady } from "@/lib/wizard-quick-defaults";
import { defaultWizardAppearanceV2 } from "@/lib/appearance-v2";
import type { WizardData } from "@/hooks/use-influencer-wizard";

const base: WizardData = {
  name: "Mia",
  gender: "female",
  bio: "",
  personality: "",
  niche: "",
  age: 24,
  isNsfw: false,
  ethnicity: "",
  hairColor: "",
  hairLength: "",
  hairTexture: "",
  fashionStyles: [],
  ...defaultWizardAppearanceV2(),
  baseImageUrl: "",
  instagramEnabled: false,
  instagramUsername: "",
  tiktokEnabled: false,
  tiktokUsername: "",
  onlyfansEnabled: false,
  onlyfansUsername: "",
};

describe("wizard-quick-defaults", () => {
  it("fills bio and personality when missing", () => {
    const filled = ensureWizardMinimumFields(base);
    expect(filled.bio.length).toBeGreaterThanOrEqual(10);
    expect(filled.personality.length).toBeGreaterThanOrEqual(10);
    expect(filled.niche).toBe("LIFESTYLE");
  });

  it("uses brief as bio when long enough", () => {
    const filled = ensureWizardMinimumFields({
      ...base,
      brief: "Influenceuse fitness parisienne, énergie positive.",
    });
    expect(filled.bio).toContain("fitness");
  });

  it("detects quick wizard readiness", () => {
    expect(isQuickWizardReady(base, null)).toBe(false);
    expect(isQuickWizardReady({ ...base, name: "M" }, "https://x.jpg")).toBe(false);
    expect(isQuickWizardReady(base, "https://x.jpg")).toBe(true);
  });
});
