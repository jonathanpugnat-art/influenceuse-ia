import { and, eq, sql } from "drizzle-orm";

import type { CreditReason } from "@/lib/credits";
import { getDb } from "@/lib/db/client";
import { creditsLedger, stripeEvents, users } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import type { PlanId } from "@/lib/billing/plans";

export async function ensureUser(
  userId: string,
  opts?: { email?: string | null },
): Promise<void> {
  const db = getDb();
  const env = getEnv();
  await db
    .insert(users)
    .values({
      id: userId,
      email: opts?.email ?? null,
    })
    .onConflictDoNothing();

  if (opts?.email) {
    await db
      .update(users)
      .set({ email: opts.email })
      .where(eq(users.id, userId));
  }

  await db
    .insert(creditsLedger)
    .values({
      userId,
      delta: env.INITIAL_CREDITS,
      reason: "grant",
      idempotencyKey: `grant:signup:${userId}`,
    })
    .onConflictDoNothing();
}

export async function getCreditBalance(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      balance: sql<number>`coalesce(sum(${creditsLedger.delta}), 0)`,
    })
    .from(creditsLedger)
    .where(eq(creditsLedger.userId, userId));
  return Number(rows[0]?.balance ?? 0);
}

export async function getUserBilling(userId: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByStripeCustomer(customerId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function grantCredits(input: {
  userId: string;
  delta: number;
  reason: Extract<
    CreditReason,
    | "grant"
    | "adjustment"
    | "stripe_subscription_grant"
    | "stripe_pack_grant"
  >;
  idempotencyKey: string;
  stripeRef?: string | null;
}): Promise<{ granted: boolean; balance: number }> {
  if (!Number.isFinite(input.delta) || input.delta <= 0) {
    throw new Error("delta de crédit invalide");
  }
  const db = getDb();
  await ensureUser(input.userId);
  const inserted = await db
    .insert(creditsLedger)
    .values({
      userId: input.userId,
      delta: Math.trunc(input.delta),
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      stripeRef: input.stripeRef ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: creditsLedger.id });
  return {
    granted: inserted.length > 0,
    balance: await getCreditBalance(input.userId),
  };
}

export async function clawbackCredits(input: {
  userId: string;
  delta: number;
  reason: Extract<CreditReason, "stripe_refund_clawback" | "stripe_dispute_clawback">;
  idempotencyKey: string;
  stripeRef?: string | null;
}): Promise<{ applied: boolean; balance: number }> {
  if (!Number.isFinite(input.delta) || input.delta <= 0) {
    throw new Error("delta de clawback invalide");
  }
  const db = getDb();
  await ensureUser(input.userId);
  const inserted = await db
    .insert(creditsLedger)
    .values({
      userId: input.userId,
      delta: -Math.trunc(input.delta),
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      stripeRef: input.stripeRef ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: creditsLedger.id });
  return {
    applied: inserted.length > 0,
    balance: await getCreditBalance(input.userId),
  };
}

export async function setStripeCustomer(userId: string, customerId: string, email?: string | null) {
  const db = getDb();
  await ensureUser(userId, { email });
  const claimed = await db
    .update(users)
    .set({
      stripeCustomerId: customerId,
      ...(email ? { email } : {}),
    })
    .where(and(eq(users.id, userId), sql`${users.stripeCustomerId} is null`))
    .returning({ stripeCustomerId: users.stripeCustomerId });

  if (claimed[0]?.stripeCustomerId) {
    return claimed[0].stripeCustomerId;
  }

  const existing = await getUserBilling(userId);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  await db
    .update(users)
    .set({
      stripeCustomerId: customerId,
      ...(email ? { email } : {}),
    })
    .where(eq(users.id, userId));
  return customerId;
}

export async function applySubscriptionState(input: {
  userId: string;
  plan: PlanId;
  subscriptionId: string;
  priceId: string;
  currentPeriodEnd: Date | null;
  subscriptionStatus?: string | null;
  syncedAt?: Date | null;
}) {
  const db = getDb();
  await ensureUser(input.userId);
  await db
    .update(users)
    .set({
      plan: input.plan,
      stripeSubscriptionId: input.subscriptionId,
      stripePriceId: input.priceId,
      stripeCurrentPeriodEnd: input.currentPeriodEnd,
      ...(input.subscriptionStatus !== undefined
        ? { subscriptionStatus: input.subscriptionStatus }
        : { subscriptionStatus: "active" }),
      ...(input.syncedAt ? { stripeSubscriptionSyncedAt: input.syncedAt } : {}),
    })
    .where(eq(users.id, input.userId));
}

export async function markSubscriptionPastDue(userId: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ subscriptionStatus: "past_due" })
    .where(eq(users.id, userId));
}

export async function clearSubscription(userId: string) {
  const db = getDb();
  await db
    .update(users)
    .set({
      plan: "decouverte",
      subscriptionStatus: "canceled",
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    })
    .where(eq(users.id, userId));
}

export async function beginStripeEvent(eventId: string, type: string): Promise<"new" | "done" | "pending"> {
  const db = getDb();
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: eventId, type })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });

  if (inserted.length > 0) return "new";

  const existing = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.id, eventId))
    .limit(1);
  if (existing[0]?.processedAt) return "done";
  return "pending";
}

export async function completeStripeEvent(eventId: string): Promise<void> {
  const db = getDb();
  await db
    .update(stripeEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeEvents.id, eventId));
}
