import { describe, it, expect } from "vitest";
import {
  canNavigateToWizardStep,
  getMaxReachableWizardStep,
} from "@/lib/wizard-validation";
import { buildExpressWizardPatch } from "@/lib/wizard-express";
import type { WizardData } from "@/hooks/use-influencer-wizard";

describe("wizard flow integration", () => {
  it("express patch unlocks step 2 then step 4 after portrait", () => {
    const data = buildExpressWizardPatch(() => 0.1) as WizardData;
    expect(getMaxReachableWizardStep(data, [], 0)).toBe(2);

    const withPortrait = {
      ...data,
      baseImageUrl: "https://cdn.example.com/p.jpg",
    };
    expect(getMaxReachableWizardStep(withPortrait, [], 0)).toBe(4);
    expect(canNavigateToWizardStep(4, withPortrait, [], 0)).toBe(true);
    expect(canNavigateToWizardStep(3, withPortrait, [], 0)).toBe(true);
  });
});
