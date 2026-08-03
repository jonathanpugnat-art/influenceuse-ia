import { isAnthropicVisionSafeUrl } from "@/lib/trends/trend-vision-images";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Referer expected by TikTok / Instagram CDNs when hotlinking covers or MP4. */
export function inferSocialCdnReferer(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("tiktok")) return "https://www.tiktok.com/";
    if (
      host.includes("instagram") ||
      host.includes("fbcdn") ||
      host.includes("cdninstagram")
    ) {
      return "https://www.instagram.com/";
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function isSocialPlatformCdnUrl(url: string): boolean {
  return !isAnthropicVisionSafeUrl(url);
}

export type TrendCdnDownloadResult = {
  buffer: Buffer;
  contentType: string;
};

/**
 * Download a TikTok/IG CDN asset server-side with browser-like headers.
 * Returns null on 403/timeout — callers fall back to text-only analysis.
 */
export async function downloadTrendCdnAsset(
  url: string,
  opts?: { timeoutMs?: number; maxBytes?: number }
): Promise<TrendCdnDownloadResult | null> {
  const trimmed = url.trim();
  if (!trimmed.startsWith("http")) return null;

  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const maxBytes = opts?.maxBytes ?? 8 * 1024 * 1024;

  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const referer = inferSocialCdnReferer(trimmed);
  if (referer) headers.Referer = referer;

  try {
    const res = await fetch(trimmed, {
      signal: AbortSignal.timeout(timeoutMs),
      headers,
      redirect: "follow",
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > maxBytes) return null;

    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";

    return { buffer, contentType };
  } catch {
    return null;
  }
}
