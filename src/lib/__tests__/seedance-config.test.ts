import { describe, expect, it } from "vitest";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  buildSeedancePrompt,
  clampSeedanceDuration,
  clampSeedanceResolution,
  estimateSeedanceCredits,
  getSeedancePricingSnapshot,
  planSeedanceSubmit,
  resolveSeedanceMode,
  resolveSeedanceModelId,
  SEEDANCE_V1_SINGLE_FRONTAL_I2V,
  SEEDANCE_ALLOWED_DURATIONS,
  SEEDANCE_ALLOWED_RESOLUTIONS,
  validateSeedanceRequest,
} from "@/lib/seedance-config";

describe("seedance-config credits", () => {
  it("prices exactly match the PRD (18/36 cr/s)", () => {
    expect(CREDIT_COSTS.SEEDANCE_480P_PER_SEC).toBe(18);
    expect(CREDIT_COSTS.SEEDANCE_720P_PER_SEC).toBe(36);

    expect(estimateSeedanceCredits("480p", 10)).toBe(180);
    expect(estimateSeedanceCredits("480p", 15)).toBe(270);
    expect(estimateSeedanceCredits("480p", 30)).toBe(540);

    expect(estimateSeedanceCredits("720p", 10)).toBe(360);
    expect(estimateSeedanceCredits("720p", 15)).toBe(540);
    expect(estimateSeedanceCredits("720p", 30)).toBe(1080);
  });

  it("keeps a ≥3× margin against fal list prices at $0.04/credit", () => {
    // fal list prices as of 2026-08 (see task spec).
    const providerCostPerSec = { "480p": 0.221, "720p": 0.473 } as const;
    for (const resolution of SEEDANCE_ALLOWED_RESOLUTIONS) {
      const perSec = resolution === "480p" ? 18 : 36;
      const revenue = perSec * 0.04;
      const cost = providerCostPerSec[resolution];
      expect(revenue / cost).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("seedance-config duration clamp", () => {
  it("passes allowed durations through unchanged", () => {
    for (const d of SEEDANCE_ALLOWED_DURATIONS) {
      expect(clampSeedanceDuration(d)).toBe(d);
    }
  });

  it("snaps between allowed values to the largest that fits", () => {
    expect(clampSeedanceDuration(12)).toBe(10);
    expect(clampSeedanceDuration(20)).toBe(15);
    expect(clampSeedanceDuration(29)).toBe(15);
    expect(clampSeedanceDuration(60)).toBe(30);
  });

  it("falls back to the shortest duration for garbage input", () => {
    expect(clampSeedanceDuration(0)).toBe(10);
    expect(clampSeedanceDuration(-5)).toBe(10);
    expect(clampSeedanceDuration(Number.NaN)).toBe(10);
  });
});

describe("seedance-config resolution clamp", () => {
  it("accepts 480p and 720p case-insensitive", () => {
    expect(clampSeedanceResolution("480p")).toBe("480p");
    expect(clampSeedanceResolution("720p")).toBe("720p");
    expect(clampSeedanceResolution("720P")).toBe("720p");
  });

  it("defaults to 720p for unknown or missing values", () => {
    expect(clampSeedanceResolution(null)).toBe("720p");
    expect(clampSeedanceResolution("1080p")).toBe("720p");
    expect(clampSeedanceResolution("")).toBe("720p");
  });
});

describe("seedance-config model resolution", () => {
  it("returns fal Seedance 2.5 reference-to-video by default", () => {
    expect(resolveSeedanceModelId("reference_to_video", {})).toBe(
      "bytedance/seedance-2.5/reference-to-video"
    );
  });

  it("returns image-to-video for i2v mode", () => {
    expect(resolveSeedanceModelId("image_to_video", {})).toBe(
      "bytedance/seedance-2.5/image-to-video"
    );
  });

  it("respects env override for staging / A/B", () => {
    expect(
      resolveSeedanceModelId("reference_to_video", {
        FAL_SEEDANCE_REFERENCE_MODEL: "custom/model",
      })
    ).toBe("custom/model");
    expect(
      resolveSeedanceModelId("image_to_video", {
        FAL_SEEDANCE_I2V_MODEL: "custom/i2v",
      })
    ).toBe("custom/i2v");
  });
});

describe("seedance-config mode resolution", () => {
  it("picks image_to_video for exactly one usable ref", () => {
    expect(resolveSeedanceMode(["https://a"])).toBe("image_to_video");
    expect(resolveSeedanceMode([])).toBe("image_to_video");
  });

  it("picks reference_to_video only when 2+ refs are present", () => {
    expect(resolveSeedanceMode(["https://a", "https://b"])).toBe(
      "reference_to_video"
    );
  });
});

describe("planSeedanceSubmit V1 canary", () => {
  it("documents V1 as single-frontal image-to-video", () => {
    expect(SEEDANCE_V1_SINGLE_FRONTAL_I2V).toBe(true);
  });

  it("always plans i2v with at most the frontal still (even with a 4-shot pack)", () => {
    const plan = planSeedanceSubmit([
      "https://cdn/frontal.jpg",
      "https://cdn/profile.jpg",
      "https://cdn/34.jpg",
      "https://cdn/full.jpg",
    ]);
    expect(plan.mode).toBe("image_to_video");
    expect(plan.imageUrls).toEqual(["https://cdn/frontal.jpg"]);
  });

  it("plans i2v + image_url source for a single ref", () => {
    expect(planSeedanceSubmit(["https://cdn/only.jpg"])).toEqual({
      mode: "image_to_video",
      imageUrls: ["https://cdn/only.jpg"],
    });
  });
});

describe("seedance-config prompt builder", () => {
  it("uses @Image1 as the identity anchor and mentions 9:16", () => {
    const prompt = buildSeedancePrompt({
      characterName: "Ava",
      scene: "walking through a sunlit cafe",
    });
    expect(prompt).toMatch(/@Image1/);
    expect(prompt).toMatch(/Ava/);
    expect(prompt).toMatch(/9:16/);
  });

  it("still works with no scene (defaults to a generic hold)", () => {
    const prompt = buildSeedancePrompt({});
    expect(prompt).toMatch(/@Image1/);
    expect(prompt.length).toBeGreaterThan(20);
  });

  it("appends extra tail unchanged", () => {
    const prompt = buildSeedancePrompt({
      scene: "sitting on a rooftop",
      extra: "holding a coffee, whispers 'good morning'",
    });
    expect(prompt).toContain("holding a coffee");
  });
});

describe("seedance-config validation", () => {
  const validRefs = ["https://cdn/frontal.jpg"] as const;

  it("rejects empty scene prompt", () => {
    const issue = validateSeedanceRequest({
      scenePrompt: "   ",
      referenceImageUrls: validRefs,
      duration: 10,
      resolution: "720p",
    });
    expect(issue?.code).toBe("no_scene_prompt");
  });

  it("rejects missing identity references", () => {
    const issue = validateSeedanceRequest({
      scenePrompt: "cafe scene",
      referenceImageUrls: [],
      duration: 10,
      resolution: "720p",
    });
    expect(issue?.code).toBe("no_identity_reference");
  });

  it("rejects unsupported durations", () => {
    const issue = validateSeedanceRequest({
      scenePrompt: "cafe",
      referenceImageUrls: validRefs,
      duration: 20,
      resolution: "720p",
    });
    expect(issue?.code).toBe("invalid_duration");
  });

  it("rejects 1080p (out of V1)", () => {
    const issue = validateSeedanceRequest({
      scenePrompt: "cafe",
      referenceImageUrls: validRefs,
      duration: 15,
      resolution: "1080p",
    });
    expect(issue?.code).toBe("invalid_resolution");
  });

  it("accepts a well-formed 15s 720p request", () => {
    expect(
      validateSeedanceRequest({
        scenePrompt: "cafe morning shot",
        referenceImageUrls: validRefs,
        duration: 15,
        resolution: "720p",
      })
    ).toBeNull();
  });
});

describe("seedance-config pricing snapshot", () => {
  it("returns the 6-cell duration×resolution matrix and defaults 15s/720p", () => {
    const snap = getSeedancePricingSnapshot();
    expect(snap.matrix).toHaveLength(6);
    expect(snap.defaultDurationSec).toBe(15);
    expect(snap.defaultResolution).toBe("720p");
    const hd15 = snap.matrix.find(
      (m) => m.resolution === "720p" && m.durationSec === 15
    );
    expect(hd15?.credits).toBe(540);
    const sd30 = snap.matrix.find(
      (m) => m.resolution === "480p" && m.durationSec === 30
    );
    expect(sd30?.credits).toBe(540);
  });
});
