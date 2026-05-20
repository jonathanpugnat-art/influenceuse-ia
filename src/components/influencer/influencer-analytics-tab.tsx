"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Users,
  UserPlus,
  ImagePlus,
  Eye,
  Heart,
  TrendingUp,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GrowthChart } from "@/components/analytics/growth-chart";
import { TopContent } from "@/components/analytics/top-content";
import { PlatformBreakdown } from "@/components/analytics/platform-breakdown";
import { BestHoursHeatmap } from "@/components/analytics/best-hours-heatmap";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "7d" as const, label: "7 jours" },
  { value: "30d" as const, label: "30 jours" },
  { value: "90d" as const, label: "90 jours" },
  { value: "all" as const, label: "Tout" },
] as const;

function formatStatValue(value: number, type: "number" | "percent" = "number"): string {
  if (type === "percent") return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("fr-FR");
}

interface InfluencerAnalyticsTabProps {
  influencerId: string;
}

export function InfluencerAnalyticsTab({ influencerId }: InfluencerAnalyticsTabProps) {
  const t = useTranslations("influencer.profileTabs");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [metric, setMetric] = useState<"followers" | "engagement" | "views" | "likes">("views");
  const [visiblePlatforms, setVisiblePlatforms] = useState<Record<string, boolean>>({
    TIKTOK: true,
    INSTAGRAM: true,
    ONLYFANS: true,
  });

  const { data: overview, isLoading: loadingOverview } =
    trpc.analytics.getOverviewStats.useQuery({
      influencerId,
      period,
    });
  const { data: growthData, isLoading: loadingGrowth } =
    trpc.analytics.getGrowthData.useQuery({
      influencerId,
      metric,
      period,
    });
  const { data: contentPerf } = trpc.analytics.getContentPerformance.useQuery({
    influencerId,
    period,
  });
  const { data: platformBreakdown } = trpc.analytics.getPlatformBreakdown.useQuery({
    influencerId,
  });
  const { data: bestHours, isLoading: loadingBestHours } =
    trpc.analytics.getBestPostingHours.useQuery({
      influencerId,
      period,
    });

  const togglePlatform = (platform: string) => {
    setVisiblePlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const statCards = useMemo(() => {
    if (!overview) return [];
    return [
      {
        key: "totalFollowers",
        label: "Total followers",
        value: overview.totalFollowers,
        change: overview.totalFollowersChange,
        icon: Users,
        iconColor: "text-cyan-400",
        iconBg: "bg-cyan-500/10",
      },
      {
        key: "newFollowers",
        label: "Nouveaux followers",
        value: overview.newFollowers,
        change: overview.newFollowersChange,
        icon: UserPlus,
        iconColor: "text-emerald-400",
        iconBg: "bg-emerald-500/10",
      },
      {
        key: "contentsPublished",
        label: "Contenus publiés",
        value: overview.contentsPublished,
        change: overview.contentsPublishedChange,
        icon: ImagePlus,
        iconColor: "text-violet-400",
        iconBg: "bg-violet-500/10",
      },
      {
        key: "totalViews",
        label: "Vues totales",
        value: overview.totalViews,
        change: overview.totalViewsChange,
        icon: Eye,
        iconColor: "text-blue-400",
        iconBg: "bg-blue-500/10",
      },
      {
        key: "totalLikes",
        label: "Likes totaux",
        value: overview.totalLikes,
        change: overview.totalLikesChange,
        icon: Heart,
        iconColor: "text-pink-400",
        iconBg: "bg-pink-500/10",
      },
      {
        key: "avgEngagement",
        label: "Engagement moyen",
        value: overview.avgEngagement,
        change: overview.avgEngagementChange,
        icon: TrendingUp,
        iconColor: "text-amber-400",
        iconBg: "bg-amber-500/10",
        format: "percent" as const,
      },
    ];
  }, [overview]);

  const hasPublishedData =
    (overview?.contentsPublished ?? 0) > 0 || (contentPerf?.top?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">{t("analyticsSubtitle")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as typeof period)}
          >
            <SelectTrigger className="w-[140px] border-slate-700 bg-slate-900/50 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            asChild
            variant="outline"
            className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Link href={`/analytics?influencer=${influencerId}`}>
              {t("viewFullAnalytics")}
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {!loadingOverview && !hasPublishedData ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-12 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-slate-600" aria-hidden />
          <h3 className="text-lg font-semibold text-white">{t("analyticsEmptyTitle")}</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{t("analyticsEmptyHint")}</p>
          <Button asChild className="mt-4">
            <Link href={`/content/photo?influencer=${influencerId}`}>
              {t("createContent")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loadingOverview
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-[100px] rounded-2xl border border-slate-800/50 bg-slate-900/50"
                  />
                ))
              : statCards.map((stat) => (
                  <div
                    key={stat.key}
                    className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4 backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          stat.iconBg
                        )}
                      >
                        <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                      </div>
                      {stat.change != null && (
                        <div
                          className={cn(
                            "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium",
                            stat.change >= 0
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          )}
                        >
                          {stat.change >= 0 ? "+" : ""}
                          {stat.change}%
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-xl font-bold text-white">
                      {stat.format === "percent"
                        ? `${stat.value.toFixed(1)}%`
                        : formatStatValue(stat.value)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
                  </div>
                ))}
          </div>

          {loadingGrowth ? (
            <Skeleton className="h-[320px] w-full rounded-2xl border border-slate-800/50 bg-slate-900/50" />
          ) : growthData?.length ? (
            <GrowthChart
              data={growthData}
              metric={metric}
              onMetricChange={setMetric}
              visiblePlatforms={visiblePlatforms}
              onTogglePlatform={togglePlatform}
            />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <TopContent items={contentPerf?.top ?? []} />
            <PlatformBreakdown data={platformBreakdown ?? []} />
          </div>

          <BestHoursHeatmap data={bestHours} isLoading={loadingBestHours} />
        </>
      )}
    </div>
  );
}
