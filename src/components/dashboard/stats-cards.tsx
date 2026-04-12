"use client";

import { motion, type Variants } from "framer-motion";
import { Users, ImagePlus, Heart, Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0.15, duration: 0.6 },
  },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function StatsCards() {
  const t = useTranslations("dashboard");
  const { data, isLoading } = trpc.analytics.getDashboardStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl"
          >
            <Skeleton className="h-11 w-11 rounded-xl bg-slate-800" />
            <Skeleton className="mt-4 h-8 w-24 bg-slate-800" />
            <Skeleton className="mt-2 h-4 w-32 bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: t("activeInfluencers"),
      icon: Users,
      iconColorClass: "text-violet-400",
      iconBgClass: "bg-violet-500/10",
      value: String(data.totalInfluencers),
      subtext: t("active"),
    },
    {
      label: t("publishedContent"),
      icon: ImagePlus,
      iconColorClass: "text-blue-400",
      iconBgClass: "bg-blue-500/10",
      value: String(data.totalContents),
      subtext: t("total"),
    },
    {
      label: t("avgEngagement"),
      icon: Heart,
      iconColorClass: "text-pink-400",
      iconBgClass: "bg-pink-500/10",
      value: `${data.avgEngagement.toFixed(1)}%`,
      subtext: t("allNetworks"),
    },
    {
      label: t("creditsRemaining"),
      icon: Coins,
      iconColorClass: "text-amber-400",
      iconBgClass: "bg-amber-500/10",
      value: `${formatNumber(data.credits.remaining)}/${formatNumber(data.credits.total)}`,
      subtext: t("creditsAvailable"),
      progress: {
        value: data.credits.remaining,
        max: data.credits.total,
      },
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          variants={cardVariants}
          whileHover={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.2), 0 0 0 1px rgb(139 92 246 / 0.1)" }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl transition-colors hover:border-slate-700"
        >
          <div className="flex items-start justify-between">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl",
                stat.iconBgClass
              )}
            >
              <stat.icon className={cn("h-5 w-5", stat.iconColorClass)} />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-sm text-slate-400">{stat.subtext}</p>
          </div>

          {"progress" in stat && stat.progress && stat.progress.max > 0 && (
            <div className="mt-3">
              <Progress
                value={(stat.progress.value / stat.progress.max) * 100}
                className="h-1.5 bg-slate-800"
              />
            </div>
          )}

          <p className="mt-2 text-xs text-slate-500">{stat.label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
