import { describe, it, expect } from "vitest";
import {
  softenPromptForEditorial,
  softenSocialFitnessLanguage,
  softenSuggestiveLanguage,
  softenSfwFitnessFields,
  softenSfwFieldsForKontext,
} from "@/lib/prompts/safety-soften";
import {
  buildDefaultDay1PhotoSeed,
  expandShortScene,
  nicheShotToPhotoSeed,
} from "@/lib/niche-shot-ideas";
import { shouldRouteToKontext } from "@/lib/prompts/nano-borderline";

describe("softenPromptForEditorial", () => {
  it("replaces sensitive tokens and adds editorial prefix", () => {
    const out = softenPromptForEditorial(
      "sexy lingerie in bathroom mirror, seductive pose"
    );
    expect(out).toContain("High-end Instagram fashion");
    expect(out).not.toMatch(/\bsexy\b/i);
    expect(out).toContain("lace lounge outfit");
  });
});

describe("softenSocialFitnessLanguage", () => {
  it("rewrites sports bra and leggings for SFW social models", () => {
    const out = softenSocialFitnessLanguage(
      "sports bra and black leggings, gym mirror selfie, GRWM"
    );
    expect(out).not.toMatch(/sports?\s*bra/i);
    expect(out).not.toMatch(/leggings/i);
    expect(out).toContain("fitted athletic top");
    expect(out).toContain("athletic pants");
    expect(out).toContain("morning routine");
  });
});

describe("softenSuggestiveLanguage", () => {
  it("keeps athletic wardrobe tokens for Kontext fidelity", () => {
    const out = softenSuggestiveLanguage(
      "sexy sports bra and black leggings after workout"
    );
    expect(out).not.toMatch(/\bsexy\b/i);
    expect(out).toMatch(/sports bra/i);
    expect(out).toMatch(/leggings/i);
  });
});

describe("softenSfwFitnessFields", () => {
  it("softens outfit and scene together", () => {
    const out = softenSfwFitnessFields({
      outfit: "sports bra + leggings",
      sceneDescription: "gym mirror selfie after workout",
      customPrompt: "sweat glow, seductive",
    });
    expect(out.outfit).toContain("fitted athletic top");
    expect(out.sceneDescription).toContain("gym training photo");
    expect(out.customPrompt).not.toMatch(/seductive/i);
  });

  it("disables instagram flash mode for fitness-adjacent scenes", () => {
    const out = softenSfwFitnessFields({
      outfit: "athletic pants and fitted top",
      sceneDescription: "bright gym training photo",
      instagramShot: true,
    });
    expect(out.instagramShot).toBe(false);
  });
});

describe("softenSfwFieldsForKontext", () => {
  it("keeps sports bra/leggings so borderline routing stays valid", () => {
    const raw = {
      outfit: "sports bra and black leggings",
      sceneDescription: "gym mirror selfie, seductive smile",
      instagramShot: true,
    };
    expect(shouldRouteToKontext(raw)).toBe(true);
    const out = softenSfwFieldsForKontext(raw);
    expect(out.outfit).toMatch(/sports bra/i);
    expect(out.outfit).toMatch(/leggings/i);
    expect(out.sceneDescription).not.toMatch(/seductive/i);
    expect(out.instagramShot).toBe(false);
    expect(shouldRouteToKontext(out)).toBe(true);
  });
});

describe("day-1 photo seeds", () => {
  it("expands thin niche scenes", () => {
    const out = expandShortScene("gym, workouts", "morning runs");
    expect(out.length).toBeGreaterThan(90);
    expect(out).toContain("morning runs");
  });

  it("builds a concrete cafe default seed", () => {
    const seed = buildDefaultDay1PhotoSeed("inf1", { niche: "LIFESTYLE" });
    expect(seed.scene).toBe("cafe");
    expect(seed.sceneDescription!.length).toBeGreaterThan(60);
    expect(seed.outfit!.length).toBeGreaterThan(20);
    expect(seed.useFaceReference).toBe(true);
  });

  it("builds a fitness outdoor default seed", () => {
    const seed = buildDefaultDay1PhotoSeed("inf1", { niche: "FITNESS" });
    expect(seed.sceneDescription).toMatch(/park|run/i);
    expect(seed.outfit).toMatch(/athletic/i);
  });

  it("nicheShotToPhotoSeed never leaves empty outfit/scene", () => {
    const seed = nicheShotToPhotoSeed(
      { id: "1", title: "Runs", sceneDescription: "park" },
      "inf1"
    );
    expect(seed.outfit!.length).toBeGreaterThan(10);
    expect(seed.sceneDescription!.length).toBeGreaterThan(40);
  });
});
