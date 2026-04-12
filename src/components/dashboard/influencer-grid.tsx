"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { Plus, ArrowRight, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TikTokIcon, InstagramIcon, OnlyFansIcon } from "@/components/ui/social-icons";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const NICHE_STYLES: Record<string, { color: string; bg: string }> = {
  FASHION: { color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  FITNESS: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  LIFESTYLE: { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  TRAVEL: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  TECH: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  GAMING: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  ADULT: { color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  FOOD: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
};

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "INSTAGRAM":
      return <InstagramIcon className="h-3.5 w-3.5 text-pink-400" />;
    case "TIKTOK":
      return <TikTokIcon className="h-3.5 w-3.5 text-white" />;
    case "ONLYFANS":
      return <OnlyFansIcon className="h-3.5 w-3.5 text-blue-400" />;
    default:
      return null;
  }
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0.15, duration: 0.5 },
  },
};

export function InfluencerGrid() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { data, isLoading } = trpc.influencer.getAll.useQuery({
    limit: 6,
    status: "ACTIVE",
  });

  const influencers = data?.influencers ?? [];
  const hasInfluencers = influencers.length > 0;

  if (isLoading) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t("myInfluencers")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[200px] rounded-2xl bg-slate-800/50" />
          <Skeleton className="h-[200px] rounded-2xl bg-slate-800/50" />
          <Skeleton className="h-[200px] rounded-2xl bg-slate-800/50" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t("myInfluencers")}</h2>
        <Link
          href="/influencers"
          className="flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-violet-400"
        >
          {t("viewAll")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <motion.div variants={itemVariants}>
          <Link
            href="/influencers/new"
            className="group flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-transparent p-6 transition-all hover:border-violet-500 hover:bg-violet-500/5"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 text-slate-500 transition-all group-hover:border-violet-500 group-hover:bg-violet-500/10 group-hover:text-violet-400">
              <Plus className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-400 transition-colors group-hover:text-violet-400">
              Nouvelle influenceuse
            </p>
          </Link>
        </motion.div>

        {!hasInfluencers ? (
          <motion.div variants={itemVariants} className="sm:col-span-2 lg:col-span-2">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 text-center backdrop-blur-xl">
              <Users className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
              <h3 className="text-lg font-semibold text-white">{t("noActiveInfluencers")}</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-400">{t("createFirstDesc")}</p>
              <Link
                href="/influencers/new"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <Plus className="h-4 w-4" />
                {t("createFirstCta")}
              </Link>
            </div>
          </motion.div>
        ) : (
          influencers.map((influencer) => {
            const nicheStyle = NICHE_STYLES[influencer.niche] ?? {
              color: "text-slate-400",
              bg: "bg-slate-500/10 border-slate-500/20",
            };
            const socials = influencer.socialAccounts.filter((s) => s.followers > 0 || s.isConnected);
            return (
              <motion.div key={influencer.id} variants={itemVariants}>
                <motion.div whileHover={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.2), 0 0 0 1px rgb(139 92 246 / 0.1)" }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                <Link
                  href={`/influencers/${influencer.id}`}
                  className="group block rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5 backdrop-blur-xl transition-colors hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  <div className="flex items-start gap-4">
                    {influencer.avatarUrl ? (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-violet-500/50">
                        <Image
                          src={influencer.avatarUrl}
                          alt={influencer.name}
                          width={56}
                          height={56}
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-violet-500/50",
                          "from-violet-500 to-indigo-500"
                        )}
                      >
                        <span className="text-lg font-bold text-white">
                          {influencer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-white">
                        {influencer.name}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge
                          className={cn("border px-2 py-0 text-xs", nicheStyle.bg, nicheStyle.color)}
                        >
                          {influencer.niche}
                        </Badge>
                        <Badge
                          className={cn(
                            "border px-2 py-0 text-xs",
                            influencer.status === "ACTIVE"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                          )}
                        >
                          {influencer.status === "ACTIVE" ? "Active" : "En pause"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {socials.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {socials.map((social) => (
                        <div
                          key={social.platform}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-800/50 px-2.5 py-1"
                        >
                          <PlatformIcon platform={social.platform} />
                          <span className="text-xs font-medium text-slate-300">
                            {formatFollowers(social.followers)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
                </motion.div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
