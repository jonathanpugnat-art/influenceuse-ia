import { describe, it, expect } from "vitest";
import {
  resolvePremiumImageProviderMode,
  isTogetherConfigured,
  isSightengineConfigured,
  shouldUsePremiumModeration,
  resolvePremiumModerationRawThreshold,
} from "@/lib/premium-image-config";
import {
  findBlockedPremiumTerms,
  assertPremiumPromptAllowed,
  PremiumPromptBlockedError,
} from "@/lib/prompts/premium-prompt-guard";
import { buildPremiumNegativePrompt } from "@/lib/prompts/premium-negative";
import { softenPremiumPrompt } from "@/lib/prompts/premium-soften";

describe("premium-image-config", () => {
  it("defaults provider to auto", () => {
    expect(resolvePremiumImageProviderMode({})).toBe("auto");
  });

  it("detects Together API key", () => {
    expect(isTogetherConfigured({})).toBe(false);
    expect(isTogetherConfigured({ TOGETHER_API_KEY: "tk-abc" })).toBe(true);
  });

  it("uses Sightengine when configured in auto mode", () => {
    expect(
      shouldUsePremiumModeration({
        SIGHTENGINE_API_USER: "u",
        SIGHTENGINE_API_SECRET: "s",
      })
    ).toBe(true);
    expect(shouldUsePremiumModeration({})).toBe(false);
  });

  it("parses moderation threshold", () => {
    expect(resolvePremiumModerationRawThreshold({})).toBe(0.55);
    expect(
      resolvePremiumModerationRawThreshold({ PREMIUM_MODERATION_RAW_THRESHOLD: "0.4" })
    ).toBe(0.4);
  });
});

describe("premium-prompt-guard", () => {
  it("allows suggestive boudoir vocabulary", () => {
    expect(
      findBlockedPremiumTerms("lingerie rouge, pose sensuelle, chambre boudoir")
    ).toEqual([]);
  });

  it("blocks explicit porn terms", () => {
    expect(findBlockedPremiumTerms("hardcore porn scene")).toContain("porn");
    expect(() =>
      assertPremiumPromptAllowed({ customPrompt: "fully nude explicit sex" })
    ).toThrow(PremiumPromptBlockedError);
  });
});

describe("premium-negative", () => {
  it("includes anti-explicit negatives", () => {
    const neg = buildPremiumNegativePrompt("female");
    expect(neg).toContain("nipples");
    expect(neg).toContain("pornography");
  });
});

describe("premium-soften", () => {
  it("prefixes tasteful boudoir wording", () => {
    const out = softenPremiumPrompt("woman in bedroom, seductive");
    expect(out.toLowerCase()).toContain("lingerie fully worn");
  });
});
