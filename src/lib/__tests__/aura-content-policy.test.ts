import { describe, it, expect } from "vitest";
import {
  assertAuraImagePromptAllowed,
  assertAuraTextAllowed,
  AuraContentPolicyError,
  looksLikeProviderRefusal,
} from "@/lib/content-safety/aura-content-policy";

describe("aura-content-policy", () => {
  it("always blocks illegal terms on adult lane", () => {
    expect(() =>
      assertAuraTextAllowed("sexy boudoir shoot with minor", { lane: "adult" })
    ).toThrow(AuraContentPolicyError);
  });

  it("blocks explicit vocabulary on sfw lane", () => {
    expect(() =>
      assertAuraTextAllowed("hardcore porn scene", { lane: "sfw" })
    ).toThrow(AuraContentPolicyError);
  });

  it("allows boudoir on adult text lane", () => {
    expect(() =>
      assertAuraTextAllowed("lingerie rouge, pose sensuelle, chambre boudoir", {
        lane: "adult",
      })
    ).not.toThrow();
  });

  it("blocks explicit image terms at suggestive tier", () => {
    expect(() =>
      assertAuraImagePromptAllowed({ customPrompt: "fully nude explicit sex" }, "suggestive")
    ).toThrow(AuraContentPolicyError);
  });

  it("allows explicit tier for adult image prompts", () => {
    expect(() =>
      assertAuraImagePromptAllowed({ customPrompt: "topless boudoir explicit" }, "explicit")
    ).not.toThrow();
  });

  it("detects provider refusal messages", () => {
    expect(looksLikeProviderRefusal("I can't help with that request.")).toBe(true);
    expect(looksLikeProviderRefusal("Here is your JSON output")).toBe(false);
  });
});
