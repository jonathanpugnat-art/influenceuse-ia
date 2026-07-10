"use client";

import Link from "next/link";
import { AlertCircle, Coins } from "lucide-react";
import { useTranslations } from "next-intl";

export function AppearanceCreditsPanel({
  cost,
  creditsRemaining,
  hasEnoughCredits,
}: {
  cost: number;
  creditsRemaining: number;
  hasEnoughCredits: boolean;
}) {
  const t = useTranslations("wizard");

  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-800/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Coins className="h-4 w-4 text-amber-400" />
          <span>{t("generationCost", { cost })}</span>
        </div>
        <div className="text-sm text-slate-400">
          {t("creditsLeft", { count: creditsRemaining })}
        </div>
      </div>

      {!hasEnoughCredits && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-200">
              {t("insufficientCredits")}
            </p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              {t("insufficientCreditsHint", { cost })}
            </p>
            <Link
              href="/billing"
              className="mt-2 inline-flex items-center rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/30"
            >
              {t("seeOffers")}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
