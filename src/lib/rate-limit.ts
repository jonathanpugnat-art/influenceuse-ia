type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60 * 60 * 1000;
const buckets = new Map<string, Bucket>();

export const LIMITS = {
  scrape: 10,
  post: 30,
  video: 10,
  chatter: 120,
} as const;

export type LimitKind = keyof typeof LIMITS;

export function checkRateLimit(userId: string, kind: LimitKind, now = Date.now()): boolean {
  const key = `${kind}:${userId}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= LIMITS[kind]) return false;
  buckets.set(key, { count: bucket.count + 1, resetAt: bucket.resetAt });
  return true;
}

export function resetRateLimits(): void {
  buckets.clear();
}
