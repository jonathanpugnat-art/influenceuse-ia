import { describe, expect, it } from "vitest";
import {
  REMIX_MAX_DURATION_SEC,
  REMIX_MAX_SOURCE_BYTES,
  REMIX_TIERS,
  buildRemixElements,
  buildRemixPrompt,
  clampRemixDuration,
  estimateRemixCreditsForTier,
  resolveRemixModelId,
  resolveRemixOembedProvider,
  validateRemixSource,
} from "@/lib/remix-config";

describe("remix-config credits", () => {
  it("computes standard tier at 10 credits/s", () => {
    expect(estimateRemixCreditsForTier("standard", 5)).toBe(50);
    expect(estimateRemixCreditsForTier("standard", 10)).toBe(100);
    expect(estimateRemixCreditsForTier("standard", 15)).toBe(150);
  });

  it("computes pro tier at 14 credits/s", () => {
    expect(estimateRemixCreditsForTier("pro", 5)).toBe(70);
    expect(estimateRemixCreditsForTier("pro", 10)).toBe(140);
    expect(estimateRemixCreditsForTier("pro", 15)).toBe(210);
  });

  it("keeps a ≥3× provider margin at $0.04/credit", () => {
    for (const tier of ["standard", "pro"] as const) {
      const cfg = REMIX_TIERS[tier];
      const providerCostFor10s = cfg.costPerSecUsd * 10;
      const revenueFor10s = cfg.creditsPerSec * 10 * 0.04;
      expect(revenueFor10s / providerCostFor10s).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("remix-config duration clamp", () => {
  it("keeps requested duration when source allows it", () => {
    expect(clampRemixDuration(10, 20)).toBe(10);
    expect(clampRemixDuration(15, 30)).toBe(15);
  });

  it("caps to REMIX_MAX_DURATION_SEC regardless of source", () => {
    expect(clampRemixDuration(20, 30)).toBe(REMIX_MAX_DURATION_SEC);
    expect(clampRemixDuration(30, 40)).toBe(REMIX_MAX_DURATION_SEC);
  });

  it("clamps down to the largest allowed value that fits the source", () => {
    expect(clampRemixDuration(15, 11)).toBe(10);
    expect(clampRemixDuration(10, 6)).toBe(5);
  });

  it("returns 5 when source is impossibly short (server rejects afterwards)", () => {
    expect(clampRemixDuration(5, 2)).toBe(5);
  });

  it("trusts caller when source duration is unknown", () => {
    expect(clampRemixDuration(15, null)).toBe(15);
  });
});

describe("remix-config elements + prompt", () => {
  it("puts frontal first and caps additional refs at 3", () => {
    const elements = buildRemixElements({
      frontalImageUrl: "https://cdn/a.jpg",
      referenceImageUrls: [
        "https://cdn/b.jpg",
        "https://cdn/c.jpg",
        "https://cdn/d.jpg",
        "https://cdn/e.jpg",
      ],
    });
    expect(elements).toHaveLength(1);
    expect(elements[0].frontal_image_url).toBe("https://cdn/a.jpg");
    expect(elements[0].reference_image_urls).toHaveLength(3);
    expect(elements[0].reference_image_urls).not.toContain("https://cdn/a.jpg");
  });

  it("drops duplicates and non-http refs", () => {
    const elements = buildRemixElements({
      frontalImageUrl: "https://cdn/a.jpg",
      referenceImageUrls: [
        "https://cdn/a.jpg", // duplicate of frontal
        "not-a-url",
        "https://cdn/b.jpg",
      ],
    });
    expect(elements[0].reference_image_urls).toEqual(["https://cdn/b.jpg"]);
  });

  it("throws without a frontal image", () => {
    expect(() =>
      buildRemixElements({ frontalImageUrl: "   ", referenceImageUrls: [] })
    ).toThrow(/frontal/i);
  });

  it("builds a Kling remix prompt that references @Video1 and @Element1", () => {
    const prompt = buildRemixPrompt({ characterName: "Ava" });
    expect(prompt).toMatch(/@Element1/);
    expect(prompt).toMatch(/@Video1/);
    expect(prompt).toMatch(/Ava/);
    expect(prompt).toMatch(/9:16/);
  });
});

describe("remix-config source validation", () => {
  it("rejects unsupported mime types", () => {
    const issue = validateRemixSource({
      mimeType: "video/webm",
      sizeBytes: 1000,
      durationSec: 5,
      url: "https://cdn/x",
    });
    expect(issue?.code).toBe("unsupported_mime");
  });

  it("rejects oversized clips", () => {
    const issue = validateRemixSource({
      mimeType: "video/mp4",
      sizeBytes: REMIX_MAX_SOURCE_BYTES + 1,
      durationSec: 10,
      url: "https://cdn/x",
    });
    expect(issue?.code).toBe("too_large");
  });

  it("rejects too-short clips", () => {
    const issue = validateRemixSource({
      mimeType: "video/mp4",
      sizeBytes: 1000,
      durationSec: 1,
      url: "https://cdn/x",
    });
    expect(issue?.code).toBe("too_short");
  });

  it("rejects too-long clips", () => {
    const issue = validateRemixSource({
      mimeType: "video/mp4",
      sizeBytes: 1000,
      durationSec: 45,
      url: "https://cdn/x",
    });
    expect(issue?.code).toBe("too_long");
  });

  it("accepts a valid 8s MP4", () => {
    const issue = validateRemixSource({
      mimeType: "video/mp4",
      sizeBytes: 5_000_000,
      durationSec: 8,
      url: "https://cdn/x",
    });
    expect(issue).toBeNull();
  });

  it("rejects invalid URL", () => {
    const issue = validateRemixSource({
      mimeType: "video/mp4",
      sizeBytes: 1000,
      durationSec: 5,
      url: "not-a-url",
    });
    expect(issue?.code).toBe("invalid_url");
  });
});

describe("remix-config env + oembed", () => {
  it("resolves default model ids for standard and pro tiers", () => {
    expect(resolveRemixModelId("standard", {})).toContain(
      "kling-video/o3/standard/video-to-video/reference"
    );
    expect(resolveRemixModelId("pro", {})).toContain(
      "kling-video/o3/pro/video-to-video/reference"
    );
  });

  it("respects env override for standard tier", () => {
    expect(
      resolveRemixModelId("standard", {
        FAL_KLING_O3_REMIX_STANDARD_MODEL: "fal-ai/custom-model",
      })
    ).toBe("fal-ai/custom-model");
  });

  it("resolves TikTok oembed provider", () => {
    const provider = resolveRemixOembedProvider(
      "https://www.tiktok.com/@user/video/123"
    );
    expect(provider?.provider).toBe("tiktok");
  });

  it("returns null for unsupported provider", () => {
    expect(resolveRemixOembedProvider("https://example.com/video")).toBeNull();
  });

  it("recognizes Instagram reel URLs but marks them as auth-required (no endpoint)", () => {
    const provider = resolveRemixOembedProvider(
      "https://www.instagram.com/reel/ABC123/"
    );
    expect(provider?.provider).toBe("instagram");
    expect(provider?.endpoint("x")).toBe("");
  });
});
