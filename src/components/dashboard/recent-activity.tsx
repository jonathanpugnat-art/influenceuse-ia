"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  Upload,
  Sparkles,
  UserPlus,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ActivityType = "content_published" | "content_ready" | "influencer_created";

const activityConfig: Record<
  ActivityType,
  { icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  content_published: {
    icon: Upload,
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
  },
  content_ready: {
    icon: Sparkles,
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-500/10",
  },
  influencer_created: {
    icon: UserPlus,
    colorClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
  },
};

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, bounce: 0.1, duration: 0.4 },
  },
};

export function RecentActivity() {
  const t = useTranslations("dashboard");
  const { data: activities = [], isLoading } =
    trpc.analytics.getRecentActivity.useQuery();

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-white">
        {t("recentActivity")}
      </h2>

      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg bg-slate-800" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full max-w-[200px] bg-slate-800" />
                  <Skeleton className="mt-1 h-3 w-20 bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="max-h-[500px] overflow-y-auto p-4 scrollbar-thin"
          >
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Activity className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
                <h3 className="text-lg font-semibold text-white">{t("noActivity")}</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-400">
                  Créez du contenu ou une influenceuse pour voir l&apos;activité ici.
                </p>
                <Button asChild className="mt-4" variant="default">
                  <Link href="/content">{t("createContent")}</Link>
                </Button>
              </div>
            ) : (
              activities.map((activity, index) => {
                const config = activityConfig[activity.type];
                const Icon = config?.icon ?? Sparkles;

                return (
                  <motion.div key={activity.id} variants={itemVariants}>
                    <div className="flex items-start gap-3 py-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          config?.bgClass ?? "bg-slate-500/10"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            config?.colorClass ?? "text-slate-400"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-300">{activity.text}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDistanceToNow(
                            new Date(activity.timestamp),
                            { addSuffix: true, locale: fr }
                          )}
                        </p>
                      </div>
                    </div>
                    {index < activities.length - 1 && (
                      <Separator className="bg-slate-800/50" />
                    )}
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
