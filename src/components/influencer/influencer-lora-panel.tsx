"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PLANS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { cn } from "@/lib/utils";
import { useUpgradeOnLimitError } from "@/hooks/use-upgrade-on-limit-error";

export function InfluencerLoraPanel({
  influencerId,
  isNsfw,
}: {
  influencerId: string;
  isNsfw: boolean;
}) {
  const t = useTranslations("influencer");
  const utils = trpc.useUtils();
  const handleUpgrade = useUpgradeOnLimitError();
  const { data: plan } = useCurrentPlan();
  const planCfg = plan ? PLANS[plan.plan as keyof typeof PLANS] : null;
  const hasLoraPlan = planCfg?.hasCharacterLora ?? false;

  const { data, isLoading } = trpc.influencer.getLoraStatus.useQuery(
    { influencerId },
    { enabled: Boolean(influencerId) && !isNsfw, refetchInterval: 30_000 }
  );

  const trainMutation = trpc.influencer.trainCharacterLora.useMutation({
    onSuccess: () => {
      toast.success(t("loraTrainingStarted"));
      void utils.influencer.getLoraStatus.invalidate({ influencerId });
    },
    onError: (e) => {
      if (handleUpgrade(e.message)) return;
      toast.error(e.message);
    },
  });

  if (isNsfw) return null;

  const status = data?.status ?? "NONE";
  const training = status === "TRAINING" || trainMutation.isPending;
  const ready = status === "READY";
  const failed = status === "FAILED";
  const creditCost = data?.creditCost ?? 40;

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{t("loraTitle")}</p>
          <p className="mt-1 text-xs text-slate-400">{t("loraSubtitle")}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
            ready && "bg-emerald-500/20 text-emerald-300",
            training && "bg-amber-500/20 text-amber-200",
            failed && "bg-red-500/20 text-red-300",
            !ready && !training && !failed && "bg-slate-700 text-slate-300"
          )}
        >
          {isLoading ? "…" : t(`loraStatus_${status}`)}
        </span>
      </div>

      {!hasLoraPlan ? (
        <p className="mt-3 text-xs text-amber-200/90">{t("loraProRequired")}</p>
      ) : null}

      {ready && data?.triggerWord ? (
        <p className="mt-3 text-xs text-slate-400">
          {t("loraReadyHint", { trigger: data.triggerWord })}
        </p>
      ) : null}

      {failed ? (
        <p className="mt-3 text-xs text-red-300/90">{t("loraFailedHint")}</p>
      ) : null}

      {!ready && (
        <button
          type="button"
          disabled={training || isLoading || !hasLoraPlan}
          onClick={() => trainMutation.mutate({ influencerId })}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {training ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {training
            ? t("loraTrainingInProgress")
            : t("loraTrainCta", { cost: creditCost })}
        </button>
      )}
    </div>
  );
}
