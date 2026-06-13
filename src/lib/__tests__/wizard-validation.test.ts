import { describe, it, expect } from "vitest";
import {
  canNavigateToWizardStep,
  getMaxReachableWizardStep,
  isIdentityStepComplete,
  isAppearanceStepComplete,
} from "@/lib/wizard-validation";
import { defaultWizardAppearanceV2 } from "@/lib/appearance-v2";
import type { WizardData } from "@/hooks/use-influencer-wizard";

const baseData: WizardData = {
  name: "Luna",
  gender: "female",
  bio: "Fitness lover and lifestyle creator based in Paris.",
  personality: "Confident, warm, and always positive with her community.",
  niche: "FITNESS",
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

describe("wizard-validation", () => {
  it("detects incomplete identity", () => {
    expect(isIdentityStepComplete({ ...baseData, name: "L" })).toBe(false);
    expect(getMaxReachableWizardStep({ ...baseData, name: "L" }, [], 0)).toBe(1);
  });

  it("allows step 2 when identity is complete", () => {
    expect(isIdentityStepComplete(baseData)).toBe(true);
    expect(getMaxReachableWizardStep(baseData, [], 0)).toBe(2);
  });

  it("allows steps 3–4 when portrait exists", () => {
    const withPortrait = {
      ...baseData,
      baseImageUrl: "https://cdn.example.com/p.jpg",
    };
    expect(isAppearanceStepComplete(withPortrait, [], 0)).toBe(true);
    expect(getMaxReachableWizardStep(withPortrait, [], 0)).toBe(4);
    expect(canNavigateToWizardStep(4, withPortrait, [], 0)).toBe(true);
    expect(canNavigateToWizardStep(3, withPortrait, [], 0)).toBe(true);
  });

  it("blocks step 3 without portrait", () => {
    expect(canNavigateToWizardStep(3, baseData, [], 0)).toBe(false);
  });
});
