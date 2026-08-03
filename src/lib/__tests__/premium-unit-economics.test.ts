import { describe, it, expect } from "vitest";
import {
  API_UNIT_COST_USD,
  computeSelfHostBreakEven,
  estimateApiCostUsd,
  estimateMarginOnCredits,
} from "@/lib/premium-unit-economics";

describe("premium-unit-economics", () => {
  it("estimates API cost from volume", () => {
    const est = estimateApiCostUsd({
      photoSfw: 100,
      photoPremium: 50,
      reel: 10,
      baseImage: 5,
      identityPack: 2,
      scenePlate: 0,
      failedImageJobs: 10,
      premiumRetriesEstimate: 5,
    });

    expect(est.premiumPhotoCount).toBe(55);
    expect(est.totalUsd).toBeGreaterThan(0);
    expect(est.byCategory.photoPremium).toBe(
      50 * API_UNIT_COST_USD.photoPremiumReplicate
    );
  });

  it("recommends replicate at low volume", () => {
    const be = computeSelfHostBreakEven({
      monthlyGpuFixedUsd: 0,
      minVolumeThreshold: 300,
    });
    expect(be.savingsPerPhotoUsd).toBeGreaterThan(0);
    expect(be.recommendation).toBe("replicate");
    expect(be.minPremiumPhotosPerMonth).toBe(300);
  });

  it("computes pro plan margin", () => {
    const m = estimateMarginOnCredits({
      creditsConsumed: 500,
      apiCostUsd: 20,
      plan: "PRO",
    });
    expect(m.revenueEur).toBeCloseTo((79 / 1500) * 500, 1);
    expect(m.grossMarginPct).toBeDefined();
  });
});
