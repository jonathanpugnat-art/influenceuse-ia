import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isSpeechConfigured,
  reelNarrationCreditCost,
} from "@/server/services/ai-speech.service";
import { CREDIT_COSTS } from "@/lib/constants";

describe("ai-speech.service", () => {
  const prev = process.env.REPLICATE_API_TOKEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.REPLICATE_API_TOKEN;
    else process.env.REPLICATE_API_TOKEN = prev;
  });

  it("isSpeechConfigured reflects REPLICATE_API_TOKEN", () => {
    delete process.env.REPLICATE_API_TOKEN;
    expect(isSpeechConfigured()).toBe(false);
    process.env.REPLICATE_API_TOKEN = "test-token";
    expect(isSpeechConfigured()).toBe(true);
  });

  it("reelNarrationCreditCost matches constants", () => {
    expect(reelNarrationCreditCost()).toBe(CREDIT_COSTS.REEL_NARRATION);
  });
});
