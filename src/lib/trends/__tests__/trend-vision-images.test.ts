import { describe, expect, it } from "vitest";
import {
  isAnthropicVisionSafeUrl,
  isTrendVisionImageUrl,
  normalizeVisionMediaType,
  resolveVisionImageBlocks,
} from "@/lib/trends/trend-vision-images";

describe("trend-vision-images", () => {
  it("flags TikTok and Instagram CDNs as unsafe for Anthropic URL fetch", () => {
    expect(isAnthropicVisionSafeUrl("https://p16-sign.tiktokcdn.com/cover.jpg")).toBe(
      false
    );
    expect(
      isAnthropicVisionSafeUrl("https://scontent.cdninstagram.com/v/img.jpg")
    ).toBe(false);
    expect(isAnthropicVisionSafeUrl("https://cdn.example.com/trend.jpg")).toBe(
      true
    );
  });

  it("rejects MP4 URLs for vision image pick", () => {
    expect(isTrendVisionImageUrl("https://cdn.example.com/video.mp4")).toBe(false);
    expect(isTrendVisionImageUrl("https://cdn.example.com/frame.jpg")).toBe(true);
  });

  it("normalizes media types from content-type and extension", () => {
    expect(normalizeVisionMediaType("image/png")).toBe("image/png");
    expect(normalizeVisionMediaType(null, "https://x.co/pic.webp")).toBe(
      "image/webp"
    );
    expect(normalizeVisionMediaType("application/octet-stream")).toBe(
      "image/jpeg"
    );
  });

  it("resolveVisionImageBlocks uses URL for safe hosts and base64 for social CDNs", async () => {
    const safe = "https://cdn.example.com/safe.jpg";
    const social = "https://p16-sign.tiktokcdn.com/cover.jpg";

    const originalFetch = global.fetch;
    global.fetch = async (input) => {
      const url = String(input);
      if (url === social) {
        return new Response(Buffer.from("fake-jpeg"), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    try {
      const blocks = await resolveVisionImageBlocks([social, safe], 2);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        kind: "base64",
        media_type: "image/jpeg",
        data: Buffer.from("fake-jpeg").toString("base64"),
      });
      expect(blocks[1]).toEqual({ kind: "url", url: safe });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("resolveVisionImageBlocks skips failed social downloads", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response(null, { status: 403 });

    try {
      const blocks = await resolveVisionImageBlocks([
        "https://p16-sign.tiktokcdn.com/nope.jpg",
      ]);
      expect(blocks).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
