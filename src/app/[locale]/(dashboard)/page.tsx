"use client";

import { motion, type Variants } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { InfluencerGrid } from "@/components/dashboard/influencer-grid";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingContent } from "@/components/dashboard/upcoming-content";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05 },
  },
};

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome header */}
      <motion.div
        variants={sectionVariants}
        className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl md:p-8"
      >
        {/* Gradient glows */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/10 blur-[80px]" />
        <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-[60px]" />

        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <span className="text-sm font-medium text-violet-400">
              {tCommon("welcome")}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-slate-400 md:text-base">
            {t("subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Phase 6 — Activation checklist (auto-hidden when complete) */}
      <motion.div variants={sectionVariants}>
        <OnboardingChecklist />
      </motion.div>

      {/* Section 1 — Stats */}
      <motion.div variants={sectionVariants}>
        <StatsCards />
      </motion.div>

      {/* Section 2 — Two columns: Influencers + Activity */}
      <motion.div
        variants={sectionVariants}
        className="grid grid-cols-1 gap-8 xl:grid-cols-3"
      >
        {/* Left: 2/3 — Influencer Grid */}
        <div className="xl:col-span-2">
          <InfluencerGrid />
        </div>

        {/* Right: 1/3 — Recent Activity */}
        <div className="xl:col-span-1">
          <RecentActivity />
        </div>
      </motion.div>

      {/* Section 3 — Upcoming Content */}
      <motion.div variants={sectionVariants}>
        <UpcomingContent />
      </motion.div>
    </motion.div>
  );
}
