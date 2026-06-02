import { describe, it, expect, beforeEach } from "vitest";
import {
  assertAiGenerationRateLimit,
  isAiGenerationPath,
  resetAiRateLimitBuckets,
} from "@/server/trpc/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetAiRateLimitBuckets();
  });

  it("detects AI generation paths", () => {
    expect(isAiGenerationPath("content.generatePhoto")).toBe(true);
    expect(isAiGenerationPath("influencer.list")).toBe(false);
  });

  it("throws after limit exceeded", async () => {
    const userId = "user_test";
    const path = "content.generatePhoto";

    for (let i = 0; i < 30; i++) {
      await assertAiGenerationRateLimit(userId, path);
    }

    await expect(assertAiGenerationRateLimit(userId, path)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});
