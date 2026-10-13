import { describe, expect, it } from "vitest";

import {
  CREDIT_PACKS,
  PAID_PLANS,
  packById,
  planById,
  planFromPriceId,
  resolvePriceId,
} from "@/lib/billing/plans";
import {
  CREDIT_COSTS,
  canAfford,
  stripeCheckoutGrantKey,
  stripeInvoiceGrantKey,
  stripePackGrantKey,
} from "@/lib/credits";

describe("billing plans", () => {
  it("exposes three paid plans with credit allowances", () => {
    expect(PAID_PLANS.map((p) => p.id)).toEqual(["starter", "creator", "agence"]);
    expect(planById("starter")?.creditsPerMonth).toBe(500);
    expect(planById("creator")?.creditsPerMonth).toBe(1500);
    expect(planById("agence")?.creditsPerMonth).toBe(5000);
    expect(planById("decouverte")?.name).toBe("Découverte");
  });

  it("maps Stripe price ids from env with legacy fallbacks", () => {
    const env = {
      STRIPE_STARTER_PRICE_ID: "price_starter",
      STRIPE_PRO_PRICE_ID: "price_pro",
      STRIPE_ENTERPRISE_PRICE_ID: "price_ent",
    };
    expect(resolvePriceId(PAID_PLANS[0]!, env)).toBe("price_starter");
    expect(planFromPriceId("price_pro", env)?.id).toBe("creator");
    expect(planFromPriceId("price_unknown", env)).toBeNull();
  });

  it("lists credit packs", () => {
    expect(CREDIT_PACKS).toHaveLength(3);
    expect(packById("medium")?.credits).toBe(500);
  });
});

describe("credit keys", () => {
  it("keeps post cost at 1 and video at 10", () => {
    expect(CREDIT_COSTS.post).toBe(1);
    expect(CREDIT_COSTS.video).toBe(10);
  });

  it("builds stable stripe idempotency keys", () => {
    expect(stripeCheckoutGrantKey("cs_1")).toBe("stripe:checkout:cs_1");
    expect(stripeInvoiceGrantKey("in_1")).toBe("stripe:invoice:in_1");
    expect(stripePackGrantKey("cs_2")).toBe("stripe:pack:cs_2");
  });

  it("canAfford respects enforcement", () => {
    expect(canAfford(0, 1, false)).toBe(true);
    expect(canAfford(0, 1, true)).toBe(false);
    expect(canAfford(1, 1, true)).toBe(true);
  });
});
