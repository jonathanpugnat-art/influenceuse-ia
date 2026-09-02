import { describe, expect, it } from "vitest";
import {
  clampTalkingHeadDurationSec,
  countScriptWords,
  estimateTalkingHeadCredits,
  estimateTalkingHeadDurationSec,
  validateTalkingHeadScript,
} from "@/lib/talking-head";
import {
  CREDIT_COSTS,
  MAX_TALKING_HEAD_SEC,
  MAX_TALKING_HEAD_WORDS,
  TALKING_HEAD_WORDS_PER_SEC,
} from "@/lib/constants";

describe("talking-head helpers", () => {
  it("countScriptWords ignores extra whitespace", () => {
    expect(countScriptWords("")).toBe(0);
    expect(countScriptWords("   ")).toBe(0);
    expect(countScriptWords("hello  world")).toBe(2);
    expect(countScriptWords("un deux trois\n\nquatre")).toBe(4);
  });

  it("estimateTalkingHeadDurationSec follows the 2.5w/s cadence", () => {
    // 25 words → 10s exactly at 2.5 w/s.
    const s = Array.from({ length: 25 }, (_, i) => `w${i}`).join(" ");
    const duration = estimateTalkingHeadDurationSec(s);
    expect(duration).toBeCloseTo(25 / TALKING_HEAD_WORDS_PER_SEC, 5);
  });

  it("clampTalkingHeadDurationSec never exceeds MAX_TALKING_HEAD_SEC", () => {
    expect(clampTalkingHeadDurationSec(9999)).toBe(MAX_TALKING_HEAD_SEC);
    expect(clampTalkingHeadDurationSec(-1)).toBe(0);
    expect(clampTalkingHeadDurationSec(12.5)).toBe(12.5);
  });

  it("estimateTalkingHeadCredits ceils to whole seconds and clamps to MAX cap", () => {
    expect(estimateTalkingHeadCredits(0)).toBe(0);
    // 0.1s ceils to 1s → 1 * per-sec.
    expect(estimateTalkingHeadCredits(0.1)).toBe(
      CREDIT_COSTS.TALKING_HEAD_PER_SEC
    );
    expect(estimateTalkingHeadCredits(10)).toBe(
      10 * CREDIT_COSTS.TALKING_HEAD_PER_SEC
    );
    // 60s must clamp to 30s cap → 30 * per-sec.
    expect(estimateTalkingHeadCredits(60)).toBe(
      MAX_TALKING_HEAD_SEC * CREDIT_COSTS.TALKING_HEAD_PER_SEC
    );
  });

  describe("validateTalkingHeadScript", () => {
    it("rejects empty scripts with a French error", () => {
      const res = validateTalkingHeadScript("");
      expect(res.ok).toBe(false);
      expect(res.words).toBe(0);
      expect(res.error).toMatch(/script/i);
    });

    it("rejects scripts above MAX_TALKING_HEAD_WORDS", () => {
      const words = Array.from(
        { length: MAX_TALKING_HEAD_WORDS + 5 },
        (_, i) => `mot${i}`
      ).join(" ");
      const res = validateTalkingHeadScript(words);
      expect(res.ok).toBe(false);
      expect(res.words).toBe(MAX_TALKING_HEAD_WORDS + 5);
      expect(res.error).toMatch(new RegExp(String(MAX_TALKING_HEAD_WORDS)));
    });

    it("accepts scripts at the boundary", () => {
      const words = Array.from(
        { length: MAX_TALKING_HEAD_WORDS },
        (_, i) => `mot${i}`
      ).join(" ");
      const res = validateTalkingHeadScript(words);
      expect(res.ok).toBe(true);
      expect(res.words).toBe(MAX_TALKING_HEAD_WORDS);
    });
  });
});
