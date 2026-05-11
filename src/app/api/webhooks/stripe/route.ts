import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, getPlanFromPriceId } from "@/server/services/stripe.service";
import { db } from "@/server/db";

type Sub = Stripe.Subscription & { current_period_end: number };

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

  console.log(`[stripe-webhook] Received event: ${event.type}`);

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
            data: { creditsLimit: { increment: credits } },
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
          await db.user.update({
            where: { id: userId },
            data: {
              plan: planInfo.plan as "PRO" | "ENTERPRISE",
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              creditsLimit: planInfo.creditsLimit,
              creditsUsed: 0, // Reset credits on new subscription
            },
          });
          console.log(`[stripe-webhook] User ${userId} upgraded to ${planInfo.plan}`);
        }
        break;
      }

      // ──────────────────────────────────────
      // Invoice paid — monthly renewal
      // ──────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as unknown as { subscription?: string | { id: string } | null };
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as { id: string } | null)?.id;

        if (!subscriptionId) break;

        // Find user by subscriptionId
        const user = await db.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (user) {
          // Reset monthly credits
          await db.user.update({
            where: { id: user.id },
            data: { creditsUsed: 0 },
          });
          console.log(`[stripe-webhook] Credits reset for user ${user.id}`);
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
          await db.user.update({
            where: { id: userId },
            data: {
              plan: planInfo.plan as "PRO" | "ENTERPRISE",
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              creditsLimit: planInfo.creditsLimit,
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

        if (!userId) {
          // Try to find by subscriptionId
          const subId = subscription.id;
          const user = await db.user.findFirst({
            where: { stripeSubscriptionId: subId },
          });
          if (user) {
            await db.user.update({
              where: { id: user.id },
              data: {
                plan: "FREE",
                stripeSubscriptionId: null,
                stripePriceId: null,
                stripeCurrentPeriodEnd: null,
                creditsLimit: 50,
              },
            });
            console.log(`[stripe-webhook] User ${user.id} downgraded to FREE`);
          }
        } else {
          await db.user.update({
            where: { id: userId },
            data: {
              plan: "FREE",
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
              creditsLimit: 50,
            },
          });
          console.log(`[stripe-webhook] User ${userId} downgraded to FREE`);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
