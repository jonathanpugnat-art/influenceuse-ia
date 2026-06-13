import { describe, it, expect } from "vitest";
import { isMeaningfulWizardDraft } from "@/lib/wizard-draft";
import { defaultWizardAppearanceV2 } from "@/lib/appearance-v2";
import type { WizardData } from "@/hooks/use-influencer-wizard";

const emptyData: WizardData = {
  name: "",
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

describe("isMeaningfulWizardDraft", () => {
  it("returns false for empty step-1 defaults", () => {
    expect(
      isMeaningfulWizardDraft({
        step: 1,
        data: emptyData,
        generatedImages: [],
        selectedImageIndex: 0,
      })
    ).toBe(false);
  });

  it("returns true when step > 1", () => {
    expect(
      isMeaningfulWizardDraft({
        step: 2,
        data: emptyData,
        generatedImages: [],
        selectedImageIndex: 0,
      })
    ).toBe(true);
  });

  it("returns true when portraits were generated", () => {
    expect(
      isMeaningfulWizardDraft({
        step: 1,
        data: emptyData,
        generatedImages: ["https://example.com/a.jpg"],
        selectedImageIndex: 0,
      })
    ).toBe(true);
  });

  it("returns true when identity fields are filled", () => {
    expect(
      isMeaningfulWizardDraft({
        step: 1,
        data: { ...emptyData, name: "Luna", niche: "FITNESS" },
        generatedImages: [],
        selectedImageIndex: 0,
      })
    ).toBe(true);
  });
});
