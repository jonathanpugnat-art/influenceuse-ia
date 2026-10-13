import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  requireUserId: vi.fn(async () => "user_checkout"),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(async () => ({
    primaryEmailAddress: { emailAddress: "test@ofmia.app" },
    emailAddresses: [],
  })),
}));

import { POST } from "@/app/api/billing/checkout/route";
import { setStripeForTests } from "@/lib/billing/stripe";
import { resetEnvCache } from "@/lib/env";
import { users } from "@/lib/db/schema";
import {
  createTestDb,
  destroyTestDb,
  withCreditsEnforced,
  type TestDatabase,
} from "@/test/db";
import type { PGlite } from "@electric-sql/pglite";

describe("POST /api/billing/checkout", () => {
  let client: PGlite;
  let db: TestDatabase;
  const createSession = vi.fn();
  const createCustomer = vi.fn();

  beforeEach(async () => {
    withCreditsEnforced(false);
    process.env.BILLING_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PRICE_STARTER = "price_starter";
    process.env.STRIPE_PRICE_CREATOR = "price_creator";
    process.env.STRIPE_PRICE_AGENCE = "price_agence";
    process.env.STRIPE_PRICE_PACK_SMALL = "price_pack_small";
    resetEnvCache();

    ({ client, db } = await createTestDb());
    await db.insert(users).values({
      id: "user_checkout",
      email: "test@ofmia.app",
      plan: "decouverte",
    });

    createSession.mockReset();
    createCustomer.mockReset();
    createCustomer.mockResolvedValue({ id: "cus_1" });
    createSession.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.test/cs_1",
    });

    setStripeForTests({
      customers: { create: createCustomer },
      checkout: { sessions: { create: createSession } },
    } as never);
  });

  afterEach(async () => {
    setStripeForTests(null);
    process.env.BILLING_ENABLED = "false";
    resetEnvCache();
    await destroyTestDb(client);
  });

  it("renvoie 400 pour un plan invalide", async () => {
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "subscription", plan: "decouverte" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("renvoie 503 si le prix Stripe manque", async () => {
    delete process.env.STRIPE_PRICE_CREATOR;
    delete process.env.STRIPE_PRO_PRICE_ID;
    resetEnvCache();
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "subscription", plan: "creator" }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("crée une session subscription avec metadata et locale fr", async () => {
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "subscription", plan: "starter" }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.url).toContain("checkout.stripe.test");
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        locale: "fr",
        line_items: [{ price: "price_starter", quantity: 1 }],
        metadata: expect.objectContaining({
          userId: "user_checkout",
          kind: "subscription",
          plan: "starter",
        }),
      }),
    );
  });

  it("crée une session pack via Price ID", async () => {
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "pack", packId: "small" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [{ price: "price_pack_small", quantity: 1 }],
        invoice_creation: { enabled: true },
        metadata: expect.objectContaining({
          kind: "credit_pack",
          packId: "small",
        }),
      }),
    );
  });

  it("renvoie 409 use_portal si abonnement actif", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(users)
      .set({
        stripeCustomerId: "cus_existing",
        stripeSubscriptionId: "sub_1",
        subscriptionStatus: "active",
      })
      .where(eq(users.id, "user_checkout"));

    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "subscription", plan: "starter" }),
      }),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("use_portal");
    expect(createSession).not.toHaveBeenCalled();
  });
});
