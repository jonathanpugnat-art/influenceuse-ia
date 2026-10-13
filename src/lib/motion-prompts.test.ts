import { describe, expect, it } from "vitest";

import { buildMotionPrompt, VIDEO_DURATION_SECONDS } from "@/lib/motion-prompts";

describe("motion prompts", () => {
  it("locks identity and keeps duration at 5s", () => {
    expect(VIDEO_DURATION_SECONDS).toBe(5);
    const prompt = buildMotionPrompt({
      sourceLabel: "POV",
      sourceKind: "format",
      sourceRef: "pov",
      parentPrompt: "she looks into the lens",
    });
    expect(prompt).toMatch(/exact same face/i);
    expect(prompt).toMatch(/leans toward the lens/i);
    expect(prompt).toMatch(/9:16/);
  });

  it("falls back for unknown format", () => {
    const prompt = buildMotionPrompt({
      sourceLabel: "Reel #trend",
      sourceKind: "reel",
      sourceRef: "abc",
    });
    expect(prompt).toMatch(/subtle cinematic motion/i);
  });
});
