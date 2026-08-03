import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, getPlanFromPriceId } from "@/server/services/stripe.service";
import { db } from "@/server/db";

type Sub = Stripe.Subscription & { current_period_end: number };

/**
 * Referral: when a referred user pays for the first time, credit both the
 * referrer and the referred. The PENDING → REWARDED updateMany guard makes
 * this idempotent even across webhook retries. Best-effort — a failure here
 * must not fail the whole subscription webhook.
 */
async function rewardReferralOnFirstPayment(referredUserId: string): Promise<void> {
  try {
    const ref = await db.referral.findUnique({
      where: { referredId: referredUserId },
    });
    if (!ref || ref.status === "REWARDED") return;

    // Claim + both increments in ONE transaction: if the second increment
    // fails we must not leave a REWARDED referral with only half the
    // credits granted.
    const now = new Date();
    const rewarded = await db.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id: ref.id, status: { not: "REWARDED" } },
        data: { status: "REWARDED", convertedAt: now, rewardedAt: now },
      });
      if (claimed.count === 0) return false;

      // bonusCredits tracks non-plan grants so future plan changes
      // recompute creditsLimit without wiping the reward.
      await tx.user.update({
        where: { id: ref.referrerId },
        data: {
          creditsLimit: { increment: ref.rewardCredits },
          bonusCredits: { increment: ref.rewardCredits },
        },
      });
      await tx.user.update({
        where: { id: referredUserId },
        data: {
          creditsLimit: { increment: ref.rewardCredits },
          bonusCredits: { increment: ref.rewardCredits },
        },
      });
      return true;
    });
    if (rewarded) {
      console.log(
        `[stripe-webhook] Referral ${ref.id} rewarded (+${ref.rewardCredits} credits each)`
      );
    }
  } catch (error) {
    console.error("[stripe-webhook] Referral reward failed:", error);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

  // Idempotence: Stripe retries deliveries (network blips, prior 5xx). The
  // unique PK on event.id makes sure a retry never re-applies side effects
  // (double credit-pack increment, double plan flip).
  try {
    await db.processedWebhookEvent.create({
      data: { id: event.id, source: "stripe" },
    });
  } catch {
    console.log(`[stripe-webhook] Event ${event.id} already processed — skipping`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      // ──────────────────────────────────────
      // Checkout completed — new subscription
      // ──────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn("[stripe-webhook] Missing userId in checkout metadata");
          break;
        }

        // Sprint 7 — One-time credit pack purchase (mode=payment).
        if (session.metadata?.kind === "credit_pack") {
          const credits = Number(session.metadata.credits ?? 0);
          if (!Number.isFinite(credits) || credits <= 0) {
            console.warn("[stripe-webhook] Invalid credits amount in pack metadata");
            break;
          }
          await db.user.update({
            where: { id: userId },
            data: {
              creditsLimit: { increment: credits },
              bonusCredits: { increment: credits },
            },
          });
          console.log(
            `[stripe-webhook] User ${userId} bought credit pack +${credits} credits`
          );
          break;
        }

        // Subscription path (existing).
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.toString();

        if (!subscriptionId) {
          console.warn("[stripe-webhook] Missing subscriptionId in subscription checkout");
          break;
        }

        const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as Sub;
        const priceId = subscription.items.data[0]?.price?.id;
        const planInfo = priceId ? getPlanFromPriceId(priceId) : null;

        if (planInfo) {
          // Plan changes recompute the limit as plan + bonus (packs/referral)
          // instead of overwriting — purchased credits must survive.
          const existing = await db.user.findUnique({
            where: { id: userId },
            select: { bonusCredits: true },
          });
          await db.user.update({
            where: { id: userId },
            data: {
              plan: planInfo.plan as "PRO" | "ENTERPRISE",
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              creditsLimit: planInfo.creditsLimit + (existing?.bonusCredits ?? 0),
              creditsUsed: 0, // Reset credits on new subscription
            },
          });
          console.log(`[stripe-webhook] User ${userId} upgraded to ${planInfo.plan}`);

          // Referral program: first paid subscription of a referred user
          // rewards both parties. Status transition guards double rewards.
          await rewardReferralOnFirstPayment(userId);
        }
        break;
      }

      // ──────────────────────────────────────
      // Invoice paid — monthly renewal
      // ──────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as unknown as {
          subscription?: string | { id: string } | null;
          billing_reason?: string | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as { id: string } | null)?.id;

        if (!subscriptionId) break;

        // Only a real renewal resets the monthly quota. Proration / one-off
        // invoices (plan change mid-cycle, extra seat…) also emit
        // invoice.paid and must NOT refill the month. The first invoice
        // (subscription_create) is already handled by checkout.session.completed.
        if (invoice.billing_reason !== "subscription_cycle") {
          console.log(
            `[stripe-webhook] invoice.paid (${invoice.billing_reason ?? "unknown"}) — no credit reset`
          );
          break;
        }

        const user = await db.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (user) {
          const subscription = (await stripe.subscriptions.retrieve(
            subscriptionId
          )) as unknown as Sub;
          await db.user.update({
            where: { id: user.id },
            data: {
              creditsUsed: 0,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
          });
          console.log(`[stripe-webhook] Credits reset for user ${user.id} (renewal)`);
        }
        break;
      }

      // ──────────────────────────────────────
      // Subscription updated — plan change
      // ──────────────────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as unknown as Sub;
        const userId = subscription.metadata?.userId;
        const priceId = subscription.items.data[0]?.price?.id;

        if (!userId || !priceId) break;

        const planInfo = getPlanFromPriceId(priceId);
        if (planInfo) {
          const existing = await db.user.findUnique({
            where: { id: userId },
            select: { bonusCredits: true },
          });
          await db.user.update({
            where: { id: userId },
            data: {
              plan: planInfo.plan as "PRO" | "ENTERPRISE",
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              creditsLimit: planInfo.creditsLimit + (existing?.bonusCredits ?? 0),
            },
          });
          console.log(`[stripe-webhook] User ${userId} plan updated to ${planInfo.plan}`);
        }
        break;
      }

      // ──────────────────────────────────────
      // Subscription deleted — downgrade to FREE
      // ──────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        const user = userId
          ? await db.user.findUnique({ where: { id: userId } })
          : await db.user.findFirst({
              where: { stripeSubscriptionId: subscription.id },
            });
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: {
              plan: "FREE",
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
              // Purchased packs / referral rewards survive the downgrade.
              creditsLimit: 50 + user.bonusCredits,
            },
          });
          console.log(`[stripe-webhook] User ${user.id} downgraded to FREE`);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, error);
    // Release the idempotency claim so Stripe's retry can re-run the handler.
    await db.processedWebhookEvent
      .delete({ where: { id: event.id } })
      .catch(() => undefined);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
