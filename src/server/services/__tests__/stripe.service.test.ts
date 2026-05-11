import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStripeCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();

const mockStripe = {
  customers: { create: mockStripeCustomersCreate },
  checkout: { sessions: { create: mockCheckoutSessionsCreate } },
  billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
};

const mockDb = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/server/db", () => ({ db: mockDb }));

vi.mock("stripe", () => ({
  default: function MockStripe() {
    return mockStripe;
  },
}));

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
});

const db = mockDb;

describe("stripe.service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      stripeCustomerId: null,
    });
    mockDb.user.update.mockResolvedValue({} as never);
  });

  describe("createCheckoutSession", () => {
    it("creates customer then checkout session and returns URL", async () => {
      const { createCheckoutSession } = await import("@/server/services/stripe.service");
      mockStripeCustomersCreate.mockResolvedValue({ id: "cus_123" });
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session/abc",
      });

      const url = await createCheckoutSession(
        "user-1",
        "user@test.com",
        "Test User",
        "price_123",
        "https://app/success",
        "https://app/cancel"
      );

      expect(url).toBe("https://checkout.stripe.com/session/abc");
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_123",
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [{ price: "price_123", quantity: 1 }],
          success_url: "https://app/success",
          cancel_url: "https://app/cancel",
          metadata: { userId: "user-1" },
        })
      );
    });

    it("reuses existing stripeCustomerId when user has one", async () => {
      const { createCheckoutSession } = await import("@/server/services/stripe.service");
      mockDb.user.findUnique.mockResolvedValue({
        id: "user-1",
        stripeCustomerId: "cus_existing",
      } as never);
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session/xyz",
      });

      await createCheckoutSession(
        "user-1",
        "user@test.com",
        null,
        "price_456",
        "https://app/success",
        "https://app/cancel"
      );

      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing",
          line_items: [{ price: "price_456", quantity: 1 }],
        })
      );
    });

    it("throws when Stripe does not return session URL", async () => {
      const { createCheckoutSession } = await import("@/server/services/stripe.service");
      mockStripeCustomersCreate.mockResolvedValue({ id: "cus_123" });
      mockCheckoutSessionsCreate.mockResolvedValue({ url: null });

      await expect(
        createCheckoutSession(
          "user-1",
          "u@t.com",
          null,
          "price_1",
          "https://s",
          "https://c"
        )
      ).rejects.toThrow(); // "Failed to create checkout session" (wraps inner error)
    });
  });

  describe("createPortalSession", () => {
    it("creates portal session and returns URL", async () => {
      const { createPortalSession } = await import("@/server/services/stripe.service");
      mockBillingPortalSessionsCreate.mockResolvedValue({
        url: "https://billing.stripe.com/portal/xyz",
      });

      const url = await createPortalSession("cus_123", "https://app/return");

      expect(url).toBe("https://billing.stripe.com/portal/xyz");
      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        return_url: "https://app/return",
      });
    });
  });

  describe("getPlanFromPriceId", () => {
    // These tests assert the contract: every paid Stripe Price ID resolves
    // to its internal plan + the credit allowance defined in `PLANS`. We
    // import `PLANS` here so the test stays in lockstep with constants.ts.
    it("returns plan config for known STARTER price id", async () => {
      const { getPlanFromPriceId } = await import(
        "@/server/services/stripe.service"
      );
      const { PLANS } = await import("@/lib/constants");
      const priceId = process.env.STRIPE_STARTER_PRICE_ID ?? "price_starter";
      const plan = getPlanFromPriceId(priceId);
      expect(plan).toEqual({
        plan: "STARTER",
        creditsLimit: PLANS.STARTER.credits,
      });
    });

    it("returns plan config for known PRO price id", async () => {
      const { getPlanFromPriceId } = await import(
        "@/server/services/stripe.service"
      );
      const { PLANS } = await import("@/lib/constants");
      const priceId = process.env.STRIPE_PRO_PRICE_ID ?? "price_pro";
      const plan = getPlanFromPriceId(priceId);
      expect(plan).toEqual({
        plan: "PRO",
        creditsLimit: PLANS.PRO.credits,
      });
    });

    it("returns plan config for known ENTERPRISE price id", async () => {
      const { getPlanFromPriceId } = await import(
        "@/server/services/stripe.service"
      );
      const { PLANS } = await import("@/lib/constants");
      const priceId =
        process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "price_enterprise";
      const plan = getPlanFromPriceId(priceId);
      // Enterprise might be modelled as "Infinity" in PLANS; the price-map
      // materialises it as a finite cap (999_999) for DB safety.
      const expectedCredits = Number.isFinite(PLANS.ENTERPRISE.credits)
        ? PLANS.ENTERPRISE.credits
        : 999_999;
      expect(plan).toEqual({
        plan: "ENTERPRISE",
        creditsLimit: expectedCredits,
      });
    });

    it("returns null for unknown price id", async () => {
      const { getPlanFromPriceId } = await import(
        "@/server/services/stripe.service"
      );
      const plan = getPlanFromPriceId("price_unknown");
      expect(plan).toBeNull();
    });
  });

  describe("credit packs (Sprint 7)", () => {
    it("CREDIT_PACKS exposes 3 packs with strictly increasing credits", async () => {
      const { CREDIT_PACKS } = await import("@/server/services/stripe.service");
      expect(CREDIT_PACKS).toHaveLength(3);
      expect(CREDIT_PACKS[0].credits).toBeLessThan(CREDIT_PACKS[1].credits);
      expect(CREDIT_PACKS[1].credits).toBeLessThan(CREDIT_PACKS[2].credits);
    });

    it("getCreditPack returns the right pack by id", async () => {
      const { getCreditPack } = await import("@/server/services/stripe.service");
      expect(getCreditPack("small")?.id).toBe("small");
      expect(getCreditPack("medium")?.id).toBe("medium");
      expect(getCreditPack("large")?.id).toBe("large");
    });

    it("createCreditPackCheckout uses payment mode and includes pack metadata", async () => {
      vi.resetModules();
      process.env.STRIPE_CREDIT_PACK_SMALL_PRICE_ID = "price_pack_small_test";
      const { createCreditPackCheckout, getCreditPack } = await import(
        "@/server/services/stripe.service"
      );
      mockStripeCustomersCreate.mockResolvedValue({ id: "cus_p" });
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session/pack",
      });

      const pack = getCreditPack("small")!;
      pack.priceId = "price_pack_small_test";
      const url = await createCreditPackCheckout({
        userId: "user-1",
        email: "u@t.com",
        name: null,
        pack,
        successUrl: "https://app/success",
        cancelUrl: "https://app/cancel",
      });

      expect(url).toBe("https://checkout.stripe.com/session/pack");
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          line_items: [{ price: "price_pack_small_test", quantity: 1 }],
          metadata: expect.objectContaining({
            kind: "credit_pack",
            packId: "small",
            credits: String(pack.credits),
          }),
        })
      );
    });

    it("createCreditPackCheckout throws when priceId is missing", async () => {
      const { createCreditPackCheckout } = await import(
        "@/server/services/stripe.service"
      );
      await expect(
        createCreditPackCheckout({
          userId: "u1",
          email: "u@t.com",
          pack: { id: "small", credits: 100, priceEur: 9, priceId: null },
          successUrl: "https://s",
          cancelUrl: "https://c",
        })
      ).rejects.toThrow(/not configured/);
    });
  });
});
