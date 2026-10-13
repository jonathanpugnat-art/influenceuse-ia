import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import { handleStripeEvent } from "@/lib/billing/webhook-handlers";
import { setStripeForTests } from "@/lib/billing/stripe";
import { creditsLedger, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCreditBalance } from "@/lib/repositories/db/credits";
import {
  createTestDb,
  destroyTestDb,
  withCreditsEnforced,
  type TestDatabase,
} from "@/test/db";
import type { PGlite } from "@electric-sql/pglite";

function event<T extends string>(
  type: T,
  object: unknown,
  id = `evt_${type.replace(/\./g, "_")}_${Math.random().toString(36).slice(2, 8)}`,
  created = Math.floor(Date.now() / 1000),
): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: null,
    created,
    type,
    data: { object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

describe("stripe webhook handlers", () => {
  let client: PGlite;
  let db: TestDatabase;
  const retrieveSub = vi.fn();

  beforeEach(async () => {
    withCreditsEnforced(false);
    process.env.STRIPE_PRICE_STARTER = "price_starter";
    process.env.STRIPE_PRICE_CREATOR = "price_creator";
    process.env.STRIPE_PRICE_AGENCE = "price_agence";
    ({ client, db } = await createTestDb());
    await db.insert(users).values({
      id: "user_wh",
      email: "wh@ofmia.app",
      plan: "decouverte",
      stripeCustomerId: "cus_wh",
    });
    retrieveSub.mockReset();
    setStripeForTests({
      subscriptions: { retrieve: retrieveSub },
    } as never);
  });

  afterEach(async () => {
    setStripeForTests(null);
    await destroyTestDb(client);
  });

  it("invoice.paid rejoué 3 fois n'écrit qu'une fois", async () => {
    retrieveSub.mockResolvedValue({
      id: "sub_1",
      metadata: { userId: "user_wh" },
      status: "active",
      current_period_end: 1_800_000_000,
      items: { data: [{ price: { id: "price_starter" } }] },
      customer: "cus_wh",
    });

    const payload = event("invoice.paid", {
      id: "in_1",
      billing_reason: "subscription_create",
      customer: "cus_wh",
      subscription: "sub_1",
    });

    await handleStripeEvent(payload);
    await handleStripeEvent({ ...payload });
    await handleStripeEvent({ ...payload });

    expect(await getCreditBalance("user_wh")).toBe(500);
    const grants = await db
      .select()
      .from(creditsLedger)
      .where(eq(creditsLedger.reason, "stripe_subscription_grant"));
    expect(grants).toHaveLength(1);
  });

  it("checkout subscription n'inscrit aucun crédit", async () => {
    await handleStripeEvent(
      event("checkout.session.completed", {
        id: "cs_sub",
        mode: "subscription",
        customer: "cus_wh",
        metadata: { userId: "user_wh", kind: "subscription", plan: "starter" },
        payment_status: "paid",
      }),
    );
    expect(await getCreditBalance("user_wh")).toBe(0);
  });

  it("pack ignore packId inconnu et metadata.credits falsifiée", async () => {
    await handleStripeEvent(
      event("checkout.session.completed", {
        id: "cs_bad",
        mode: "payment",
        customer: "cus_wh",
        payment_status: "paid",
        metadata: {
          userId: "user_wh",
          kind: "credit_pack",
          packId: "unknown",
          credits: "9999",
        },
      }),
    );
    expect(await getCreditBalance("user_wh")).toBe(0);

    await handleStripeEvent(
      event("checkout.session.completed", {
        id: "cs_ok",
        mode: "payment",
        customer: "cus_wh",
        payment_status: "paid",
        metadata: { userId: "user_wh", kind: "credit_pack", packId: "small" },
      }),
    );
    expect(await getCreditBalance("user_wh")).toBe(100);
  });

  it("ignore subscription.updated plus ancien", async () => {
    const synced = new Date("2030-01-01T00:00:00Z");
    await db
      .update(users)
      .set({
        plan: "starter",
        stripePriceId: "price_starter",
        stripeSubscriptionId: "sub_1",
        stripeSubscriptionSyncedAt: synced,
        subscriptionStatus: "active",
      })
      .where(eq(users.id, "user_wh"));

    await handleStripeEvent(
      event(
        "customer.subscription.updated",
        {
          id: "sub_1",
          metadata: { userId: "user_wh" },
          customer: "cus_wh",
          status: "active",
          current_period_end: 1_800_000_000,
          items: { data: [{ price: { id: "price_creator" } }] },
        },
        "evt_old",
        Math.floor(new Date("2020-01-01T00:00:00Z").getTime() / 1000),
      ),
    );

    const billing = await db.select().from(users).where(eq(users.id, "user_wh"));
    expect(billing[0]?.plan).toBe("starter");
  });

  it("subscription.deleted passe en decouverte et conserve le solde", async () => {
    await db.insert(creditsLedger).values({
      userId: "user_wh",
      delta: 200,
      reason: "stripe_pack_grant",
      idempotencyKey: "stripe:pack:keep",
    });
    await db
      .update(users)
      .set({
        plan: "starter",
        stripeSubscriptionId: "sub_del",
        subscriptionStatus: "active",
      })
      .where(eq(users.id, "user_wh"));

    await handleStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_del",
        metadata: { userId: "user_wh" },
        customer: "cus_wh",
      }),
    );

    const billing = await db.select().from(users).where(eq(users.id, "user_wh"));
    expect(billing[0]?.plan).toBe("decouverte");
    expect(billing[0]?.subscriptionStatus).toBe("canceled");
    expect(await getCreditBalance("user_wh")).toBe(200);
  });

  it("utilisateur introuvable: no-op sans erreur", async () => {
    await handleStripeEvent(
      event("checkout.session.completed", {
        id: "cs_ghost",
        mode: "payment",
        customer: "cus_unknown",
        payment_status: "paid",
        metadata: { kind: "credit_pack", packId: "small" },
      }),
    );
    const rows = await db.select().from(creditsLedger);
    expect(rows.filter((r) => r.reason === "stripe_pack_grant")).toHaveLength(0);
  });
});
