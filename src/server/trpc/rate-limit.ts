import { TRPCError } from "@trpc/server";

/** Max AI generation mutations per user per window (in-memory; resets on cold start). */
const DEFAULT_LIMIT = 30;
const WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const AI_GENERATION_PATH_RE =
  /\.(generatePhoto|generateBaseImage|generatePhotoScenePlate|generateWizardAppearancePreview|generateReel|generateReelNarration|generateIdentityPack|generateCaption|generateCaptionVariants|generateHashtags|generateContentPlan|generateIdeas|processBatchSlice|approveBatch|analyzeFormat|personalizeOne|refreshForInfluencer|chatTurn)$/;

export function isAiGenerationPath(path: string): boolean {
  return AI_GENERATION_PATH_RE.test(path);
}

/**
 * Soft rate limit for costly tRPC mutations. Uses in-memory store (per serverless
 * instance). For multi-instance prod, wire REDIS_URL later.
 */
export async function assertAiGenerationRateLimit(
  userId: string,
  path: string
): Promise<void> {
  if (!isAiGenerationPath(path)) return;

  const now = Date.now();
  const key = userId;
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > DEFAULT_LIMIT) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Trop de générations en peu de temps. Attends une minute puis réessaie.",
    });
  }
}

/** Test helper */
export function resetAiRateLimitBuckets(): void {
  buckets.clear();
}
