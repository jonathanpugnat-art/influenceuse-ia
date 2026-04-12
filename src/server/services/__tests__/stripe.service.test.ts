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
    it("returns plan config for known PRO price id", async () => {
      const { getPlanFromPriceId } = await import("@/server/services/stripe.service");
      const proPriceId = process.env.STRIPE_PRO_PRICE_ID ?? "price_pro";
      const plan = getPlanFromPriceId(proPriceId);
      expect(plan).toEqual({ plan: "PRO", creditsLimit: 500 });
    });

    it("returns plan config for known ENTERPRISE price id", async () => {
      const { getPlanFromPriceId } = await import("@/server/services/stripe.service");
      const entPriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "price_enterprise";
      const plan = getPlanFromPriceId(entPriceId);
      expect(plan).toEqual({ plan: "ENTERPRISE", creditsLimit: 999999 });
    });

    it("returns null for unknown price id", async () => {
      const { getPlanFromPriceId } = await import("@/server/services/stripe.service");
      const plan = getPlanFromPriceId("price_unknown");
      expect(plan).toBeNull();
    });
  });
});
