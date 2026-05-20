import { getPresignedUrl } from "@/server/services/storage.service";
import { isReplicateAccessibleImageUrl } from "@/lib/generation-errors";

/**
 * Turn a stored portrait/media URL into something Replicate can fetch on Vercel.
 * Handles bare R2 keys, missing R2_PUBLIC_URL (fresh presign), and rejects localhost.
 */
export async function resolvePublicMediaUrl(
  stored: string | undefined | null
): Promise<string | undefined> {
  if (!stored?.trim()) return undefined;
  const u = stored.trim();

  if (/localhost|127\.0\.0\.1/i.test(u)) return undefined;

  const r2Public = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    const key = u.replace(/^\//, "");
    if (r2Public) return `${r2Public}/${key}`;
    try {
      return await getPresignedUrl(key, 3600);
    } catch {
      return undefined;
    }
  }

  if (!isReplicateAccessibleImageUrl(u)) return undefined;

  // Already a public https URL (R2 custom domain, Replicate output, etc.)
  return u;
}
