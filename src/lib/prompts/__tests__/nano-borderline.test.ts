import { describe, it, expect } from "vitest";
import {
  shouldRouteToKontext,
  getMatchedBorderlineKeywords,
} from "@/lib/prompts/nano-borderline";

describe("nano-borderline", () => {
  it("routes beach + bikini to kontext", () => {
    expect(
      shouldRouteToKontext({
        scene: "beach",
        outfit: "bikini top and shorts",
      })
    ).toBe(true);
    expect(getMatchedBorderlineKeywords({ scene: "beach", outfit: "bikini" })).toContain(
      "beach"
    );
  });

  it("routes gym mirror without blocking safe studio", () => {
    expect(shouldRouteToKontext({ scene: "gym", customPrompt: "gym mirror selfie" })).toBe(
      true
    );
    expect(shouldRouteToKontext({ scene: "studio", outfit: "blazer and jeans" })).toBe(
      false
    );
  });

  it("matches leggings in outfit", () => {
    expect(shouldRouteToKontext({ outfit: "black leggings and hoodie" })).toBe(true);
  });
});
