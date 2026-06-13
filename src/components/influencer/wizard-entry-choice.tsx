"use client";

import { MessageCircleHeart, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { buildExpressWizardPatch } from "@/lib/wizard-express";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";

/**
 * Entry screen — forces a single deliberate choice between the guided Aura
 * conversation and the ~30s express flow, instead of showing both plus the
 * form at once (the previous step-1 cognitive overload).
 */
export function WizardEntryChoice({ onStarted }: { onStarted?: () => void }) {
  const t = useTranslations("wizard");
  const { updateData, setStep, setExpressMode, setEntryMode, reset } =
    useInfluencerWizard();
  const { data: plan } = trpc.billing.getCurrentPlan.useQuery();
  const credits = plan?.creditsRemaining ?? 0;
  const cost = CREDIT_COSTS.BASE_IMAGE;

  const startGuided = () => {
    setEntryMode("guided");
    onStarted?.();
  };

  const startExpress = () => {
    if (credits < cost) {
      toast.error(t("insufficientCredits"));
      return;
    }
    reset();
    updateData(buildExpressWizardPatch());
    setExpressMode(true);
    setEntryMode("express");
    setStep(2);
    onStarted?.();
    toast.info(t("expressStarted"));
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">{t("entryTitle")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("entrySubtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={startGuided}
          className="group flex flex-col rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/15 to-indigo-500/10 p-5 text-left transition-all hover:border-violet-400/70 hover:from-violet-500/25"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/20">
              <MessageCircleHeart className="h-5 w-5 text-violet-300" />
            </div>
            <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[10px] font-bold uppercase text-violet-200">
              {t("entryGuidedBadge")}
            </span>
          </div>
          <p className="text-base font-semibold text-white">
            {t("entryGuidedTitle")}
          </p>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-400">
            {t("entryGuidedDesc")}
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-medium text-violet-300 group-hover:text-violet-200">
            {t("entryGuidedCta")} →
          </span>
        </button>

        <button
          type="button"
          onClick={startExpress}
          className="group flex flex-col rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-orange-500/10 p-5 text-left transition-all hover:border-amber-400/70 hover:from-amber-500/25"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20">
              <Zap className="h-5 w-5 text-amber-300" />
            </div>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-200">
              {t("entryExpressBadge")}
            </span>
          </div>
          <p className="text-base font-semibold text-white">
            {t("entryExpressTitle")}
          </p>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-400">
            {t("entryExpressDesc")}
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-medium text-amber-300 group-hover:text-amber-200">
            {t("entryExpressCta")} →
          </span>
        </button>
      </div>
    </div>
  );
}
