import type Stripe from "stripe";

import { packById, planById, planFromPriceId } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import {
  stripeDisputeKey,
  stripeInvoiceGrantKey,
  stripePackGrantKey,
  stripeRefundKey,
} from "@/lib/credits";
import {
  applySubscriptionState,
  beginStripeEvent,
  clawbackCredits,
  clearSubscription,
  completeStripeEvent,
  findUserByStripeCustomer,
  getUserBilling,
  grantCredits,
  markSubscriptionPastDue,
  setStripeCustomer,
} from "@/lib/repositories/db/credits";

export const HANDLED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
] as const;

export type HandledStripeEvent = (typeof HANDLED_STRIPE_EVENTS)[number];

type SubLike = Stripe.Subscription & {
  current_period_end?: number;
  status?: string;
};

function periodEnd(sub: SubLike): Date | null {
  const raw = sub.current_period_end;
  return typeof raw === "number" ? new Date(raw * 1000) : null;
}

function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function resolveUserId(input: {
  metadataUserId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (input.metadataUserId) return input.metadataUserId;
  if (!input.customerId) return null;
  const user = await findUserByStripeCustomer(input.customerId);
  return user?.id ?? null;
}

function prorateCredits(refundedCents: number, fullCents: number, fullCredits: number): number {
  if (refundedCents <= 0 || fullCents <= 0 || fullCredits <= 0) return 0;
  return Math.max(1, Math.round((refundedCents / fullCents) * fullCredits));
}

async function grantPackFromSession(session: Stripe.Checkout.Session) {
  if (session.payment_status && session.payment_status !== "paid") return;
  const pack = session.metadata?.packId ? packById(session.metadata.packId) : null;
  if (!pack) {
    console.warn("[stripe-webhook] Pack inconnu:", session.metadata?.packId);
    return;
  }
  const userId = await resolveUserId({
    metadataUserId: session.metadata?.userId,
    customerId: asId(session.customer),
  });
  if (!userId) {
    console.warn("[stripe-webhook] Utilisateur introuvable pour pack", session.id);
    return;
  }
  await grantCredits({
    userId,
    delta: pack.credits,
    reason: "stripe_pack_grant",
    idempotencyKey: stripePackGrantKey(session.id),
    stripeRef: session.id,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const billingReason = invoice.billing_reason;
  if (
    billingReason !== "subscription_create" &&
    billingReason !== "subscription_cycle" &&
    billingReason !== "subscription_update"
  ) {
    return;
  }

  const subscriptionId = asId(
    (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }).subscription,
  );
  if (!subscriptionId || !invoice.id) return;

  const stripe = getStripe();
  const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as SubLike;
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return;

  const plan = planFromPriceId(priceId);
  if (!plan) {
    console.warn("[stripe-webhook] Prix inconnu sur facture:", priceId);
    return;
  }

  const userId = await resolveUserId({
    metadataUserId: subscription.metadata?.userId,
    customerId: asId(invoice.customer),
  });
  if (!userId) {
    console.warn("[stripe-webhook] Utilisateur introuvable pour invoice", invoice.id);
    return;
  }

  const billing = await getUserBilling(userId);
  const previousCredits = billing?.plan ? (planById(billing.plan)?.creditsPerMonth ?? 0) : 0;

  let delta = plan.creditsPerMonth;
  if (billingReason === "subscription_update") {
    delta = Math.max(0, plan.creditsPerMonth - previousCredits);
  }

  await applySubscriptionState({
    userId,
    plan: plan.id,
    subscriptionId,
    priceId,
    currentPeriodEnd: periodEnd(subscription),
    subscriptionStatus: subscription.status ?? "active",
    syncedAt: new Date(),
  });

  if (delta > 0) {
    await grantCredits({
      userId,
      delta,
      reason: "stripe_subscription_grant",
      idempotencyKey: stripeInvoiceGrantKey(invoice.id),
      stripeRef: invoice.id,
    });
  }
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const gate = await beginStripeEvent(event.id, event.type);
  if (gate !== "new") return;

  switch (event.type as HandledStripeEvent | string) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind === "credit_pack") {
        await grantPackFromSession(session);
        break;
      }
      if (session.mode === "subscription") {
        const userId = session.metadata?.userId;
        const customerId = asId(session.customer);
        if (userId && customerId) await setStripeCustomer(userId, customerId);
      }
      break;
    }

    case "invoice.paid": {
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const userId = await resolveUserId({ customerId: asId(invoice.customer) });
      if (userId) await markSubscriptionPastDue(userId);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as SubLike;
      const userId = await resolveUserId({
        metadataUserId: subscription.metadata?.userId,
        customerId: asId(subscription.customer),
      });
      const priceId = subscription.items.data[0]?.price?.id;
      if (!userId || !priceId) break;

      const billing = await getUserBilling(userId);
      const syncedAt = billing?.stripeSubscriptionSyncedAt?.getTime() ?? 0;
      if (event.created * 1000 < syncedAt) break;

      const plan = planFromPriceId(priceId);
      if (!plan) break;

      await applySubscriptionState({
        userId,
        plan: plan.id,
        subscriptionId: subscription.id,
        priceId,
        currentPeriodEnd: periodEnd(subscription),
        subscriptionStatus: subscription.status ?? "active",
        syncedAt: new Date(event.created * 1000),
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId({
        metadataUserId: subscription.metadata?.userId,
        customerId: asId(subscription.customer),
      });
      if (userId) await clearSubscription(userId);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const userId = await resolveUserId({ customerId: asId(charge.customer) });
      if (!userId) break;

      const pack = charge.metadata?.packId ? packById(charge.metadata.packId) : null;
      const fullCredits = pack?.credits ?? 0;
      const fullAmount = pack ? pack.priceEur * 100 : 0;
      for (const refund of charge.refunds?.data ?? []) {
        if (!refund.id || !pack) continue;
        const credits = prorateCredits(refund.amount ?? 0, fullAmount, fullCredits);
        if (credits <= 0) continue;
        await clawbackCredits({
          userId,
          delta: credits,
          reason: "stripe_refund_clawback",
          idempotencyKey: stripeRefundKey(refund.id),
          stripeRef: refund.id,
        });
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      let userId: string | null = dispute.metadata?.userId ?? null;
      if (!userId) {
        const chargeRef = dispute.charge;
        if (typeof chargeRef === "string") {
          const stripe = getStripe();
          const charge = await stripe.charges.retrieve(chargeRef);
          userId = await resolveUserId({ customerId: asId(charge.customer) });
        } else if (chargeRef && typeof chargeRef === "object") {
          userId = await resolveUserId({
            customerId: asId((chargeRef as Stripe.Charge).customer),
          });
        }
      }
      if (!userId) {
        console.warn("[stripe-webhook] Dispute sans utilisateur", dispute.id);
        break;
      }
      const resolvedUserId = userId;
      const pack = dispute.metadata?.packId ? packById(dispute.metadata.packId) : null;
      const credits = pack
        ? prorateCredits(dispute.amount ?? 0, pack.priceEur * 100, pack.credits)
        : 0;
      if (credits > 0) {
        await clawbackCredits({
          userId: resolvedUserId,
          delta: credits,
          reason: "stripe_dispute_clawback",
          idempotencyKey: stripeDisputeKey(dispute.id),
          stripeRef: dispute.id,
        });
      }
      console.error("[stripe-webhook] dispute", dispute.id, { userId: resolvedUserId, credits });
      break;
    }

    default:
      break;
  }

  await completeStripeEvent(event.id);
}
