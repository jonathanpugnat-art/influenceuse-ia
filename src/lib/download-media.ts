/**
 * Client-side media download. Uses same-origin API proxy when possible
 * (avoids CORS blocks on R2) and falls back to opening the URL.
 */

function extensionFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (match?.[1]) return match[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return fallback;
}

export function mediaDownloadApiUrl(mediaUrl: string): string {
  return `/api/media/download?url=${encodeURIComponent(mediaUrl)}`;
}

/**
 * Download a remote media file with a sensible filename.
 */
export async function downloadMediaUrl(
  mediaUrl: string,
  options?: { filename?: string; kind?: "image" | "video" }
): Promise<void> {
  const kind = options?.kind ?? "image";
  const ext = extensionFromUrl(mediaUrl, kind === "video" ? "mp4" : "jpg");
  const filename =
    options?.filename ??
    `aura-${kind}-${Date.now()}.${ext}`;

  try {
    const res = await fetch(mediaDownloadApiUrl(mediaUrl), {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`Download failed (${res.status})`);
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open direct URL (user can long-press save on mobile)
    window.open(mediaUrl, "_blank", "noopener,noreferrer");
  }
}
