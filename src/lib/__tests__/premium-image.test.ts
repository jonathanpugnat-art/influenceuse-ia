import { describe, it, expect } from "vitest";
import {
  resolvePremiumImageProviderMode,
  isTogetherConfigured,
  isSightengineConfigured,
  shouldUsePremiumModeration,
  resolvePremiumModerationRawThreshold,
  resolveReplicatePremiumModel,
  isReplicatePremiumConfigured,
  shouldPostModeratePremiumGeneration,
} from "@/lib/premium-image-config";
import {
  findBlockedPremiumTerms,
  assertPremiumPromptAllowed,
  PremiumPromptBlockedError,
} from "@/lib/prompts/premium-prompt-guard";
import { buildPremiumNegativePromptForTier } from "@/lib/prompts/premium-negative";
import { softenPremiumPrompt } from "@/lib/prompts/premium-soften";

describe("premium-image-config", () => {
  it("defaults provider to auto", () => {
    expect(resolvePremiumImageProviderMode({})).toBe("auto");
  });

  it("resolves replicate uncensored model", () => {
    expect(resolveReplicatePremiumModel({})).toBe(
      "aisha-ai-official/flux.1dev-uncensored-msfluxnsfw-v3"
    );
    expect(
      resolveReplicatePremiumModel({ PREMIUM_REPLICATE_MODEL: "custom/model" })
    ).toBe("custom/model");
  });

  it("detects Replicate token for premium", () => {
    expect(isReplicatePremiumConfigured({})).toBe(false);
    expect(isReplicatePremiumConfigured({ REPLICATE_API_TOKEN: "r8_x" })).toBe(true);
  });

  it("skips post-moderation for soft and explicit tiers in auto mode", () => {
    expect(
      shouldPostModeratePremiumGeneration("soft", {
        SIGHTENGINE_API_USER: "u",
        SIGHTENGINE_API_SECRET: "s",
      })
    ).toBe(false);
    expect(
      shouldPostModeratePremiumGeneration("explicit", {
        SIGHTENGINE_API_USER: "u",
        SIGHTENGINE_API_SECRET: "s",
      })
    ).toBe(false);
    expect(
      shouldPostModeratePremiumGeneration("suggestive", {
        SIGHTENGINE_API_USER: "u",
        SIGHTENGINE_API_SECRET: "s",
      })
    ).toBe(true);
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
    expect(findBlockedPremiumTerms("hardcore porn scene")).toEqual(["blocked"]);
    expect(() =>
      assertPremiumPromptAllowed({ customPrompt: "fully nude explicit sex" })
    ).toThrow(PremiumPromptBlockedError);
  });
});

describe("premium-negative", () => {
  it("includes anti-explicit negatives for suggestive/soft", () => {
    const neg = buildPremiumNegativePromptForTier("soft", "female");
    expect(neg).toContain("nipples");
    expect(neg).toContain("pornography");
  });

  it("drops anti-nude negatives on explicit tier", () => {
    const neg = buildPremiumNegativePromptForTier("explicit", "female");
    expect(neg).not.toContain("pornography");
    expect(neg).toContain("plastic skin");
  });
});

describe("premium-soften", () => {
  it("prefixes tasteful boudoir wording", () => {
    const out = softenPremiumPrompt("woman in bedroom, seductive");
    expect(out.toLowerCase()).toContain("lingerie fully worn");
  });
});
