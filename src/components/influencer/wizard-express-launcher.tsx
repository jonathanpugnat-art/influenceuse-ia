"use client";

import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { buildExpressWizardPatch } from "@/lib/wizard-express";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";

export function WizardExpressLauncher({
  onStarted,
}: {
  onStarted: () => void;
}) {
  const t = useTranslations("wizard");
  const { updateData, setStep, setExpressMode, reset } = useInfluencerWizard();
  const { data: plan } = trpc.billing.getCurrentPlan.useQuery();
  const credits = plan?.creditsRemaining ?? 0;
  const cost = CREDIT_COSTS.BASE_IMAGE;

  const startExpress = () => {
    if (credits < cost) {
      toast.error(t("insufficientCredits"));
      return;
    }
    reset();
    const patch = buildExpressWizardPatch();
    updateData(patch);
    setExpressMode(true);
    setStep(2);
    onStarted();
    toast.info(t("expressStarted"));
  };

  return (
    <button
      type="button"
      onClick={startExpress}
      className="flex w-full items-center gap-3 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-4 text-left transition-all hover:border-amber-400/60 hover:from-amber-500/20"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
        <Zap className="h-5 w-5 text-amber-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{t("expressTitle")}</p>
        <p className="mt-0.5 text-xs text-slate-400">{t("expressSubtitle")}</p>
      </div>
      <span className="shrink-0 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-200">
        ~30s
      </span>
    </button>
  );
}
