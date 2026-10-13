import { describe, expect, it } from "vitest";

import { KLING_MODEL, SEEDANCE_MODEL } from "@/lib/video/provider";
import { CREDIT_COSTS } from "@/lib/credits";
import { VIDEO_DURATION_SECONDS } from "@/lib/motion-prompts";

describe("video provider constants", () => {
  it("targets Kling 2.5 Turbo Pro with Seedance fallback and 10-credit 5s clips", () => {
    expect(KLING_MODEL).toBe("kwaivgi/kling-v2.5-turbo-pro");
    expect(SEEDANCE_MODEL).toBe("bytedance/seedance-1-pro");
    expect(CREDIT_COSTS.video).toBe(10);
    expect(VIDEO_DURATION_SECONDS).toBe(5);
  });
});
