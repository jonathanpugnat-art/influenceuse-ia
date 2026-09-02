import { describe, expect, it } from "vitest";
import { isIntlBypassPath, isPublicPath } from "@/lib/public-paths";

describe("isPublicPath", () => {
  it("allows auth and pricing without a locale prefix", () => {
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-up")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/home")).toBe(true);
  });

  it("allows the same routes with a locale prefix", () => {
    expect(isPublicPath("/fr/sign-in")).toBe(true);
    expect(isPublicPath("/en/pricing")).toBe(true);
    expect(isPublicPath("/fr/home")).toBe(true);
    expect(isPublicPath("/fr/privacy")).toBe(true);
  });

  it("does not treat the dashboard as public", () => {
    expect(isPublicPath("/fr/billing")).toBe(false);
    expect(isPublicPath("/fr/influencers")).toBe(false);
    expect(isPublicPath("/billing")).toBe(false);
  });
});

describe("isIntlBypassPath", () => {
  it("skips locale rewriting for robots and sitemap", () => {
    expect(isIntlBypassPath("/robots.txt")).toBe(true);
    expect(isIntlBypassPath("/sitemap.xml")).toBe(true);
    expect(isIntlBypassPath("/api/health")).toBe(true);
    expect(isIntlBypassPath("/fr/home")).toBe(false);
  });
});
