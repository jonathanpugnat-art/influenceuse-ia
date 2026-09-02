import { describe, expect, it } from "vitest";
import { contentSectionCrumbLabel, isNavHrefActive } from "@/lib/nav-active";

describe("isNavHrefActive", () => {
  it("marks Create active on photo and reel studios", () => {
    expect(isNavHrefActive("/content/photo", "/content/photo")).toBe(true);
    expect(isNavHrefActive("/content/reel", "/content/photo")).toBe(true);
    expect(isNavHrefActive("/content", "/content/photo")).toBe(false);
  });

  it("marks the posts library only on /content", () => {
    expect(isNavHrefActive("/content", "/content")).toBe(true);
    expect(isNavHrefActive("/content/photo", "/content")).toBe(false);
  });

  it("matches nested influencer routes on the dashboard", () => {
    expect(isNavHrefActive("/influencers", "/influencers")).toBe(true);
    expect(isNavHrefActive("/influencers/abc", "/influencers")).toBe(true);
    expect(isNavHrefActive("/trends", "/influencers")).toBe(false);
  });
});

describe("contentSectionCrumbLabel", () => {
  const labels = { createContent: "Créer du Contenu", library: "Bibliothèque" };

  it("uses Create on photo and reel studios", () => {
    expect(contentSectionCrumbLabel("/content/photo", labels)).toBe(
      "Créer du Contenu"
    );
    expect(contentSectionCrumbLabel("/content/reel", labels)).toBe(
      "Créer du Contenu"
    );
  });

  it("uses Library on the posts list", () => {
    expect(contentSectionCrumbLabel("/content", labels)).toBe("Bibliothèque");
  });
});
