import { describe, expect, it } from "vitest";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  clampWavespeedSpicyDuration,
  clampWavespeedSpicyResolution,
  estimateWavespeedSpicyCredits,
  evaluateWavespeedSpicyGate,
  getNsfwEngine,
  getWavespeedSpicyPricingSnapshot,
  isWavespeedApiConfigured,
  isWavespeedSpicyReachable,
  NSFW_CONSENT_REQUIRED_MESSAGE,
  NSFW_ENGINE_UNREACHABLE_MESSAGE,
  trpcCodeForWavespeedGate,
  validateWavespeedSpicyRequest,
  WAVESPEED_MISSING_KEY_MESSAGE,
  WAVESPEED_SPICY_DEFAULT_MODEL,
  WAVESPEED_SPICY_PROVIDER_USD,
} from "@/lib/wavespeed-spicy-config";

describe("NSFW_ENGINE flag", () => {
  it("defaults off when unset", () => {
    expect(getNsfwEngine({})).toBe("off");
    expect(isWavespeedSpicyReachable({})).toBe(false);
  });

  it("stays off for unknown values", () => {
    expect(getNsfwEngine({ NSFW_ENGINE: "fal_kling" })).toBe("off");
    expect(getNsfwEngine({ NSFW_ENGINE: "seedance" })).toBe("off");
  });

  it("is reachable only for wavespeed_spicy", () => {
    expect(
      isWavespeedSpicyReachable({ NSFW_ENGINE: "wavespeed_spicy" })
    ).toBe(true);
  });
});

describe("WaveSpeed key fail-closed", () => {
  it("is not configured without WAVESPEED_API_KEY", () => {
    expect(isWavespeedApiConfigured({ NSFW_ENGINE: "wavespeed_spicy" })).toBe(
      false
    );
  });

  it("is configured when the key is set", () => {
    expect(
      isWavespeedApiConfigured({ WAVESPEED_API_KEY: "ws_test" })
    ).toBe(true);
  });
});

describe("evaluateWavespeedSpicyGate", () => {
  const ready = {
    env: {
      NSFW_ENGINE: "wavespeed_spicy",
      WAVESPEED_API_KEY: "ws_test",
    },
    planHasNsfw: true,
    influencerIsNsfw: true,
    consentAccepted: true,
    influencerAge: 24,
  };

  it("flag off = unreachable", () => {
    const gate = evaluateWavespeedSpicyGate({
      ...ready,
      env: {},
    });
    expect(gate).toEqual({
      ok: false,
      code: "UNREACHABLE",
      message: NSFW_ENGINE_UNREACHABLE_MESSAGE,
    });
    expect(trpcCodeForWavespeedGate("UNREACHABLE")).toBe("NOT_FOUND");
  });

  it("flag on without key = fail-closed FR", () => {
    const gate = evaluateWavespeedSpicyGate({
      ...ready,
      env: { NSFW_ENGINE: "wavespeed_spicy" },
    });
    expect(gate).toEqual({
      ok: false,
      code: "MISSING_KEY",
      message: WAVESPEED_MISSING_KEY_MESSAGE,
    });
    expect(trpcCodeForWavespeedGate("MISSING_KEY")).toBe(
      "PRECONDITION_FAILED"
    );
  });

  it("requires consent", () => {
    const gate = evaluateWavespeedSpicyGate({
      ...ready,
      consentAccepted: false,
    });
    expect(gate).toEqual({
      ok: false,
      code: "CONSENT",
      message: NSFW_CONSENT_REQUIRED_MESSAGE,
    });
  });

  it("requires the existing NSFW character flag", () => {
    const gate = evaluateWavespeedSpicyGate({
      ...ready,
      influencerIsNsfw: false,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("NOT_NSFW");
  });

  it("refuses Creator / Free (no NSFW plan)", () => {
    const gate = evaluateWavespeedSpicyGate({
      ...ready,
      planHasNsfw: false,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("PLAN");
  });

  it("passes when flag, key, Pro, NSFW character and consent are set", () => {
    expect(evaluateWavespeedSpicyGate(ready)).toEqual({ ok: true });
  });
});

describe("WaveSpeed spicy credits vs list $", () => {
  it("holds 12/18/24/36 with ≥3× margin at $0.04/credit", () => {
    expect(CREDIT_COSTS.WAVESPEED_SPICY_480P_5S).toBe(12);
    expect(CREDIT_COSTS.WAVESPEED_SPICY_480P_8S).toBe(18);
    expect(CREDIT_COSTS.WAVESPEED_SPICY_720P_5S).toBe(24);
    expect(CREDIT_COSTS.WAVESPEED_SPICY_720P_8S).toBe(36);

    expect(estimateWavespeedSpicyCredits("480p", 5)).toBe(12);
    expect(estimateWavespeedSpicyCredits("480p", 8)).toBe(18);
    expect(estimateWavespeedSpicyCredits("720p", 5)).toBe(24);
    expect(estimateWavespeedSpicyCredits("720p", 8)).toBe(36);

    for (const resolution of ["480p", "720p"] as const) {
      for (const duration of [5, 8] as const) {
        const credits = estimateWavespeedSpicyCredits(resolution, duration);
        const usd = WAVESPEED_SPICY_PROVIDER_USD[resolution][duration];
        expect((credits * 0.04) / usd).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("documents the official model id", () => {
    expect(getWavespeedSpicyPricingSnapshot().modelId).toBe(
      WAVESPEED_SPICY_DEFAULT_MODEL
    );
    expect(WAVESPEED_SPICY_DEFAULT_MODEL).toBe(
      "wavespeed-ai/wan-2.2-spicy/image-to-video"
    );
  });
});

describe("clamp + validate", () => {
  it("clamps duration to 5 or 8", () => {
    expect(clampWavespeedSpicyDuration(5)).toBe(5);
    expect(clampWavespeedSpicyDuration(8)).toBe(8);
    expect(clampWavespeedSpicyDuration(6)).toBe(5);
    expect(clampWavespeedSpicyDuration(30)).toBe(8);
    expect(clampWavespeedSpicyDuration(0)).toBe(5);
  });

  it("clamps resolution to 480p/720p", () => {
    expect(clampWavespeedSpicyResolution("480p")).toBe("480p");
    expect(clampWavespeedSpicyResolution("1080p")).toBe("720p");
  });

  it("requires prompt + public image", () => {
    expect(
      validateWavespeedSpicyRequest({
        prompt: "",
        imageUrl: "https://cdn.example/x.jpg",
        duration: 5,
        resolution: "720p",
      })?.code
    ).toBe("no_prompt");
    expect(
      validateWavespeedSpicyRequest({
        prompt: "walk",
        imageUrl: "local/file.jpg",
        duration: 5,
        resolution: "720p",
      })?.code
    ).toBe("no_image");
  });
});
