// ──────────────────────────────────────────────
// Smart scheduler (Sprint 10 — Later)
//
// Builds a list of "best next slot" timestamps from the user's historical
// engagement heatmap (Sprint 8 best-hours). Used by the calendar UI to
// pre-fill batch generation, content plans, and the scheduling drawer with
// data-driven defaults instead of arbitrary defaults.
//
// Inputs:
//  - heatmap cells [{ day (0=Mon..6=Sun), hour (0..23), engagement, count }]
//  - count: how many distinct slots to return
//  - startsFrom: anchor date (typically `new Date()`)
//  - alreadyScheduledAt: existing scheduled timestamps to avoid clashing with
//
// Heuristics (intentionally simple, predictable, testable):
//  1. Filter cells with count > 0 (we never recommend a slot we have no
//     evidence for). If we have less than `minSamples` total, return [] —
//     the UI is responsible for falling back to "default" hours like 19h.
//  2. Sort cells by engagement DESC, take top 30%.
//  3. From `startsFrom`, scan the next 14 days and emit, for each upcoming
//     (day-of-week, hour) tuple matching one of the top cells, a candidate
//     timestamp.
//  4. Drop candidates within 2h of any `alreadyScheduledAt` to avoid
//     dog-piling (3 posts at 19h would tank reach).
//  5. Drop candidates < 1h in the future.
//  6. Take the first `count` candidates.
// ──────────────────────────────────────────────

export interface HeatmapCell {
  day: number; // 0 = Monday
  hour: number; // 0..23
  engagement: number;
  count: number;
}

export interface SuggestedSlot {
  /** Suggested timestamp (UTC). */
  at: Date;
  /** Day-of-week (0 = Mon..6 = Sun). */
  day: number;
  /** Hour-of-day (0..23). */
  hour: number;
  /** Average engagement observed in this cell. */
  engagement: number;
  /** Sample size for this cell (the more, the more confident). */
  count: number;
}

export interface SuggestSlotsInput {
  cells: HeatmapCell[];
  count: number;
  startsFrom: Date;
  alreadyScheduledAt?: Date[];
  /** Min total samples across the whole heatmap before we'll suggest anything. */
  minSamples?: number;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Returns 0 (Mon) .. 6 (Sun) for a Date, matching the heatmap convention.
 */
export function dayOfWeekMondayFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Pure function — easy to unit test without a DB.
 */
export function suggestSlots(input: SuggestSlotsInput): SuggestedSlot[] {
  const minSamples = input.minSamples ?? 5;
  const samplesTotal = input.cells.reduce((s, c) => s + c.count, 0);
  if (samplesTotal < minSamples) return [];

  // Step 1+2 — keep only cells with samples, then take top 30%.
  const withSamples = input.cells
    .filter((c) => c.count > 0)
    .sort((a, b) => b.engagement - a.engagement);
  if (withSamples.length === 0) return [];

  const topCount = Math.max(1, Math.ceil(withSamples.length * 0.3));
  const top = withSamples.slice(0, topCount);
  // Index by (day, hour) for O(1) lookup.
  const topByKey = new Map<string, HeatmapCell>();
  for (const c of top) topByKey.set(`${c.day}-${c.hour}`, c);

  const blocked = (input.alreadyScheduledAt ?? []).map((d) => d.getTime());
  const out: SuggestedSlot[] = [];

  // Step 3 — scan next 14 days, hour by hour, in chronological order.
  const start = new Date(input.startsFrom);
  for (let dayOffset = 0; dayOffset < 14 && out.length < input.count; dayOffset++) {
    for (let hour = 0; hour < 24 && out.length < input.count; hour++) {
      const candidate = new Date(start);
      candidate.setDate(candidate.getDate() + dayOffset);
      candidate.setHours(hour, 0, 0, 0);
      // Step 5 — must be at least +1h from now.
      if (candidate.getTime() - input.startsFrom.getTime() < ONE_HOUR_MS) continue;

      const dow = dayOfWeekMondayFirst(candidate);
      const cell = topByKey.get(`${dow}-${hour}`);
      if (!cell) continue;

      // Step 4 — no other slot within ±2h.
      const t = candidate.getTime();
      const tooClose =
        blocked.some((b) => Math.abs(b - t) < TWO_HOURS_MS) ||
        out.some((s) => Math.abs(s.at.getTime() - t) < TWO_HOURS_MS);
      if (tooClose) continue;

      out.push({
        at: candidate,
        day: cell.day,
        hour: cell.hour,
        engagement: cell.engagement,
        count: cell.count,
      });
    }
  }

  return out;
}
