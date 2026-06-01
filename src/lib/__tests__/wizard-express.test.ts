import { describe, it, expect } from "vitest";
import {
  buildExpressWizardPatch,
  EXPRESS_TEMPLATE_ID,
  getExpressTemplate,
} from "@/lib/wizard-express";
import { isIdentityStepComplete } from "@/lib/wizard-validation";
import type { WizardData } from "@/hooks/use-influencer-wizard";

describe("wizard-express", () => {
  it("uses the fitness_girl template by default", () => {
    expect(getExpressTemplate().id).toBe(EXPRESS_TEMPLATE_ID);
  });

  it("builds a complete identity for express flow", () => {
    const patch = buildExpressWizardPatch(() => 0.5);
    const data = patch as WizardData;
    expect(data.name?.length).toBeGreaterThanOrEqual(2);
    expect(data.niche).toBe("FITNESS");
    expect(data.bio?.length).toBeGreaterThanOrEqual(10);
    expect(data.personality?.length).toBeGreaterThanOrEqual(10);
    expect(isIdentityStepComplete(data)).toBe(true);
    expect(data.appearanceVariations).toBeDefined();
    expect(data.appearanceFingerprint).toBeTruthy();
  });
});
