import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { parseCheckoutBody } from "@/lib/billing/checkout-schema";
import {
  packById,
  planById,
  resolvePackPriceId,
  resolvePriceId,
} from "@/lib/billing/plans";
import { appBaseUrl, getStripe } from "@/lib/billing/stripe";
import { getEnv } from "@/lib/env";
import {
  ensureUser,
  getUserBilling,
  setStripeCustomer,
} from "@/lib/repositories/db/credits";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;
  await ensureUser(userId, { email });
  const billing = await getUserBilling(userId);
  if (billing?.stripeCustomerId) return billing.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create(
    {
      email: email ?? undefined,
      metadata: { userId },
    },
    { idempotencyKey: `customer:${userId}` },
  );
  return setStripeCustomer(userId, customer.id, email);
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.BILLING_ENABLED) {
    return NextResponse.json(
      { success: false, data: null, error: "Facturation désactivée." },
      { status: 404 },
    );
  }

  const userId = await requireUserId();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: "Requête illisible." },
      { status: 400 },
    );
  }

  const parsed = parseCheckoutBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, data: null, error: parsed.error },
      { status: 400 },
    );
  }

  const base = appBaseUrl();
  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(userId);
  const billing = await getUserBilling(userId);

  switch (parsed.value.kind) {
    case "subscription": {
      if (billing?.stripeSubscriptionId && billing.subscriptionStatus === "active") {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: "Abonnement déjà actif. Utilise le portail.",
            code: "use_portal",
          },
          { status: 409 },
        );
      }

      const plan = planById(parsed.value.plan)!;
      const priceId = resolvePriceId(plan);
      if (!priceId) {
        return NextResponse.json(
          { success: false, data: null, error: "Prix Stripe manquant pour ce plan." },
          { status: 503 },
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        locale: "fr",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${base}/facturation?checkout=success`,
        cancel_url: `${base}/facturation?checkout=cancel`,
        automatic_tax: { enabled: true },
        customer_update: { address: "auto" },
        metadata: { userId, kind: "subscription", plan: plan.id },
        subscription_data: {
          metadata: { userId, plan: plan.id },
        },
      });

      if (!session.url) {
        return NextResponse.json(
          { success: false, data: null, error: "Checkout Stripe indisponible." },
          { status: 502 },
        );
      }
      return NextResponse.json({ success: true, data: { url: session.url }, error: null });
    }

    case "pack": {
      const pack = packById(parsed.value.packId)!;
      const priceId = resolvePackPriceId(pack);
      if (!priceId) {
        return NextResponse.json(
          { success: false, data: null, error: "Prix Stripe manquant pour ce pack." },
          { status: 503 },
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        locale: "fr",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${base}/facturation?checkout=success&pack=${pack.id}`,
        cancel_url: `${base}/facturation?checkout=cancel`,
        automatic_tax: { enabled: true },
        customer_update: { address: "auto" },
        invoice_creation: { enabled: true },
        metadata: {
          userId,
          kind: "credit_pack",
          packId: pack.id,
        },
      });

      if (!session.url) {
        return NextResponse.json(
          { success: false, data: null, error: "Checkout Stripe indisponible." },
          { status: 502 },
        );
      }
      return NextResponse.json({ success: true, data: { url: session.url }, error: null });
    }

    default: {
      const _exhaustive: never = parsed.value;
      return NextResponse.json(
        { success: false, data: null, error: `Type inconnu: ${JSON.stringify(_exhaustive)}` },
        { status: 400 },
      );
    }
  }
}
