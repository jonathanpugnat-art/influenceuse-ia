import { describe, expect, it } from "vitest";
import { inspireWizardAngle } from "@/lib/wizard-angle-inspire";

describe("inspireWizardAngle", () => {
  it("returns a non-empty phrase within 120 chars", () => {
    const angle = inspireWizardAngle("FASHION", "fr");
    expect(angle.length).toBeGreaterThanOrEqual(5);
    expect(angle.length).toBeLessThanOrEqual(120);
  });

  it("avoids repeating the previous phrase when possible", () => {
    const first = inspireWizardAngle("FITNESS", "en");
    const samples = new Set<string>();
    for (let i = 0; i < 12; i++) {
      samples.add(inspireWizardAngle("FITNESS", "en", first));
    }
    expect([...samples].some((s) => s !== first)).toBe(true);
  });

  it("works without a niche", () => {
    const angle = inspireWizardAngle(undefined, "fr");
    expect(angle).toContain(",");
  });
});
