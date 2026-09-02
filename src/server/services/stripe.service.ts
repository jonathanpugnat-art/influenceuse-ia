import Stripe from "stripe";
import { db } from "@/server/db";
import { CREDIT_PACK_CATALOG, PLANS } from "@/lib/constants";

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

// Map every paid Stripe Price ID to its internal plan + monthly credit
// allowance. We pull credit numbers from `PLANS` so a single source of
// truth (constants.ts) drives both the UI and what we provision after a
// successful Stripe checkout / subscription update.
//
// `Infinity` is not safe to persist in Postgres, so the ENTERPRISE plan
// (which is "unlimited" in marketing terms) is materialised as a large
// finite number that nobody will ever hit organically.
const ENTERPRISE_CREDITS_CAP = 999_999;
const safeCredits = (n: number): number =>
  Number.isFinite(n) ? n : ENTERPRISE_CREDITS_CAP;

const PRICE_TO_PLAN: Record<string, { plan: string; creditsLimit: number }> = {
  [process.env.STRIPE_STARTER_PRICE_ID ?? "price_starter"]: {
    plan: "STARTER",
    creditsLimit: safeCredits(PLANS.STARTER.credits),
  },
  [process.env.STRIPE_PRO_PRICE_ID ?? "price_pro"]: {
    plan: "PRO",
    creditsLimit: safeCredits(PLANS.PRO.credits),
  },
  [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "price_enterprise"]: {
    plan: "ENTERPRISE",
    creditsLimit: safeCredits(PLANS.ENTERPRISE.credits),
  },
};

/**
 * Map a Stripe priceId to our plan config.
 */
export function getPlanFromPriceId(priceId: string) {
  return PRICE_TO_PLAN[priceId] ?? null;
}

// ──────────────────────────────────────────────
// Credit packs (Sprint 7 — add-ons)
//
// One-time purchases that top up the user's `creditsLimit` without changing
// their subscription tier. Configured via STRIPE_CREDIT_PACK_<ID>_PRICE_ID
// env vars + a fixed `credits` amount per pack.
// ──────────────────────────────────────────────

export interface CreditPack {
  id: "small" | "medium" | "large";
  /** Number of credits added to `creditsLimit` once payment succeeds. */
  credits: number;
  /** Display price for UI (Stripe is the source of truth at checkout). */
  priceEur: number;
  /** Stripe Price id; null when not configured for this env. */
  priceId: string | null;
}

const CREDIT_PACK_PRICE_ENV: Record<(typeof CREDIT_PACK_CATALOG)[number]["id"], string | undefined> =
  {
    small: process.env.STRIPE_CREDIT_PACK_SMALL_PRICE_ID,
    medium: process.env.STRIPE_CREDIT_PACK_MEDIUM_PRICE_ID,
    large: process.env.STRIPE_CREDIT_PACK_LARGE_PRICE_ID,
  };

export const CREDIT_PACKS: CreditPack[] = CREDIT_PACK_CATALOG.map((pack) => ({
  id: pack.id,
  credits: pack.credits,
  priceEur: pack.priceEur,
  priceId: CREDIT_PACK_PRICE_ENV[pack.id] ?? null,
}));

export function getCreditPack(id: CreditPack["id"]): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

/**
 * Maps a Stripe priceId to its credit pack. Used by the webhook handler
 * to know how many credits to grant on `checkout.session.completed`.
 */
export function getCreditPackFromPriceId(priceId: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.priceId && p.priceId === priceId) ?? null;
}

/**
 * One-time payment Checkout for buying a credit pack. Payload metadata is
 * read by the webhook handler so we can credit the right user.
 */
export async function createCreditPackCheckout(opts: {
  userId: string;
  email: string;
  name?: string | null;
  pack: CreditPack;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  if (!opts.pack.priceId) {
    throw new Error(`Credit pack "${opts.pack.id}" is not configured (missing STRIPE_CREDIT_PACK_${opts.pack.id.toUpperCase()}_PRICE_ID)`);
  }
  const customerId = await createOrGetCustomer(opts.userId, opts.email, opts.name);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: opts.pack.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      userId: opts.userId,
      kind: "credit_pack",
      packId: opts.pack.id,
      credits: String(opts.pack.credits),
    },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}
