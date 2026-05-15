"use client";

import { Check, X, Star, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PLANS } from "@/lib/constants";
import { isBetaFreeMode } from "@/lib/payments";

interface PlanFeature {
  label: string;
  included: boolean;
}

interface PlanCard {
  id: string;
  name: string;
  price: number;
  priceId: string | null;
  popular: boolean;
  features: PlanFeature[];
}

// All numbers (price, credits, max influencers, feature flags) come from
// `PLANS` so the in-app billing screen is always consistent with the
// public landing/pricing pages and with what we provision after Stripe
// checkout.
const fmtCredits = (n: number): string =>
  Number.isFinite(n) ? `${n} crédits/mois` : "Crédits illimités";
const fmtInfluencers = (n: number): string => {
  if (!Number.isFinite(n)) return "Influenceuses illimitées";
  return n === 1 ? "1 influenceuse" : `${n} influenceuses`;
};

const plans: PlanCard[] = [
  {
    id: "FREE",
    name: PLANS.FREE.name,
    price: PLANS.FREE.price,
    priceId: null,
    popular: false,
    features: [
      { label: fmtInfluencers(PLANS.FREE.maxInfluencers), included: true },
      { label: fmtCredits(PLANS.FREE.credits), included: true },
      { label: "Génération de photos", included: true },
      { label: "Génération de vidéos", included: PLANS.FREE.hasVideo },
      { label: "Publication automatique", included: PLANS.FREE.hasAutoPublish },
      {
        label: "Analytics avancés",
        included: PLANS.FREE.hasAdvancedAnalytics,
      },
    ],
  },
  {
    id: "STARTER",
    name: PLANS.STARTER.name,
    price: PLANS.STARTER.price,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? null,
    popular: false,
    features: [
      { label: fmtInfluencers(PLANS.STARTER.maxInfluencers), included: true },
      { label: fmtCredits(PLANS.STARTER.credits), included: true },
      { label: "Génération de photos", included: true },
      { label: "Génération de vidéos", included: PLANS.STARTER.hasVideo },
      {
        label: "Publication automatique",
        included: PLANS.STARTER.hasAutoPublish,
      },
      {
        label: "Analytics avancés",
        included: PLANS.STARTER.hasAdvancedAnalytics,
      },
    ],
  },
  {
    id: "PRO",
    name: PLANS.PRO.name,
    price: PLANS.PRO.price,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? null,
    popular: true,
    features: [
      { label: fmtInfluencers(PLANS.PRO.maxInfluencers), included: true },
      { label: fmtCredits(PLANS.PRO.credits), included: true },
      { label: "Génération de photos", included: true },
      { label: "Génération de vidéos", included: PLANS.PRO.hasVideo },
      {
        label: "Publication automatique",
        included: PLANS.PRO.hasAutoPublish,
      },
      {
        label: "Analytics avancés",
        included: PLANS.PRO.hasAdvancedAnalytics,
      },
    ],
  },
  {
    id: "ENTERPRISE",
    name: PLANS.ENTERPRISE.name,
    price: PLANS.ENTERPRISE.price,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ?? null,
    popular: false,
    features: [
      {
        label: fmtInfluencers(PLANS.ENTERPRISE.maxInfluencers),
        included: true,
      },
      { label: fmtCredits(PLANS.ENTERPRISE.credits), included: true },
      { label: "Génération de vidéos", included: true },
      { label: "Génération batch", included: true },
      { label: "Analytics avancés", included: true },
      { label: "Support prioritaire", included: true },
    ],
  },
];

export function PricingCards() {
  const { data: currentPlan } = trpc.billing.getCurrentPlan.useQuery();
  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err.message),
  });

  const userPlan = currentPlan?.plan ?? "FREE";

  const handleUpgrade = (priceId: string | null) => {
    if (!priceId) {
      toast.error("Prix non configuré. Contactez le support.");
      return;
    }
    checkoutMutation.mutate({ priceId });
  };

  // Plan ranking — ordered low → high so we can derive upgrade / downgrade
  // states by index comparison instead of hand-coding every pair.
  const TIER_ORDER = ["FREE", "STARTER", "PRO", "ENTERPRISE"] as const;
  const userTier = TIER_ORDER.indexOf(
    userPlan as (typeof TIER_ORDER)[number]
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => {
        const isCurrent = userPlan === plan.id;
        const planTier = TIER_ORDER.indexOf(
          plan.id as (typeof TIER_ORDER)[number]
        );
        const isUpgrade = planTier > userTier;
        const isDowngrade = planTier < userTier;

        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-2xl border p-6 backdrop-blur-xl transition-all",
              plan.popular
                ? "border-violet-500/50 bg-slate-900/80 shadow-lg shadow-violet-500/10 md:scale-105 md:z-10"
                : "border-slate-800/50 bg-slate-900/50"
            )}
          >
            {/* Popular badge */}
            {plan.popular && (
              <Badge className="absolute -top-3 right-4 border-0 bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-1 text-xs text-white">
                <Star className="mr-1 h-3 w-3" />
                Populaire
              </Badge>
            )}

            {/* Header */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  {plan.price}€
                </span>
                <span className="text-sm text-slate-400">/mois</span>
              </div>
            </div>

            {/* Features */}
            <ul className="mb-6 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5">
                  {f.included ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <X className="h-4 w-4 shrink-0 text-slate-600" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      f.included ? "text-slate-300" : "text-slate-600"
                    )}
                  >
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Button — during the v0.11 closed bêta every paid plan is
                gated behind a "Bêta gratuite" pill so users don't try to
                pay while Stripe is still in TEST mode. We keep the
                checkout flow untouched and just flip the CTA. */}
            {isBetaFreeMode() && plan.id !== "FREE" ? (
              <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-medium text-violet-200">
                <Sparkles className="h-3.5 w-3.5" />
                Bêta gratuite
              </div>
            ) : isCurrent ? (
              <button
                disabled
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 text-sm text-slate-400"
              >
                Plan actuel
              </button>
            ) : isUpgrade ? (
              <button
                onClick={() => handleUpgrade(plan.priceId)}
                disabled={checkoutMutation.isPending}
                className={cn(
                  "w-full rounded-xl py-2.5 text-sm font-medium text-white transition-all",
                  plan.popular
                    ? "bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30"
                    : "bg-violet-600 hover:bg-violet-500"
                )}
              >
                {checkoutMutation.isPending ? "Redirection..." : `Upgrader vers ${plan.name}`}
              </button>
            ) : isDowngrade ? (
              <button
                disabled
                className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-500"
              >
                Downgrader
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

