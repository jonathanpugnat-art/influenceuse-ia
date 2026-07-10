import { nanoid } from "nanoid";
import { pickVideoUrlFromTrend } from "@/lib/trends/trend-video-items";
import { downloadTrendCdnAsset } from "@/lib/trends/trend-cdn-download";
import { uploadFile } from "@/server/services/storage.service";

/** Mirror external trend MP4 to durable storage (Apify CDN links expire). */
export async function persistTrendSourceVideo(
  sourceUrl: string,
  trendItemId: string
): Promise<string | null> {
  const url = sourceUrl.trim();
  if (!url.startsWith("http") || !/\.mp4(\?|$)/i.test(url)) {
    return null;
  }

  try {
    const downloaded = await downloadTrendCdnAsset(url, {
      maxBytes: 50 * 1024 * 1024,
      timeoutMs: 90_000,
    });
    if (!downloaded) return null;

    return await uploadFile(
      downloaded.buffer,
      `trend-video-${trendItemId}-${nanoid(6)}.mp4`,
      downloaded.contentType.startsWith("video/")
        ? downloaded.contentType
        : "video/mp4"
    );
  } catch (error) {
    console.warn(
      `[trend-video-storage] Failed to persist ${trendItemId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export function resolveTrendSourceVideoUrl(input: {
  sourceVideoUrl?: string | null;
  mediaUrls?: string[] | null;
}): string | null {
  if (input.sourceVideoUrl?.startsWith("http")) return input.sourceVideoUrl;
  return pickVideoUrlFromTrend({ mediaUrls: input.mediaUrls });
}
