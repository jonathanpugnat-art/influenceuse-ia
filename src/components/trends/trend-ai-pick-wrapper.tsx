"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { TrendCard, type TrendCardProps } from "@/components/trends/trend-card";
import { cn } from "@/lib/utils";

export type WeeklyDayHint =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export interface TrendAiPickWrapperProps {
  whyItWorks: string;
  suggestedAngle?: string;
  confidence: "high" | "medium";
  dayHint?: WeeklyDayHint;
  preferredStudio?: "photo" | "reel";
  trendCardProps: TrendCardProps;
}

export function TrendAiPickWrapper({
  whyItWorks,
  suggestedAngle,
  confidence,
  dayHint,
  preferredStudio,
  trendCardProps,
}: TrendAiPickWrapperProps) {
  const t = useTranslations("trends");

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 rounded-xl border-l-2 border-rose-400/70 bg-muted/30 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-rose-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-rose-300">
            {t("whyItWorks")}
          </span>
          {dayHint ? (
            <Badge
              variant="outline"
              className="border-rose-400/40 text-[10px] font-semibold text-rose-200"
            >
              {t(`dayHint.${dayHint}` as never)}
            </Badge>
          ) : null}
          {preferredStudio ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {preferredStudio === "reel"
                ? t("preferredStudioReel")
                : t("preferredStudioPhoto")}
            </Badge>
          ) : null}
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-[10px]",
              confidence === "high"
                ? "text-foreground/80"
                : "text-muted-foreground"
            )}
          >
            {confidence === "high" ? t("confidenceHigh") : t("confidenceMedium")}
          </Badge>
        </div>
        <p className="text-sm leading-snug text-foreground/90">{whyItWorks}</p>
        {suggestedAngle ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{t("suggestedAngle")}: </span>
            {suggestedAngle}
          </p>
        ) : null}
      </div>
      <TrendCard {...trendCardProps} />
    </div>
  );
}
