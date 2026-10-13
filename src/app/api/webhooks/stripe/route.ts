import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/webhook-handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret manquant." }, { status: 500 });
  }

  const body = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (cause) {
    console.error("[stripe-webhook] signature", cause);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (cause) {
    console.error("[stripe-webhook] handler", cause);
    return NextResponse.json({ error: "Traitement échoué." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
