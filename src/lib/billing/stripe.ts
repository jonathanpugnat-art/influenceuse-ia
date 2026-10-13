import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquant.");
  }
  client = new Stripe(key, {
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
  });
  return client;
}

export function setStripeForTests(instance: Stripe | null): void {
  client = instance;
}

export function appBaseUrl(): string {
  const fromEnv = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
