import { describe, it, expect } from "vitest";
import {
  suggestSlots,
  dayOfWeekMondayFirst,
  type HeatmapCell,
} from "@/server/services/smart-scheduler.service";

function fullHeatmap(): HeatmapCell[] {
  // Generates a flat zero heatmap that callers can populate.
  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      cells.push({ day: d, hour: h, engagement: 0, count: 0 });
    }
  }
  return cells;
}

function setCell(cells: HeatmapCell[], day: number, hour: number, engagement: number, count: number) {
  const c = cells.find((x) => x.day === day && x.hour === hour)!;
  c.engagement = engagement;
  c.count = count;
}

describe("smart-scheduler", () => {
  describe("dayOfWeekMondayFirst", () => {
    it("maps Monday=0 .. Sunday=6", () => {
      // 2026-05-04 is a Monday
      expect(dayOfWeekMondayFirst(new Date("2026-05-04T12:00:00Z"))).toBe(0);
      // 2026-05-10 is a Sunday
      expect(dayOfWeekMondayFirst(new Date("2026-05-10T12:00:00Z"))).toBe(6);
    });
  });

  describe("suggestSlots", () => {
    it("returns [] when total samples are below minSamples", () => {
      const cells = fullHeatmap();
      setCell(cells, 1, 19, 0.1, 1);
      setCell(cells, 2, 20, 0.15, 2);
      const out = suggestSlots({
        cells,
        count: 5,
        startsFrom: new Date("2026-05-04T08:00:00Z"),
        minSamples: 5,
      });
      expect(out).toEqual([]);
    });

    it("returns slots in chronological order, biased to top engagement cells", () => {
      const cells = fullHeatmap();
      // Mon 19h is the absolute best, Tue 20h second.
      setCell(cells, 0, 19, 0.5, 10);
      setCell(cells, 1, 20, 0.4, 8);
      setCell(cells, 2, 21, 0.3, 6);
      // A bunch of low-perf cells to ensure the top-30% filter trims them.
      for (let d = 3; d < 7; d++) setCell(cells, d, 12, 0.05, 3);

      const out = suggestSlots({
        cells,
        count: 3,
        startsFrom: new Date("2026-05-04T08:00:00Z"), // Mon 8am
        minSamples: 5,
      });
      expect(out.length).toBe(3);
      // Chronological ordering: Mon 19, Tue 20, Wed 21.
      expect(out[0].at < out[1].at).toBe(true);
      expect(out[1].at < out[2].at).toBe(true);
      // Each slot's hour must match a top cell.
      for (const s of out) {
        expect([19, 20, 21]).toContain(s.hour);
      }
    });

    it("avoids slots within 2h of an already-scheduled time (picks next non-conflicting top cell)", () => {
      // Need ≥10 top-tier cells so the top-30% filter keeps several options.
      const cells = fullHeatmap();
      // Set 12 strong cells so the top-30% slice keeps ~4 of them.
      const tops: Array<[number, number]> = [
        [0, 19],
        [1, 20],
        [2, 21],
        [3, 18],
        [4, 19],
        [5, 20],
        [6, 21],
        [0, 12],
        [1, 13],
        [2, 14],
        [3, 15],
        [4, 16],
      ];
      for (const [d, h] of tops) setCell(cells, d, h, 0.5, 10);

      const out = suggestSlots({
        cells,
        count: 1, // must NOT pick the conflicting Mon-19h
        startsFrom: new Date("2026-05-04T08:00:00"),
        alreadyScheduledAt: [new Date("2026-05-04T19:30:00")], // Mon 19:30 local
      });
      // Mon 19h is filtered (within 2h of an already-scheduled). The next
      // chronological top cell of the same week wins.
      expect(out[0]?.at.getTime()).not.toBe(
        new Date("2026-05-04T19:00:00").getTime()
      );
      // It should still be in the same week (any subsequent top cell).
      expect(out[0]?.at.getTime()).toBeLessThan(
        new Date("2026-05-11T00:00:00").getTime()
      );
    });

    it("never returns the same-day candidate that's at startsFrom (within +1h)", () => {
      // Create enough top cells so they survive the top-30% filter.
      const cells = fullHeatmap();
      const tops: Array<[number, number]> = [
        [0, 8], // Mon 8h — same time as startsFrom, must be rejected
        [1, 9],
        [2, 10],
        [3, 11],
        [4, 12],
        [5, 13],
        [6, 14],
        [0, 15],
        [1, 16],
        [2, 17],
        [3, 18],
        [4, 19],
      ];
      for (const [d, h] of tops) setCell(cells, d, h, 0.5, 10);

      const out = suggestSlots({
        cells,
        count: 1,
        startsFrom: new Date("2026-05-04T08:00:00"), // Mon 8h LOCAL
      });
      // First candidate of the current week is Mon 8h itself → rejected (now).
      // Next top hits should still be inside the current week (NOT next week).
      expect(out[0]?.at.getTime()).toBeLessThan(
        new Date("2026-05-11T00:00:00").getTime()
      );
      expect(out[0]?.at.getTime()).toBeGreaterThan(
        new Date("2026-05-04T08:00:00").getTime()
      );
    });

    it("respects the requested count", () => {
      const cells = fullHeatmap();
      // Many distinct top cells across the week (different hours so they
      // don't get filtered by the 2h dedup window between consecutive picks).
      const slots = [
        [0, 9],
        [1, 12],
        [2, 15],
        [3, 18],
        [4, 21],
      ] as const;
      for (const [d, h] of slots) setCell(cells, d, h, 0.4, 10);

      const out = suggestSlots({
        cells,
        count: 3,
        startsFrom: new Date("2026-05-04T06:00:00"),
      });
      expect(out.length).toBe(3);
    });
  });
});
