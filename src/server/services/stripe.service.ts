import Stripe from "stripe";
import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Stripe Client (lazy singleton)
// ──────────────────────────────────────────────

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    // Version alignée sur le SDK stripe (types TypeScript). Voir https://docs.stripe.com/api/versioning
    _stripe = new Stripe(key, { apiVersion: "2026-01-28.clover" });
  }
  return _stripe;
}

/** Convenience accessor — lazy, safe for imports at module level */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getStripeClient(), prop);
  },
});

// ──────────────────────────────────────────────
// Customer Management
// ──────────────────────────────────────────────

/**
 * Create or retrieve a Stripe customer for a user.
 */
export async function createOrGetCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: name ?? undefined,
      metadata: { userId },
    });

    // Save to DB
    await db.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  } catch (error) {
    console.error("[stripe] createOrGetCustomer error:", error);
    throw new Error("Failed to create or get Stripe customer");
  }
}

// ──────────────────────────────────────────────
// Checkout & Portal
// ──────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for subscribing to a plan.
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  name: string | null,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  try {
    const customerId = await createOrGetCustomer(userId, email, name);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return session.url;
  } catch (error) {
    console.error("[stripe] createCheckoutSession error:", error);
    throw new Error("Failed to create checkout session");
  }
}

/**
 * Create a Stripe Customer Portal session.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (error) {
    console.error("[stripe] createPortalSession error:", error);
    throw new Error("Failed to create portal session");
  }
}

// ──────────────────────────────────────────────
// Subscription & Invoices
// ──────────────────────────────────────────────

/**
 * Get subscription details.
 */
export async function getSubscription(
  subscriptionId: string
): Promise<(Stripe.Subscription & { current_period_end: number }) | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub as unknown as Stripe.Subscription & { current_period_end: number };
  } catch (error) {
    console.error("[stripe] getSubscription error:", error);
    return null;
  }
}

/**
 * Get customer invoices.
 */
export async function getInvoices(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data;
  } catch (error) {
    console.error("[stripe] getInvoices error:", error);
    return [];
  }
}

// ──────────────────────────────────────────────
// Plan helpers
// ──────────────────────────────────────────────

const PRICE_TO_PLAN: Record<string, { plan: string; creditsLimit: number }> = {
  [process.env.STRIPE_PRO_PRICE_ID ?? "price_pro"]: {
    plan: "PRO",
    creditsLimit: 500,
  },
  [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "price_enterprise"]: {
    plan: "ENTERPRISE",
    creditsLimit: 999999,
  },
};

/**
 * Map a Stripe priceId to our plan config.
 */
export function getPlanFromPriceId(priceId: string) {
  return PRICE_TO_PLAN[priceId] ?? null;
}
