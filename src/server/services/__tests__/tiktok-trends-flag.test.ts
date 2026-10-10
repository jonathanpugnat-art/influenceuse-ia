import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isTikTokTrendsScrapingEnabled } from "@/server/services/trends/providers/apify/env-config";

describe("TIKTOK_TRENDS_ENABLED feature flag", () => {
  const originalValue = process.env.TIKTOK_TRENDS_ENABLED;

  beforeEach(() => {
    delete process.env.TIKTOK_TRENDS_ENABLED;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.TIKTOK_TRENDS_ENABLED;
    } else {
      process.env.TIKTOK_TRENDS_ENABLED = originalValue;
    }
  });

  it("defaults to OFF (false) — audit-safe default", () => {
    expect(isTikTokTrendsScrapingEnabled()).toBe(false);
  });

  it("stays OFF for empty or placeholder values", () => {
    process.env.TIKTOK_TRENDS_ENABLED = "";
    expect(isTikTokTrendsScrapingEnabled()).toBe(false);
    process.env.TIKTOK_TRENDS_ENABLED = "false";
    expect(isTikTokTrendsScrapingEnabled()).toBe(false);
    process.env.TIKTOK_TRENDS_ENABLED = "0";
    expect(isTikTokTrendsScrapingEnabled()).toBe(false);
    process.env.TIKTOK_TRENDS_ENABLED = "no";
    expect(isTikTokTrendsScrapingEnabled()).toBe(false);
  });

  it("turns ON only for explicit 'true' / '1'", () => {
    process.env.TIKTOK_TRENDS_ENABLED = "true";
    expect(isTikTokTrendsScrapingEnabled()).toBe(true);
    process.env.TIKTOK_TRENDS_ENABLED = "TRUE";
    expect(isTikTokTrendsScrapingEnabled()).toBe(true);
    process.env.TIKTOK_TRENDS_ENABLED = "1";
    expect(isTikTokTrendsScrapingEnabled()).toBe(true);
  });
});
