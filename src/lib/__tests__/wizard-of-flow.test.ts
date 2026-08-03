import { describe, it, expect } from "vitest";
import {
  buildWizardPremiumPhotoSeed,
  buildWizardSocialPhotoSeed,
  clearNsfwWizardDefaults,
  deriveSocialUsername,
  ensureOfSocialDefaults,
  getNsfwWizardDefaults,
  isOfPrimaryWizard,
} from "@/lib/wizard-of-flow";

describe("wizard-of-flow", () => {
  it("derives a stable social username from name", () => {
    expect(deriveSocialUsername("Luna Fit")).toBe("luna_fit");
    expect(deriveSocialUsername("Élodie")).toBe("elodie");
  });

  it("applies NSFW defaults with ADULT niche and extended body", () => {
    const patch = getNsfwWizardDefaults({ name: "Mia", niche: "", onlyfansUsername: "" });
    expect(patch.isNsfw).toBe(true);
    expect(patch.niche).toBe("ADULT");
    expect(patch.bodyGenerationMode).toBe("extended");
    expect(patch.onlyfansEnabled).toBe(true);
    expect(patch.onlyfansUsername).toBe("mia");
  });

  it("preserves non-ADULT niche when already set", () => {
    const patch = getNsfwWizardDefaults({
      name: "Mia",
      niche: "FITNESS",
      onlyfansUsername: "mi_fit",
    });
    expect(patch.niche).toBe("FITNESS");
    expect(patch.onlyfansUsername).toBe("mi_fit");
  });

  it("clears OF fields when NSFW disabled", () => {
    expect(clearNsfwWizardDefaults()).toEqual({
      isNsfw: false,
      onlyfansEnabled: false,
      onlyfansUsername: "",
      bodyGenerationMode: "standard",
    });
  });

  it("detects OF-primary wizard", () => {
    expect(isOfPrimaryWizard({ isNsfw: true, onlyfansEnabled: false })).toBe(true);
    expect(isOfPrimaryWizard({ isNsfw: false, onlyfansEnabled: true })).toBe(true);
    expect(isOfPrimaryWizard({ isNsfw: false, onlyfansEnabled: false })).toBe(false);
  });

  it("ensureOfSocialDefaults fills missing handle", () => {
    const patch = ensureOfSocialDefaults({
      name: "Luna",
      isNsfw: true,
      onlyfansEnabled: false,
      onlyfansUsername: "",
      niche: "",
    });
    expect(patch?.onlyfansEnabled).toBe(true);
    expect(patch?.onlyfansUsername).toBe("luna");
  });

  it("seeds premium vs social photo creator", () => {
    const premium = buildWizardPremiumPhotoSeed("inf-1", "female");
    expect(premium.contentMode).toBe("NSFW");
    expect(premium.lookId).toBe("boudoir-bedroom");

    const social = buildWizardSocialPhotoSeed("inf-2", "female");
    expect(social.contentMode).toBe("SFW");
    expect(social.lookId).toBe("cafe-aesthetic");
  });
});
