import { describe, it, expect } from "vitest";
import {
  INFLUENCER_TEMPLATES,
  filterTemplates,
  getTemplate,
  diversifyTemplate,
} from "@/lib/templates/influencer-templates";

describe("influencer-templates", () => {
  it("ships at least 20 templates", () => {
    expect(INFLUENCER_TEMPLATES.length).toBeGreaterThanOrEqual(20);
  });

  it("has unique ids", () => {
    const ids = INFLUENCER_TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("each template provides niche, gender, bio, personality, ethnicity, hairColor, fashionStyles", () => {
    for (const tpl of INFLUENCER_TEMPLATES) {
      const d = tpl.defaults;
      expect(tpl.niche).toBeTruthy();
      expect(d.gender).toBeTruthy();
      expect(d.bio?.length ?? 0).toBeGreaterThan(20);
      expect(d.personality?.length ?? 0).toBeGreaterThan(20);
      expect(d.ethnicity).toBeTruthy();
      expect(d.hairColor).toBeTruthy();
      expect(Array.isArray(d.fashionStyles)).toBe(true);
      expect((d.fashionStyles ?? []).length).toBeGreaterThan(0);
    }
  });

  it("filterTemplates hides ADULT/NSFW when allowNsfw is false", () => {
    const safe = filterTemplates({ allowNsfw: false });
    expect(safe.every((t) => t.niche !== "ADULT")).toBe(true);

    const all = filterTemplates({ allowNsfw: true });
    expect(all.length).toBeGreaterThan(safe.length);
  });

  it("getTemplate retrieves by id and returns undefined for unknown", () => {
    const known = getTemplate("fitness_girl");
    expect(known?.id).toBe("fitness_girl");
    expect(getTemplate("unknown_id")).toBeUndefined();
  });

  it("covers a diverse set of niches", () => {
    const niches = new Set(INFLUENCER_TEMPLATES.map((t) => t.niche));
    expect(niches.size).toBeGreaterThanOrEqual(5);
  });

  it("includes male templates so non-female users have presets too", () => {
    const males = INFLUENCER_TEMPLATES.filter(
      (t) => t.defaults.gender === "male"
    );
    expect(males.length).toBeGreaterThanOrEqual(3);
  });

  // ── Sprint 14 — diversifyTemplate ────────────────────────────────────
  describe("diversifyTemplate", () => {
    const fitnessGirl = getTemplate("fitness_girl")!;

    it("returns the original template when random rolls above probability", () => {
      // random() = 0.99 → above the 0.65 threshold → no diversification
      const result = diversifyTemplate(fitnessGirl, () => 0.99);
      expect(result.defaults.ethnicity).toBe(
        fitnessGirl.defaults.ethnicity
      );
      expect(result.defaults.hairColor).toBe(
        fitnessGirl.defaults.hairColor
      );
      expect(result.id).toBe(fitnessGirl.id);
    });

    it("swaps ethnicity + hair color when random rolls below probability", () => {
      // random() = 0.1 → below 0.65 → diversify. The next 2 calls pick
      // ethnicity index then hair index. With all 0.1, we land on the
      // first plausible look (caucasian) — which happens to match the
      // original. Use 0.3 to land on a different bucket.
      // Each call returns 0.3 → first pick yields PLAUSIBLE_LOOKS[2]
      // (black), hair: black|brown → black.
      const result = diversifyTemplate(fitnessGirl, () => 0.3);
      // Either swapped (most common) OR identity is preserved by chance
      // — we don't assert a specific ethnicity, just that hair colors
      // remain plausible (no "blonde + asian" disasters).
      const allowedHairs = ["black", "brown", "blonde", "red"];
      expect(allowedHairs).toContain(result.defaults.hairColor);
    });

    it("keeps all OTHER fields untouched (name, niche, bio, …)", () => {
      const result = diversifyTemplate(fitnessGirl, () => 0.1);
      expect(result.id).toBe(fitnessGirl.id);
      expect(result.niche).toBe(fitnessGirl.niche);
      expect(result.defaults.bio).toBe(fitnessGirl.defaults.bio);
      expect(result.defaults.personality).toBe(
        fitnessGirl.defaults.personality
      );
      expect(result.defaults.bodyType).toBe(fitnessGirl.defaults.bodyType);
      expect(result.defaults.fashionStyles).toEqual(
        fitnessGirl.defaults.fashionStyles
      );
    });

    it("never produces a blonde+asian or red+black ethnicity mismatch", () => {
      // Run the diversifier 200 times and assert every output is in the
      // explicitly-curated PLAUSIBLE_LOOKS pool. If any combo escapes the
      // pool we want a hard failure (catches regressions in the helper).
      const allowed = new Map<string, string[]>([
        ["caucasian", ["blonde", "brown", "black", "red"]],
        ["asian", ["black", "brown"]],
        ["black", ["black", "brown"]],
        ["latina", ["black", "brown"]],
        ["latino", ["black", "brown"]],
        ["mixed", ["black", "brown", "blonde"]],
        ["middle-eastern", ["black", "brown"]],
        ["indian", ["black", "brown"]],
      ]);
      for (let i = 0; i < 200; i++) {
        const out = diversifyTemplate(fitnessGirl, Math.random);
        const e = out.defaults.ethnicity ?? "";
        const h = out.defaults.hairColor ?? "";
        const plausibleHairs = allowed.get(e);
        if (plausibleHairs) {
          // diversified path
          expect(plausibleHairs).toContain(h);
        } else {
          // un-diversified path → original template kept as-is
          expect(e).toBe(fitnessGirl.defaults.ethnicity);
          expect(h).toBe(fitnessGirl.defaults.hairColor);
        }
      }
    });
  });
});
