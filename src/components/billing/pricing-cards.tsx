"use client";

import { Check, X, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const plans: PlanCard[] = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    priceId: null,
    popular: false,
    features: [
      { label: "1 influenceuse", included: true },
      { label: "50 crédits/mois", included: true },
      { label: "Génération de photos", included: true },
      { label: "Génération de vidéos", included: false },
      { label: "Contenu NSFW", included: false },
      { label: "Publication automatique", included: false },
      { label: "Analytics avancés", included: false },
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 29,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? null,
    popular: true,
    features: [
      { label: "5 influenceuses", included: true },
      { label: "500 crédits/mois", included: true },
      { label: "Génération de photos", included: true },
      { label: "Génération de vidéos", included: true },
      { label: "Contenu NSFW", included: true },
      { label: "Publication automatique", included: true },
      { label: "Analytics avancés", included: false },
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ?? null,
    popular: false,
    features: [
      { label: "Influenceuses illimitées", included: true },
      { label: "Crédits illimités", included: true },
      { label: "Tout inclus", included: true },
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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = userPlan === plan.id;
        const isUpgrade =
          (userPlan === "FREE" && plan.id !== "FREE") ||
          (userPlan === "PRO" && plan.id === "ENTERPRISE");
        const isDowngrade =
          (userPlan === "PRO" && plan.id === "FREE") ||
          (userPlan === "ENTERPRISE" && plan.id !== "ENTERPRISE");

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

            {/* Button */}
            {isCurrent ? (
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

