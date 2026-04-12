"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  ImagePlus,
  Video,
  Plus,
} from "lucide-react";
import { format, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const today = startOfDay(new Date());

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const dayVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0.12, duration: 0.5 },
  },
};

function PostCard({
  post,
  typeLabel,
}: {
  post: {
    id: string;
    type: string;
    platforms: string[];
    scheduledAt: Date | null;
    thumbnailUrl: string | null;
    influencer: { name: string };
  };
  typeLabel: string;
}) {
  const time = post.scheduledAt
    ? format(new Date(post.scheduledAt), "HH:mm")
    : "--:--";
  const platform = post.platforms?.[0] ?? "INSTAGRAM";

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/50 bg-slate-800/30 p-2.5 transition-all hover:border-slate-700">
      {post.thumbnailUrl ? (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
          <Image
            src={post.thumbnailUrl}
            alt=""
            width={40}
            height={40}
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50">
          {post.type === "REEL" ? (
            <Video className="h-4 w-4 text-slate-400" />
          ) : (
            <ImagePlus className="h-4 w-4 text-slate-400" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {platform === "INSTAGRAM" ? (
            <InstagramIcon className="h-3 w-3 text-pink-400" />
          ) : platform === "TIKTOK" ? (
            <TikTokIcon className="h-3 w-3 text-white" />
          ) : null}
          <span className="truncate text-xs font-medium text-white">
            {post.influencer.name}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span>{time}</span>
          <span>·</span>
          <span>{typeLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function UpcomingContent() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { data: upcoming = [], isLoading } = trpc.publish.getUpcoming.useQuery();

  if (isLoading) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Prochains contenus
          </h2>
        </div>
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4">
          <div className="flex gap-3">
            <Skeleton className="h-32 w-44 shrink-0 rounded-xl bg-slate-800" />
            <Skeleton className="h-32 w-44 shrink-0 rounded-xl bg-slate-800" />
            <Skeleton className="h-32 w-44 shrink-0 rounded-xl bg-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  if (upcoming.length === 0) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {t("upcomingContent")}
          </h2>
          <Link
            href="/calendar"
            className="flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-violet-400"
          >
            {t("viewCalendar")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 text-center backdrop-blur-xl">
          <Calendar className="mb-4 h-16 w-16 text-slate-400/30" aria-hidden />
          <h3 className="text-lg font-semibold text-white">{t("noUpcoming")}</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{t("planifyHint")}</p>
          <Link
            href="/content"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <Plus className="h-4 w-4" />
            {t("createContent")}
          </Link>
        </div>
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {t("upcomingContent")}
        </h2>
        <Link
          href="/calendar"
          className="flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-violet-400"
        >
          {t("viewCalendar")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4 backdrop-blur-xl">
        <div className="-mx-4 overflow-x-auto px-4 pb-2 scrollbar-thin">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex gap-3"
            style={{ minWidth: "max-content" }}
          >
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              const dayPosts = upcoming.filter(
                (c) => c.scheduledAt && isSameDay(new Date(c.scheduledAt), day)
              );

              return (
                <motion.div
                  key={day.toISOString()}
                  variants={dayVariants}
                  className={cn(
                    "flex w-44 shrink-0 flex-col rounded-xl border p-3",
                    isToday
                      ? "border-violet-500/30 bg-violet-500/5"
                      : "border-slate-800/30 bg-slate-800/10"
                  )}
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <Calendar
                      className={cn(
                        "h-3.5 w-3.5",
                        isToday ? "text-violet-400" : "text-slate-500"
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          "text-xs font-semibold",
                          isToday ? "text-violet-400" : "text-white"
                        )}
                      >
                        {isToday
                          ? tCommon("today")
                          : format(day, "EEEE", { locale: fr })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(day, "d MMM", { locale: fr })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    {dayPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={{
                          id: post.id,
                          type: post.type,
                          platforms: post.platforms ?? [],
                          scheduledAt: post.scheduledAt,
                          thumbnailUrl: post.thumbnailUrl,
                          influencer: post.influencer,
                        }}
                        typeLabel={post.type === "REEL" ? tCommon("reel") : tCommon("photo")}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function UpcomingContentEmpty() {
  const t = useTranslations("dashboard");
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {t("upcomingContent")}
        </h2>
        <Link
          href="/calendar"
          className="flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-violet-400"
        >
          {t("viewCalendar")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 backdrop-blur-xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/50">
          <Calendar className="h-8 w-8 text-slate-600" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-400">
          {t("noUpcoming")}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {t("planifyHint")}
        </p>
        <Link
          href="/content"
          className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t("createContent")}
        </Link>
      </div>
    </div>
  );
}
