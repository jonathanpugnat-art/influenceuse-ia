import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { PLANS } from "@/lib/constants";
import {
  createCheckoutSession,
  createPortalSession,
  getInvoices as getStripeInvoices,
  getSubscription,
  createCreditPackCheckout,
  getCreditPack,
  CREDIT_PACKS,
} from "@/server/services/stripe.service";
import type { Plan } from "@/generated/prisma/client";

import { getDbUser } from "@/server/helpers/get-db-user";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const billingRouter = createTRPCRouter({
  /**
   * getCurrentPlan — Returns user plan, credits, renewal date
   */
  getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);
    const planConfig = PLANS[user.plan as Plan];

    let renewalDate: string | null = null;
    if (user.stripeSubscriptionId) {
      try {
        const sub = await getSubscription(user.stripeSubscriptionId);
        if (sub?.current_period_end) {
          renewalDate = new Date(sub.current_period_end * 1000).toISOString();
        }
      } catch {
        // Stripe not configured — ignore
      }
    }

    return {
      plan: user.plan,
      planName: planConfig.name,
      price: planConfig.price,
      creditsUsed: user.creditsUsed,
      creditsLimit: user.creditsLimit,
      creditsRemaining: Math.max(0, user.creditsLimit - user.creditsUsed),
      renewalDate,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      features: {
        maxInfluencers: planConfig.maxInfluencers,
        hasVideo: planConfig.hasVideo,
        hasNsfw: planConfig.hasNsfw,
        hasAutoPublish: planConfig.hasAutoPublish,
        hasAdvancedAnalytics: planConfig.hasAdvancedAnalytics,
        hasContentPlan: "hasContentPlan" in planConfig ? planConfig.hasContentPlan : false,
        hasBatchGeneration:
          "hasBatchGeneration" in planConfig ? planConfig.hasBatchGeneration : false,
        hasWebhooks: "hasWebhooks" in planConfig ? planConfig.hasWebhooks : false,
      },
    };
  }),

  /**
   * createCheckoutSession — Returns Stripe Checkout URL
   */
  createCheckoutSession: protectedProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const url = await createCheckoutSession(
        user.id,
        user.email,
        user.name,
        input.priceId,
        `${appUrl}/billing?success=true`,
        `${appUrl}/billing?canceled=true`
      );

      return { url };
    }),

  /**
   * createPortalSession — Returns Stripe Portal URL
   */
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    if (!user.stripeCustomerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucun compte Stripe associé.",
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = await createPortalSession(user.stripeCustomerId, `${appUrl}/billing`);

    return { url };
  }),

  /**
   * getUsage — Credit usage breakdown
   */
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    // Get generation jobs for breakdown
    const jobs = await db.generationJob.groupBy({
      by: ["type"],
      where: { userId: user.id },
      _sum: { creditsUsed: true },
    });

    const breakdown: Record<string, number> = {};
    for (const job of jobs) {
      breakdown[job.type] = job._sum.creditsUsed ?? 0;
    }

    const used = user.creditsUsed;
    const limit = user.creditsLimit;
    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentage: Math.min(percentage, 100),
      breakdown: {
        photos: breakdown["IMAGE"] ?? 0,
        reels: breakdown["VIDEO"] ?? 0,
        captions: (breakdown["CAPTION"] ?? 0) + (breakdown["HASHTAGS"] ?? 0),
        baseImages: breakdown["BASE_IMAGE"] ?? 0,
      },
    };
  }),

  /**
   * getInvoices — Stripe invoice history
   */
  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    const user = await getDbUser(ctx.userId);

    if (!user.stripeCustomerId) {
      return { invoices: [] };
    }

    try {
      const stripeInvoices = await getStripeInvoices(user.stripeCustomerId, 20);

      const invoices = stripeInvoices.map((inv) => ({
        id: inv.id,
        date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
        description: inv.lines?.data?.[0]?.description ?? "Abonnement",
        amount: (inv.amount_paid ?? 0) / 100,
        currency: inv.currency?.toUpperCase() ?? "EUR",
        status: inv.status ?? "unknown",
        pdfUrl: inv.invoice_pdf ?? null,
      }));

      return { invoices };
    } catch {
      return { invoices: [] };
    }
  }),

  // ──────────────────────────────────────────────
  // Credit packs (Sprint 7)
  // ──────────────────────────────────────────────

  /**
   * listCreditPacks — Returns the catalog of one-time credit packs along
   * with their availability flag (priceId might not be configured for this
   * env, in which case the UI hides the card).
   */
  listCreditPacks: protectedProcedure.query(async () => {
    return CREDIT_PACKS.map((p) => ({
      id: p.id,
      credits: p.credits,
      priceEur: p.priceEur,
      available: Boolean(p.priceId),
    }));
  }),

  /**
   * purchaseCredits — Creates a Stripe Checkout session in `payment` mode
   * for a one-time credit top-up. The webhook handler grants the credits
   * once the payment succeeds.
   */
  purchaseCredits: protectedProcedure
    .input(z.object({ packId: z.enum(["small", "medium", "large"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const pack = getCreditPack(input.packId);
      if (!pack) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pack not found" });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      try {
        const url = await createCreditPackCheckout({
          userId: user.id,
          email: user.email,
          name: user.name,
          pack,
          successUrl: `${appUrl}/billing?credits_added=true`,
          cancelUrl: `${appUrl}/billing?credits_canceled=true`,
        });
        return { url };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stripe error";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
});
