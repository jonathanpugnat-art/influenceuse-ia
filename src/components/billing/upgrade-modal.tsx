"use client";

import { create } from "zustand";
import { useTranslations } from "next-intl";
import { Sparkles, Zap, ShieldCheck, Crown, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/constants";

export type UpgradeReason =
  | "max_influencers"
  | "credits_exhausted"
  | "video_required"
  | "auto_publish_required"
  | "advanced_analytics_required"
  | "content_plan_required"
  | "batch_required"
  | "webhooks_required"
  | "character_lora_required";

interface UpgradeModalState {
  open: boolean;
  reason: UpgradeReason | null;
  /** Minimum plan required to unlock the gated feature. */
  minPlan: "STARTER" | "PRO" | "ENTERPRISE";
  show: (reason: UpgradeReason, minPlan?: "STARTER" | "PRO" | "ENTERPRISE") => void;
  hide: () => void;
}

/**
 * Shared store: any component can call `useUpgradeModal.getState().show(reason)`
 * to surface the upgrade flow without prop-drilling. The modal renders
 * once globally inside the dashboard layout.
 */
export const useUpgradeModal = create<UpgradeModalState>((set) => ({
  open: false,
  reason: null,
  minPlan: "PRO",
  show: (reason, minPlan = "PRO") => set({ open: true, reason, minPlan }),
  hide: () => set({ open: false, reason: null }),
}));

const PLAN_PRICE_IDS: Record<"STARTER" | "PRO" | "ENTERPRISE", string | null> = {
  STARTER: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? null,
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? null,
  ENTERPRISE: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ?? null,
};

/**
 * Modal shown when a user hits a feature gate or limit. Explains *why* and
 * proposes the cheapest plan that unlocks the feature with a 1-click checkout.
 */
export function UpgradeModal() {
  const t = useTranslations("billing.upgradeModal");
  const { open, reason, minPlan, hide } = useUpgradeModal();

  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e) => toast.error(e.message),
  });

  const upgrade = () => {
    const priceId = PLAN_PRICE_IDS[minPlan];
    if (!priceId) {
      toast.error(t("noPriceConfigured"));
      return;
    }
    checkout.mutate({ priceId });
  };

  if (!reason) return null;

  const reasonContent = {
    max_influencers: { icon: Sparkles, key: "maxInfluencers" },
    credits_exhausted: { icon: Zap, key: "creditsExhausted" },
    video_required: { icon: Crown, key: "videoRequired" },
    auto_publish_required: { icon: ShieldCheck, key: "autoPublishRequired" },
    advanced_analytics_required: { icon: Crown, key: "advancedAnalyticsRequired" },
    content_plan_required: { icon: Sparkles, key: "contentPlanRequired" },
    batch_required: { icon: Crown, key: "batchRequired" },
    webhooks_required: { icon: ShieldCheck, key: "webhooksRequired" },
    character_lora_required: { icon: Sparkles, key: "characterLoraRequired" },
  }[reason];

  const Icon = reasonContent.icon;
  const benefits = [
    t(`benefits.${minPlan}.0`),
    t(`benefits.${minPlan}.1`),
    t(`benefits.${minPlan}.2`),
    t(`benefits.${minPlan}.3`),
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && hide()}>
      <DialogContent className="border-violet-500/30 bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <div
            className={cn(
              "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl",
              "bg-gradient-to-br from-violet-500/30 to-indigo-500/30"
            )}
          >
            <Icon className="h-6 w-6 text-violet-300" />
          </div>
          <DialogTitle className="text-xl text-white">
            {t(`reasons.${reasonContent.key}.title`)}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t(`reasons.${reasonContent.key}.description`)}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-violet-300">
              {t("recommended")}
            </span>
            <span className="text-2xl font-bold text-white">
              {minPlan === "STARTER"
                ? `${PLANS.STARTER.price}€`
                : minPlan === "PRO"
                  ? `${PLANS.PRO.price}€`
                  : `${PLANS.ENTERPRISE.price}€`}
              <span className="text-sm font-normal text-slate-400">/mois</span>
            </span>
          </div>
          <p className="mb-3 text-sm font-semibold text-white">
            {t(`planNames.${minPlan}`)}
          </p>
          <ul className="space-y-1.5">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={hide} className="flex-1">
            {t("later")}
          </Button>
          <Button
            onClick={upgrade}
            disabled={checkout.isPending}
            className="flex-1 bg-gradient-to-r from-violet-500 to-indigo-500 hover:opacity-90"
          >
            {checkout.isPending ? t("loading") : t("upgradeCta")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
