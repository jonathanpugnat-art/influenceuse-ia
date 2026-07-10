import { describe, expect, it, vi, beforeEach } from "vitest";
import { mirrorTrendThumbnails } from "@/server/services/trend-thumbnail-storage.service";

vi.mock("@/lib/trends/trend-cdn-download", () => ({
  downloadTrendCdnAsset: vi.fn(),
}));

vi.mock("@/server/services/storage.service", () => ({
  uploadFile: vi.fn(),
}));

import { downloadTrendCdnAsset } from "@/lib/trends/trend-cdn-download";
import { uploadFile } from "@/server/services/storage.service";

describe("trend-thumbnail-storage", () => {
  beforeEach(() => {
    vi.mocked(downloadTrendCdnAsset).mockReset();
    vi.mocked(uploadFile).mockReset();
  });

  it("mirrors cover from mediaUrls when thumbnailUrl is missing", async () => {
    const social = "https://p16-sign.tiktokcdn.com/cover.jpg";
    vi.mocked(downloadTrendCdnAsset).mockResolvedValue({
      buffer: Buffer.from("img"),
      contentType: "image/jpeg",
    });
    vi.mocked(uploadFile).mockResolvedValue(
      "https://r2.example.com/trend-thumb.jpg"
    );

    const result = await mirrorTrendThumbnails({
      id: "trend-1",
      thumbnailUrl: null,
      thumbnailUrlAlt: null,
      mediaUrls: [social],
    });

    expect(downloadTrendCdnAsset).toHaveBeenCalledWith(social);
    expect(uploadFile).toHaveBeenCalled();
    expect(result.thumbnailUrl).toBe("https://r2.example.com/trend-thumb.jpg");
    expect(result.changed).toBe(true);
  });

  it("keeps already-safe thumbnail URLs without upload", async () => {
    const safe = "https://r2.example.com/existing.jpg";
    const result = await mirrorTrendThumbnails({
      id: "trend-2",
      thumbnailUrl: safe,
      thumbnailUrlAlt: null,
      mediaUrls: [],
    });

    expect(downloadTrendCdnAsset).not.toHaveBeenCalled();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(result.thumbnailUrl).toBe(safe);
    expect(result.changed).toBe(false);
  });
});
