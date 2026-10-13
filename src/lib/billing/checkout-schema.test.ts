import { describe, expect, it } from "vitest";

import { parseCheckoutBody } from "@/lib/billing/checkout-schema";

describe("parseCheckoutBody", () => {
  it("accepte subscription et pack valides", () => {
    expect(parseCheckoutBody({ kind: "subscription", plan: "starter" })).toEqual({
      ok: true,
      value: { kind: "subscription", plan: "starter" },
    });
    expect(parseCheckoutBody({ kind: "pack", packId: "small" })).toEqual({
      ok: true,
      value: { kind: "pack", packId: "small" },
    });
  });

  it("rejette plan/pack invalides", () => {
    expect(parseCheckoutBody({ kind: "subscription", plan: "decouverte" }).ok).toBe(false);
    expect(parseCheckoutBody({ kind: "subscription", plan: "pro" }).ok).toBe(false);
    expect(parseCheckoutBody({ kind: "pack", packId: "xl" }).ok).toBe(false);
    expect(parseCheckoutBody({ kind: "other" }).ok).toBe(false);
  });
});
