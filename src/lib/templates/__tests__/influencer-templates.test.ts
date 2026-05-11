import { describe, it, expect } from "vitest";
import {
  INFLUENCER_TEMPLATES,
  filterTemplates,
  getTemplate,
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
});
