import { describe, it, expect } from "vitest";
import {
  computeFingerprint,
  renderFingerprintPrompt,
} from "@/server/services/personality-memory.service";

describe("personality-memory.service", () => {
  describe("computeFingerprint", () => {
    it("returns an empty fingerprint for no posts", () => {
      const fp = computeFingerprint([]);
      expect(fp.sampleSize).toBe(0);
      expect(fp.topEmojis).toEqual([]);
      expect(fp.openingPatterns).toEqual([]);
    });

    it("extracts top emojis sorted by frequency", () => {
      const fp = computeFingerprint([
        { caption: "Hi 💪 today 🔥", hashtags: [] },
        { caption: "Move 💪 sweat 💪", hashtags: [] },
        { caption: "Yes 🔥", hashtags: [] },
      ]);
      expect(fp.topEmojis[0]).toBe("💪");
      expect(fp.topEmojis).toContain("🔥");
    });

    it("extracts repeated openings (>=2 occurrences)", () => {
      const fp = computeFingerprint([
        { caption: "Hello everyone, today is leg day", hashtags: [] },
        { caption: "Hello friends, this is my routine", hashtags: [] },
        { caption: "GM team, fresh batch", hashtags: [] },
      ]);
      expect(fp.openingPatterns).toContain("hello");
    });

    it("aggregates hashtags into topics", () => {
      const fp = computeFingerprint([
        { caption: "test", hashtags: ["#fitness", "#mood"] },
        { caption: "test 2", hashtags: ["#sport", "#fitness"] },
      ]);
      expect(fp.recentTopics).toContain("fitness");
      expect(fp.recentTopics.length).toBeGreaterThan(0);
    });

    it("computes the average caption length", () => {
      const fp = computeFingerprint([
        { caption: "abc", hashtags: [] },
        { caption: "abcdefghi", hashtags: [] },
      ]);
      expect(fp.avgLength).toBe(6);
    });
  });

  describe("renderFingerprintPrompt", () => {
    it("returns an empty string when sampleSize=0", () => {
      const out = renderFingerprintPrompt({
        topEmojis: [],
        openingPatterns: [],
        recentTopics: [],
        avgLength: 0,
        sampleSize: 0,
      });
      expect(out).toBe("");
    });

    it("includes voice instructions when sampleSize>0", () => {
      const out = renderFingerprintPrompt({
        topEmojis: ["💪"],
        openingPatterns: ["hello"],
        recentTopics: ["fitness"],
        avgLength: 200,
        sampleSize: 5,
      });
      expect(out).toContain("VOIX");
      expect(out).toContain("💪");
      expect(out).toContain("hello");
      expect(out).toContain("fitness");
      expect(out).toContain("200");
    });
  });
});
