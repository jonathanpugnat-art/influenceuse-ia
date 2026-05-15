/**
 * Shared resilience helpers for any service that hits the Replicate API.
 *
 * Centralizes:
 *   - Transient-error detection (429, 5xx, throttle, socket errors)
 *   - Exponential backoff retry (2s → 32s, 5 attempts ≈ 60s worst-case wait)
 *   - Bounded-concurrency task runner (caps simultaneous predictions per call
 *     so a single 4-image generation doesn't burst-fire 4 parallel requests
 *     to Replicate)
 *
 * Both ai-image.service and ai-video.service depend on this — the heuristics
 * have to stay identical across the two paths or the bench results from
 * `scripts/test-engines-ab.ts` stop being representative.
 */

/**
 * Detect a transient Replicate failure that's safe to retry blindly. Covers:
 *   - 429 (rate limit) — most common during bursts
 *   - 5xx (Replicate internal / gateway timeouts)
 *   - "throttled", "rate limit exceeded", "service unavailable" textual
 *     payloads (the SDK doesn't always surface a clean status code)
 *   - Common DNS / socket transient errors (ETIMEDOUT, ECONNRESET, …)
 *
 * Intentionally narrow: 4xx other than 429 are NOT retried (bad prompt,
 * bad model, invalid token — retrying would just waste credits).
 */
export function isTransientReplicateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b429\b|\b5\d\d\b/.test(msg)) return true;
  return /throttle|rate.?limit|too many requests|service unavailable|gateway timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(
    msg
  );
}

/**
 * Wrap any Replicate call with exponential backoff on transient failures.
 * Schedule: 2s, 4s, 8s, 16s (4 retries after the initial attempt, ≈30s
 * worst-case wait before the 5th attempt fires).
 *
 * Matches the heuristic used in `scripts/test-engines-ab.ts` (proven to
 * keep the A/B/C bench green even when burning through 12 generations
 * back-to-back on the free tier).
 *
 * Note: NSFW / safety errors are NOT considered transient. The image
 * service handles those upstream by retrying with a safer prompt prefix.
 */
export async function withReplicateRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 5
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= maxAttempts || !isTransientReplicateError(err)) {
        throw err;
      }
      const waitMs = 2000 * Math.pow(2, attempt - 1);
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[replicate] ${label} transient failure (${msg.slice(0, 100)}). Retry ${attempt}/${maxAttempts - 1} in ${waitMs}ms…`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

/**
 * Max simultaneous Replicate predictions per user-facing generation call.
 * Calibrated against Replicate's free-tier (~10 concurrent) / pay-as-you-go
 * (~100 concurrent) quota: at 2× per user, 5 users can generate in parallel
 * before approaching the free-tier ceiling. Combined with `withReplicateRetry`,
 * this absorbs realistic beta-traffic bursts without surfacing 429s.
 *
 * Tune upward when the queue (BullMQ + Redis, planned post-beta) takes over
 * global concurrency control.
 */
export const MAX_PARALLEL_PREDICTIONS_PER_CALL = 2;

/**
 * Run an array of async tasks with a hard concurrency cap. Behaves like
 * `Promise.allSettled` (never throws on individual failure) but slices the
 * input into batches so the Replicate API never sees more than `concurrency`
 * simultaneous predictions from a single generation call.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    async () => {
      while (cursor < tasks.length) {
        const idx = cursor++;
        try {
          results[idx] = { status: "fulfilled", value: await tasks[idx]() };
        } catch (reason) {
          results[idx] = { status: "rejected", reason };
        }
      }
    }
  );
  await Promise.all(workers);
  return results;
}
