"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  Users,
  UserPlus,
  ImagePlus,
  Eye,
  Heart,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
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
import { PerformanceTable } from "@/components/analytics/performance-table";
import { CreditRoi } from "@/components/analytics/credit-roi";
import { BestHoursHeatmap } from "@/components/analytics/best-hours-heatmap";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "7d" as const, label: "7 jours" },
  { value: "30d" as const, label: "30 jours" },
  { value: "90d" as const, label: "90 jours" },
  { value: "all" as const, label: "Tout" },
] as const;

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0.12, duration: 0.6 },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

function formatStatValue(value: number, type: "number" | "percent" = "number"): string {
  if (type === "percent") return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("fr-FR");
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const influencerFromUrl = searchParams.get("influencer");

  const [manualInfluencerId, setManualInfluencerId] = useState<string | "all">("all");
  const influencerId = influencerFromUrl ?? manualInfluencerId;
  const setInfluencerId = setManualInfluencerId;
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [metric, setMetric] = useState<"followers" | "engagement" | "views" | "likes">("views");
  const [visiblePlatforms, setVisiblePlatforms] = useState<Record<string, boolean>>({
    TIKTOK: true,
    INSTAGRAM: true,
    ONLYFANS: true,
  });
  const [tablePage, setTablePage] = useState(1);
  const [tableSortBy, setTableSortBy] = useState<string | undefined>("engagement");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("desc");

  const effectiveInfluencerId = influencerId === "all" ? undefined : influencerId;

  const { data: influencers, isLoading: loadingInfluencers } =
    trpc.influencer.getAll.useQuery({ limit: 50 });
  const firstInfluencerId = influencers?.influencers?.[0]?.id;

  const { data: overview, isLoading: loadingOverview } =
    trpc.analytics.getOverviewStats.useQuery({
      influencerId: effectiveInfluencerId,
      period,
    });
  const { data: growthData, isLoading: loadingGrowth } =
    trpc.analytics.getGrowthData.useQuery(
      {
        influencerId: effectiveInfluencerId ?? firstInfluencerId ?? "",
        metric,
        period,
      },
      { enabled: !!effectiveInfluencerId || !!firstInfluencerId }
    );
  const { data: contentPerf } = trpc.analytics.getContentPerformance.useQuery({
    influencerId: effectiveInfluencerId,
    period,
  });
  const { data: platformBreakdown } = trpc.analytics.getPlatformBreakdown.useQuery({
    influencerId: effectiveInfluencerId,
  });
  const { data: tableData, isLoading: loadingTable } =
    trpc.analytics.getPerformanceTable.useQuery({
      influencerId: effectiveInfluencerId,
      period,
      page: tablePage,
      limit: 10,
      sortBy: tableSortBy,
      sortOrder: tableSortOrder,
    });
  const { data: roiRows, isLoading: loadingRoi } =
    trpc.analytics.getCreditROI.useQuery({ period });
  const { data: bestHours, isLoading: loadingBestHours } =
    trpc.analytics.getBestPostingHours.useQuery({
      influencerId: effectiveInfluencerId,
      period,
    });

  const togglePlatform = (platform: string) => {
    setVisiblePlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const handleTableSort = (sortBy: string, sortOrder: "asc" | "desc") => {
    setTableSortBy(sortBy);
    setTableSortOrder(sortOrder);
    setTablePage(1);
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
        label: "Total vues",
        value: overview.totalViews,
        change: overview.totalViewsChange,
        icon: Eye,
        iconColor: "text-blue-400",
        iconBg: "bg-blue-500/10",
      },
      {
        key: "totalLikes",
        label: "Total likes",
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

  const isLoading = loadingOverview;
  const hasInfluencers = (influencers?.influencers?.length ?? 0) > 0;
  const hasTableRows = (tableData?.rows?.length ?? 0) > 0;

  if (!loadingInfluencers && !isLoading && !hasInfluencers) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Performances et métriques de vos influenceuses
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 text-center">
          <Users className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
          <h3 className="text-lg font-semibold text-white">Aucune influenceuse</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">
            Créez une influenceuse et publiez du contenu pour voir les analytics.
          </p>
          <Button asChild className="mt-4">
            <Link href="/influencers/new">Créer une influenceuse</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div
        variants={sectionVariants}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Performances et métriques de vos influenceuses
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={influencerId}
            onValueChange={(v) => {
              setInfluencerId(v as string);
              setTablePage(1);
            }}
          >
            <SelectTrigger className="w-[200px] border-slate-700 bg-slate-900/50 text-white">
              <SelectValue placeholder="Influenceuse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {influencers?.influencers.map((inf) => (
                <SelectItem key={inf.id} value={inf.id}>
                  {inf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v as "7d" | "30d" | "90d" | "all");
              setTablePage(1);
            }}
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
        </div>
      </motion.div>

      {/* Section 1 — Stats Overview (6 cards) */}
      <motion.section variants={sectionVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading
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
                      {stat.change >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3 rotate-180" />
                      )}
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
      </motion.section>

      {/* Section 2 — Growth chart */}
      <motion.section variants={sectionVariants}>
        {loadingGrowth ? (
          <Skeleton className="h-[360px] w-full rounded-2xl border border-slate-800/50 bg-slate-900/50" />
        ) : growthData?.length ? (
          <GrowthChart
            data={growthData}
            metric={metric}
            onMetricChange={setMetric}
            visiblePlatforms={visiblePlatforms}
            onTogglePlatform={togglePlatform}
          />
        ) : null}
      </motion.section>

      {/* Section 3 — Two columns: Top content + Platform breakdown */}
      <motion.section
        variants={sectionVariants}
        className="grid gap-6 lg:grid-cols-2"
      >
        <TopContent items={contentPerf?.top ?? []} />
        <PlatformBreakdown data={platformBreakdown ?? []} />
      </motion.section>

      {/* Section 3b — Sprint 8: ROI + Best posting hours */}
      <motion.section
        variants={sectionVariants}
        className="grid gap-6 lg:grid-cols-2"
      >
        <CreditRoi rows={roiRows} isLoading={loadingRoi} />
        <BestHoursHeatmap data={bestHours} isLoading={loadingBestHours} />
      </motion.section>

      {/* Section 4 — Performance table */}
      <motion.section variants={sectionVariants}>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Tableau de performance
        </h2>
        {loadingTable ? (
          <Skeleton className="h-[400px] w-full rounded-2xl border border-slate-800/50 bg-slate-900/50" />
        ) : tableData && !hasTableRows ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 text-center">
            <BarChart3 className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
            <h3 className="text-lg font-semibold text-white">Aucune donnée pour cette période</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              Publiez du contenu pour voir les performances ici.
            </p>
            <Button asChild className="mt-4">
              <Link href="/content">Créer du contenu</Link>
            </Button>
          </div>
        ) : tableData ? (
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <PerformanceTable
              rows={tableData.rows}
              total={tableData.total}
              page={tablePage}
              limit={10}
              sortBy={tableSortBy}
              sortOrder={tableSortOrder}
              onPageChange={setTablePage}
              onSort={handleTableSort}
            />
          </div>
        ) : null}
      </motion.section>
    </motion.div>
  );
}
