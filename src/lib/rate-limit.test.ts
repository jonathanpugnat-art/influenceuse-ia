import assert from "node:assert/strict";
import test from "node:test";

import { LIMITS, checkRateLimit, resetRateLimits } from "./rate-limit.ts";

test("le scraping se bloque après la limite horaire puis se rouvre", () => {
  resetRateLimits();
  const start = 1_000_000;
  for (let i = 0; i < LIMITS.scrape; i += 1) {
    assert.equal(checkRateLimit("user_a", "scrape", start), true);
  }
  assert.equal(checkRateLimit("user_a", "scrape", start), false);
  assert.equal(checkRateLimit("user_b", "scrape", start), true);
  assert.equal(checkRateLimit("user_a", "scrape", start + 60 * 60 * 1000), true);
});
