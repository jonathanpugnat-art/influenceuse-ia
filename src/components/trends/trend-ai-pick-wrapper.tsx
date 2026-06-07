"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { TrendCard, type TrendCardProps } from "@/components/trends/trend-card";
import { cn } from "@/lib/utils";

export interface TrendAiPickWrapperProps {
  whyItWorks: string;
  suggestedAngle?: string;
  confidence: "high" | "medium";
  trendCardProps: TrendCardProps;
}

export function TrendAiPickWrapper({
  whyItWorks,
  suggestedAngle,
  confidence,
  trendCardProps,
}: TrendAiPickWrapperProps) {
  const t = useTranslations("trends");

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-rose-400/50 bg-gradient-to-b from-rose-500/5 to-transparent p-1",
        "shadow-[0_0_24px_-8px_rgba(244,63,94,0.35)]"
      )}
    >
      <div className="mb-2 space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-rose-300" />
          <span className="text-xs font-semibold uppercase tracking-wide text-rose-200">
            {t("whyItWorks")}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "ml-auto border-rose-400/40 text-[10px]",
              confidence === "high" ? "text-rose-200" : "text-rose-300/80"
            )}
          >
            {confidence === "high" ? t("confidenceHigh") : t("confidenceMedium")}
          </Badge>
        </div>
        <p className="text-sm leading-snug text-neutral-100">{whyItWorks}</p>
        {suggestedAngle ? (
          <p className="text-xs text-rose-200/70">
            <span className="font-medium text-rose-200/90">{t("suggestedAngle")}: </span>
            {suggestedAngle}
          </p>
        ) : null}
      </div>
      <TrendCard {...trendCardProps} />
    </div>
  );
}
