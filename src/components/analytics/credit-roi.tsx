"use client";

import { useTranslations } from "next-intl";
import { Coins, TrendingUp, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RoiRow {
  influencerId: string;
  influencerName: string;
  postsCount: number;
  creditsSpent: number;
  views: number;
  likes: number;
  viewsPerCredit: number;
  likesPerCredit: number;
}

/**
 * Sprint 8 — ROI per influencer card.
 * Shows views/credit and likes/credit so the user can identify which
 * influencers actually drive value vs sink credits.
 */
export function CreditRoi({
  rows,
  isLoading,
}: {
  rows: RoiRow[] | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("analytics.roi");

  if (isLoading) {
    return (
      <Skeleton className="h-[280px] rounded-2xl border border-slate-800/50 bg-slate-900/50" />
    );
  }

  if (!rows?.length) return null;

  const max = Math.max(...rows.map((r) => r.viewsPerCredit), 1);

  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Coins className="h-4 w-4 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
      </div>
      <p className="mb-4 text-xs text-slate-400">{t("subtitle")}</p>

      <div className="space-y-3">
        {rows.map((row) => {
          const pct = (row.viewsPerCredit / max) * 100;
          return (
            <div key={row.influencerId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-white">{row.influencerName}</span>
                <span className="text-xs text-slate-500">
                  {row.postsCount} {t("posts")} · {row.creditsSpent} {t("credits")}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                  )}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-400">
                  <Eye className="h-3 w-3" />
                  <span className="font-semibold text-white">
                    {row.viewsPerCredit.toLocaleString()}
                  </span>{" "}
                  {t("viewsPerCredit")}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <TrendingUp className="h-3 w-3" />
                  <span className="font-semibold text-white">
                    {row.likesPerCredit.toLocaleString()}
                  </span>{" "}
                  {t("likesPerCredit")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
