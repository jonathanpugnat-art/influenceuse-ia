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
});
