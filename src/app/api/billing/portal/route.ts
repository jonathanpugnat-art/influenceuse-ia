import { NextResponse } from "next/server";

import { appBaseUrl, getStripe } from "@/lib/billing/stripe";
import { getEnv } from "@/lib/env";
import { ensureUser, getUserBilling } from "@/lib/repositories/db/credits";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const env = getEnv();
  if (!env.BILLING_ENABLED) {
    return NextResponse.json(
      { success: false, data: null, error: "Facturation désactivée." },
      { status: 404 },
    );
  }

  const userId = await requireUserId();
  await ensureUser(userId);
  const billing = await getUserBilling(userId);
  if (!billing?.stripeCustomerId) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: "Aucun client Stripe. Souscris d’abord à un plan.",
      },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const configId = env.STRIPE_PORTAL_CONFIG_ID;
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${appBaseUrl()}/facturation`,
    ...(configId ? { configuration: configId } : {}),
  });

  return NextResponse.json({
    success: true,
    data: { url: session.url },
    error: null,
  });
}
