/**
 * Resolve trend preview URLs for Claude vision — social CDNs are blocked when
 * Anthropic fetches by URL (robots.txt). Safe URLs pass through; others are
 * downloaded server-side and sent as base64.
 */

import { downloadTrendCdnAsset } from "@/lib/trends/trend-cdn-download";

const VIDEO_URL_RE = /\.mp4(\?|$)/i;
const MAX_VISION_BYTES = 5 * 1024 * 1024;

export type VisionImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export type VisionImageBlock =
  | { kind: "url"; url: string }
  | { kind: "base64"; media_type: VisionImageMediaType; data: string };

/** Anthropic vision blocks TikTok/IG CDNs via robots.txt on URL fetch. */
export function isAnthropicVisionSafeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host.includes("tiktok") ||
      host.includes("tiktokcdn") ||
      host.includes("instagram") ||
      host.includes("fbcdn") ||
      host.includes("cdninstagram")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isTrendVisionImageUrl(url: string): boolean {
  return url.startsWith("http") && !VIDEO_URL_RE.test(url);
}

export function normalizeVisionMediaType(
  contentType: string | null | undefined,
  url?: string
): VisionImageMediaType {
  const raw = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (raw === "image/png") return "image/png";
  if (raw === "image/gif") return "image/gif";
  if (raw === "image/webp") return "image/webp";
  if (raw === "image/jpeg" || raw === "image/jpg") return "image/jpeg";

  const path = url?.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/** Download a social CDN image and encode for Anthropic base64 vision blocks. */
export async function fetchTrendImageAsBase64Block(
  url: string
): Promise<VisionImageBlock | null> {
  if (!isTrendVisionImageUrl(url)) return null;

  const downloaded = await downloadTrendCdnAsset(url, {
    maxBytes: MAX_VISION_BYTES,
  });
  if (!downloaded) return null;

  const media_type = normalizeVisionMediaType(
    downloaded.contentType,
    url
  ) as VisionImageMediaType;

  return {
    kind: "base64",
    media_type,
    data: downloaded.buffer.toString("base64"),
  };
}

/**
 * Build up to `limit` vision blocks: safe URLs as URL source; social CDNs as
 * server-downloaded base64 (Anthropic never hits TikTok/IG).
 */
export async function resolveVisionImageBlocks(
  urls: string[],
  limit = 6
): Promise<VisionImageBlock[]> {
  const blocks: VisionImageBlock[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    if (blocks.length >= limit) break;
    if (!isTrendVisionImageUrl(url) || seen.has(url)) continue;
    seen.add(url);

    if (isAnthropicVisionSafeUrl(url)) {
      blocks.push({ kind: "url", url });
      continue;
    }

    const base64 = await fetchTrendImageAsBase64Block(url);
    if (base64) blocks.push(base64);
  }

  return blocks;
}
