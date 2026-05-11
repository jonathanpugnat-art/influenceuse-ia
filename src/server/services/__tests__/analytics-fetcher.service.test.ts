import { describe, it, expect } from "vitest";
import {
  shouldRefresh,
  refreshIntervalForAge,
  computeEngagementRate,
} from "@/server/services/analytics-fetcher.service";

describe("analytics-fetcher (pure helpers)", () => {
  describe("refreshIntervalForAge", () => {
    it("returns 0 for posts younger than 24h (always refresh)", () => {
      expect(refreshIntervalForAge(10 * 60 * 1000)).toBe(0);
      expect(refreshIntervalForAge(23 * 60 * 60 * 1000)).toBe(0);
    });

    it("returns 6h for 1-7 day old posts", () => {
      expect(refreshIntervalForAge(2 * 24 * 60 * 60 * 1000)).toBe(6 * 60 * 60 * 1000);
      expect(refreshIntervalForAge(6 * 24 * 60 * 60 * 1000)).toBe(6 * 60 * 60 * 1000);
    });

    it("returns 1d for 7-30 day old posts", () => {
      expect(refreshIntervalForAge(15 * 24 * 60 * 60 * 1000)).toBe(24 * 60 * 60 * 1000);
    });

    it("returns 7d for posts older than 30 days", () => {
      expect(refreshIntervalForAge(60 * 24 * 60 * 60 * 1000)).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("shouldRefresh", () => {
    const now = new Date("2026-05-08T12:00:00Z");

    it("does not refresh if publishedAt is null", () => {
      expect(
        shouldRefresh({ publishedAt: null, latestFetchedAt: null, now })
      ).toBe(false);
    });

    it("refreshes a fresh post that has never been fetched", () => {
      expect(
        shouldRefresh({
          publishedAt: new Date(now.getTime() - 60 * 60 * 1000),
          latestFetchedAt: null,
          now,
        })
      ).toBe(true);
    });

    it("refreshes a 2-day-old post if last snapshot is older than 6h", () => {
      const publishedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fresh = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const stale = new Date(now.getTime() - 7 * 60 * 60 * 1000);
      expect(shouldRefresh({ publishedAt, latestFetchedAt: fresh, now })).toBe(false);
      expect(shouldRefresh({ publishedAt, latestFetchedAt: stale, now })).toBe(true);
    });

    it("does not refresh a 60-day-old post if snapshot is younger than 7 days", () => {
      const publishedAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const recent = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(shouldRefresh({ publishedAt, latestFetchedAt: recent, now })).toBe(false);
    });
  });

  describe("computeEngagementRate", () => {
    it("uses views as denominator when available", () => {
      const r = computeEngagementRate({
        views: 1000,
        likes: 50,
        comments: 30,
        shares: 10,
        saves: 10,
      });
      // (50+30+10+10)/1000 = 0.1
      expect(r).toBeCloseTo(0.1, 5);
    });

    it("returns 0 when there are no interactions and no views", () => {
      expect(
        computeEngagementRate({ views: 0, likes: 0, comments: 0, shares: 0, saves: 0 })
      ).toBe(0);
    });

    it("falls back to interactions/interactions = 1 when views=0 but likes>0", () => {
      // Edge case: we can't compute a ratio without a denominator. Return 1 so
      // we don't lose the data point in averages.
      expect(
        computeEngagementRate({ views: 0, likes: 5, comments: 0, shares: 0, saves: 0 })
      ).toBe(1);
    });
  });
});
