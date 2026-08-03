import { describe, expect, it } from "vitest";
import {
  downloadTrendCdnAsset,
  inferSocialCdnReferer,
} from "@/lib/trends/trend-cdn-download";

describe("trend-cdn-download", () => {
  it("infers platform referers for social CDNs", () => {
    expect(
      inferSocialCdnReferer("https://p16-sign.tiktokcdn.com/cover.jpg")
    ).toBe("https://www.tiktok.com/");
    expect(
      inferSocialCdnReferer("https://scontent.cdninstagram.com/v/img.jpg")
    ).toBe("https://www.instagram.com/");
    expect(inferSocialCdnReferer("https://cdn.example.com/a.jpg")).toBeUndefined();
  });

  it("sends browser-like headers when downloading social CDN assets", async () => {
    const url = "https://p16-sign.tiktokcdn.com/cover.jpg";
    const seen: { headers?: Headers } = {};

    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      seen.headers = new Headers(init?.headers);
      return new Response(Buffer.from("jpeg"), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    };

    try {
      const result = await downloadTrendCdnAsset(url);
      expect(result?.buffer.toString()).toBe("jpeg");
      expect(seen.headers?.get("User-Agent")).toMatch(/Chrome/);
      expect(seen.headers?.get("Referer")).toBe("https://www.tiktok.com/");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
