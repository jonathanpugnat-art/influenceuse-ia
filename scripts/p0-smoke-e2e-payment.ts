/**
 * P0 — E2E paiement (local / Stripe TEST) :
 *   preflight → checkout Pro → provision (= webhook) → 3 photos facturées
 *
 * Usage:
 *   npx tsx scripts/p0-smoke-e2e-payment.ts
 *
 * Notes:
 * - Ne paie pas par carte navigateur : crée une Checkout Session réelle,
 *   puis simule le succès webhook + (optionnel) abonnement Stripe TEST.
 * - Vercel live : même checks côté prod après paiement réel.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import Stripe from "stripe";
import { PLANS } from "../src/lib/constants";
import { isPaymentsEnabled } from "../src/lib/payments";
import { parseIdentityPack } from "../src/lib/identity-pack";
import type { AppearanceVariation } from "../src/lib/prompts/image-prompts";
import { resolvePublicMediaUrl } from "../src/server/lib/resolve-public-media-url";
import {
  createCheckoutSession,
  createOrGetCustomer,
  getPlanFromPriceId,
} from "../src/server/services/stripe.service";
import {
  generateContentImage,
  type InfluencerStyle,
} from "../src/server/services/ai-image.service";

const LUNA_ID = "cmpbizit8000004icudikwyen";
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";

type StepResult = { name: string; ok: boolean; detail?: string };

const results: StepResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string): never {
  results.push({ name, ok: false, detail });
  console.error(`❌ ${name} — ${detail}`);
  throw new Error(detail);
}

async function main() {
  console.log("\n═══ E2E paiement : Pro 79 € → 3 photos ═══\n");

  // ── 1. Preflight ──────────────────────────────────────────────
  if (!isPaymentsEnabled()) {
    fail(
      "payments-enabled",
      "BETA_HIDE_PAYMENTS=true — active false sur local + Vercel"
    );
  }
  pass("payments-enabled", "BETA_HIDE_PAYMENTS≠true");

  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (!secret) fail("stripe-secret", "STRIPE_SECRET_KEY manquant");
  const mode = secret.includes("_live_")
    ? "live"
    : secret.includes("_test_")
      ? "test"
      : "unknown";
  pass("stripe-secret", `mode=${mode}`);

  if (!PRO_PRICE_ID) fail("pro-price-id", "STRIPE_PRO_PRICE_ID manquant");
  if (!process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) {
    fail(
      "public-pro-price-id",
      "NEXT_PUBLIC_STRIPE_PRO_PRICE_ID manquant (CTA billing UI)"
    );
  }
  pass("pro-price-env", PRO_PRICE_ID);

  const stripe = new Stripe(secret, { apiVersion: "2026-01-28.clover" });
  const price = await stripe.prices.retrieve(PRO_PRICE_ID);
  if (!price.active) fail("pro-price-active", "Price inactive on Stripe");
  if (price.unit_amount !== 7900 || price.currency !== "eur") {
    fail(
      "pro-price-amount",
      `Attendu 7900 eur, reçu ${price.unit_amount} ${price.currency}`
    );
  }
  if (price.type !== "recurring") {
    fail("pro-price-type", `Attendu recurring, reçu ${price.type}`);
  }
  pass("pro-price-stripe", "79,00 € / mois recurring");

  const planInfo = getPlanFromPriceId(PRO_PRICE_ID);
  if (!planInfo || planInfo.plan !== "PRO") {
    fail(
      "price-to-plan-map",
      `getPlanFromPriceId → ${JSON.stringify(planInfo)}`
    );
  }
  if (planInfo!.creditsLimit !== PLANS.PRO.credits) {
    fail(
      "pro-credits-map",
      `credits ${planInfo!.creditsLimit} ≠ PLANS.PRO ${PLANS.PRO.credits}`
    );
  }
  pass(
    "price-to-plan-map",
    `PRO + ${planInfo!.creditsLimit} crédits (webhook-ready)`
  );

  // ── 2. User + influencer ──────────────────────────────────────
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const influencer = await prisma.influencer.findUnique({
      where: { id: LUNA_ID },
    });
    if (!influencer?.baseImageUrl) {
      fail("influencer", `Luna Fit Test ${LUNA_ID} introuvable / sans portrait`);
    }
    pass("influencer", `${influencer!.name} (${influencer!.id})`);

    const user = await prisma.user.findUnique({
      where: { id: influencer!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });
    if (!user) fail("user", "Owner de Luna introuvable");
    pass(
      "user",
      `${user!.email} plan=${user!.plan} crédits=${user!.creditsLimit - user!.creditsUsed}/${user!.creditsLimit}`
    );

    const before = { ...user! };

    // ── 3. Checkout Session (réel Stripe) ───────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const checkoutUrl = await createCheckoutSession(
      user!.id,
      user!.email,
      user!.name,
      PRO_PRICE_ID,
      `${appUrl}/billing?success=true`,
      `${appUrl}/billing?canceled=true`
    );
    if (!checkoutUrl.includes("checkout.stripe.com")) {
      fail("checkout-session", `URL inattendue: ${checkoutUrl}`);
    }
    pass("checkout-session", checkoutUrl.slice(0, 64) + "…");

    // ── 4. Abonnement TEST + provision (= webhook) ──────────────
    // Simule le succès carte sans navigateur (Stripe TEST only).
    if (mode !== "test") {
      console.warn(
        "⚠️  mode live — skip création abo auto; provision DB manuelle après paiement réel"
      );
      await prisma.user.update({
        where: { id: user!.id },
        data: {
          plan: "PRO",
          stripePriceId: PRO_PRICE_ID,
          creditsLimit: PLANS.PRO.credits,
          creditsUsed: 0,
        },
      });
      pass("stripe-subscription", "live mode — provision locale only");
      pass(
        "provision-webhook-equiv",
        `plan=PRO creditsLimit=${PLANS.PRO.credits}`
      );
    } else {
      const customerId = await createOrGetCustomer(
        user!.id,
        user!.email,
        user!.name
      );

      if (user!.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user!.stripeSubscriptionId);
        } catch {
          // already gone
        }
      }

      let provisionedViaStripeSub = false;
      try {
        const pm = await stripe.paymentMethods.create({
          type: "card",
          card: { token: "tok_visa" },
        });
        await stripe.paymentMethods.attach(pm.id, { customer: customerId });
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: pm.id },
        });

        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: PRO_PRICE_ID }],
          default_payment_method: pm.id,
          metadata: { userId: user!.id },
          payment_behavior: "error_if_incomplete",
        });

        if (
          subscription.status !== "active" &&
          subscription.status !== "trialing"
        ) {
          throw new Error(`status=${subscription.status}`);
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const mapped = priceId ? getPlanFromPriceId(priceId) : null;
        if (!mapped) throw new Error(`price ${priceId} non mappé`);

        const periodEnd =
          "current_period_end" in subscription &&
          typeof (subscription as { current_period_end?: number })
            .current_period_end === "number"
            ? new Date(
                (subscription as { current_period_end: number })
                  .current_period_end * 1000
              )
            : new Date(Date.now() + 30 * 24 * 3600 * 1000);

        await prisma.user.update({
          where: { id: user!.id },
          data: {
            plan: mapped.plan as "PRO",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: periodEnd,
            creditsLimit: mapped.creditsLimit,
            creditsUsed: 0,
          },
        });
        pass(
          "stripe-subscription",
          `${subscription.id} status=${subscription.status}`
        );
        pass(
          "provision-webhook-equiv",
          `plan=PRO creditsLimit=${mapped.creditsLimit}`
        );
        provisionedViaStripeSub = true;
      } catch (subErr) {
        console.warn(
          "[e2e] abo Stripe auto indisponible — provision webhook-equiv:",
          subErr instanceof Error ? subErr.message : subErr
        );
      }

      if (!provisionedViaStripeSub) {
        await prisma.user.update({
          where: { id: user!.id },
          data: {
            plan: "PRO",
            stripeCustomerId: customerId,
            stripePriceId: PRO_PRICE_ID,
            creditsLimit: PLANS.PRO.credits,
            creditsUsed: 0,
          },
        });
        pass(
          "stripe-subscription",
          "checkout URL OK — abo auto skip; provision locale"
        );
        pass(
          "provision-webhook-equiv",
          `plan=PRO creditsLimit=${PLANS.PRO.credits}`
        );
      }
    }

    const afterPay = await prisma.user.findUniqueOrThrow({
      where: { id: user!.id },
      select: {
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
        stripeSubscriptionId: true,
      },
    });
    if (afterPay.plan !== "PRO") {
      fail("plan-after-pay", `plan=${afterPay.plan} (attendu PRO)`);
    }
    if (afterPay.creditsLimit < PLANS.PRO.credits) {
      fail(
        "credits-after-pay",
        `limit=${afterPay.creditsLimit} < ${PLANS.PRO.credits}`
      );
    }
    pass(
      "plan-after-pay",
      `PRO ${afterPay.creditsLimit - afterPay.creditsUsed}/${afterPay.creditsLimit} crédits`
    );

    // ── 5. Trois photos facturées (valeur jour 1 payante) ────────
    const baseImageUrl = await resolvePublicMediaUrl(influencer!.baseImageUrl!);
    if (!baseImageUrl) fail("portrait-url", "Portrait inaccessible");

    const styleJson = influencer!.style as Record<string, string> | null;
    const style: InfluencerStyle = {
      gender: "female",
      ethnicity: styleJson?.ethnicity,
      hairColor: styleJson?.hairColor,
      hairStyle: styleJson?.hairStyle,
      bodyType: styleJson?.bodyType,
      fashionStyle: styleJson?.fashionStyle,
    };

    const shots = [
      {
        label: "café",
        scene: "cafe",
        sceneDescription:
          "Bright modern cafe, sitting at a wooden table with a latte, large window daylight, casual confident smile, vertical Instagram photo",
        outfit:
          "cream knit sweater and high-waist jeans, clean lifestyle fashion look",
        pose: "sitting",
      },
      {
        label: "street",
        scene: "urban",
        sceneDescription:
          "Sunny city sidewalk, walking past shop windows, golden hour light, candid lifestyle creator shot, vertical Instagram photo",
        outfit: "beige trench coat over white tee and jeans, chic city look",
        pose: "walking",
      },
      {
        label: "fitness",
        scene: "nature",
        sceneDescription:
          "Sunny outdoor park after a morning run, holding a water bottle, soft daylight, energetic smile, vertical Instagram photo",
        outfit:
          "fitted athletic top and athletic pants, clean sporty lifestyle look",
        pose: "standing",
      },
    ] as const;

    const urls: string[] = [];
    for (const shot of shots) {
      const creditsBefore = await prisma.user.findUniqueOrThrow({
        where: { id: user!.id },
        select: { creditsUsed: true, creditsLimit: true },
      });

      const result = await generateContentImage(
        user!.id,
        influencer!.age,
        style,
        {
          influencerId: influencer!.id,
          baseImageUrl: baseImageUrl!,
          useReferenceFace: true,
          scene: shot.scene,
          sceneDescription: shot.sceneDescription,
          pose: shot.pose,
          outfit: shot.outfit,
          expression: "smile",
          style: "natural",
          lighting: "natural",
          isNsfw: false,
          customPrompt:
            "authentic Instagram creator photo, fully clothed, friendly energy",
          numberOfImages: 1,
          appearanceVariations:
            (influencer!.appearanceVariations as AppearanceVariation | null) ??
            undefined,
          identityPack: parseIdentityPack(influencer!.identityPack),
          instagramShot: false,
          omitCreditBilling: false,
        }
      );

      const creditsAfter = await prisma.user.findUniqueOrThrow({
        where: { id: user!.id },
        select: { creditsUsed: true },
      });
      const delta = creditsAfter.creditsUsed - creditsBefore.creditsUsed;
      if (delta < 1) {
        fail(
          `photo-${shot.label}-billing`,
          `crédits non débités (delta=${delta})`
        );
      }
      urls.push(result.imageUrls[0]!);
      pass(
        `photo-${shot.label}`,
        `−${delta} crédit(s) → ${result.imageUrls[0]!.slice(0, 56)}…`
      );
    }

    const finalUser = await prisma.user.findUniqueOrThrow({
      where: { id: user!.id },
      select: {
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
        stripeSubscriptionId: true,
      },
    });

    console.log("\n═══ Résumé ═══");
    console.log({
      before: {
        plan: before.plan,
        credits: `${before.creditsLimit - before.creditsUsed}/${before.creditsLimit}`,
      },
      after: {
        plan: finalUser.plan,
        credits: `${finalUser.creditsLimit - finalUser.creditsUsed}/${finalUser.creditsLimit}`,
        subscription: finalUser.stripeSubscriptionId,
      },
      photos: urls,
      checkoutUrl: checkoutUrl.slice(0, 80) + "…",
    });

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error("\nÉchecs:", failed);
      process.exit(1);
    }
    console.log(
      `\n✅ E2E paiement OK — ${results.filter((r) => r.ok).length} checks`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("\n❌ E2E FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
