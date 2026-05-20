"use client";

import { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ImagePlus,
  Pencil,
  MoreHorizontal,
  Pause,
  Play,
  Archive,
  Users,
  BarChart3,
  Calendar,
  Settings,
  Image,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TikTokIcon,
  InstagramIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { InfluencerFeed } from "@/components/influencer/influencer-feed";
import { InfluencerSettings } from "@/components/influencer/influencer-settings";
import { InfluencerSocial } from "@/components/influencer/influencer-social";
import { InfluencerAnalyticsTab } from "@/components/influencer/influencer-analytics-tab";
import { InfluencerCalendarTab } from "@/components/influencer/influencer-calendar-tab";
import { trpc } from "@/lib/trpc";
import {
  nicheConfig,
  statusConfig,
  formatFollowers,
} from "@/lib/influencer-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const PROFILE_TABS = ["feed", "analytics", "calendar", "social", "settings"] as const;
  type ProfileTab = (typeof PROFILE_TABS)[number];

  const tabFromUrl = searchParams.get("tab");
  const initialTab: ProfileTab = PROFILE_TABS.includes(tabFromUrl as ProfileTab)
    ? (tabFromUrl as ProfileTab)
    : "feed";
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  useEffect(() => {
    if (PROFILE_TABS.includes(tabFromUrl as ProfileTab)) {
      setActiveTab(tabFromUrl as ProfileTab);
    }
  }, [tabFromUrl]);

  const { data: influencer, isLoading, error } = trpc.influencer.getById.useQuery({ id });

  const statusMutation = trpc.influencer.updateStatus.useMutation({
    onSuccess: () => {
      utils.influencer.getById.invalidate({ id });
      toast.success("Statut mis à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error || !influencer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Users className="h-12 w-12 text-slate-600" />
        <h2 className="mt-4 text-lg font-semibold text-white">
          Influenceuse introuvable
        </h2>
        <Link
          href="/influencers"
          className="mt-4 text-sm text-violet-400 hover:underline"
        >
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  const niche = nicheConfig[influencer.niche] ?? nicheConfig.FASHION;
  const status = statusConfig[influencer.status] ?? statusConfig.ACTIVE;

  const totalFollowers = influencer.socialAccounts.reduce(
    (sum, s) => sum + s.followers,
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Back link */}
      <Link
        href="/influencers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Mes Influenceuses
      </Link>

      {/* Profile header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
        {/* Gradient top bar based on niche */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500" />

        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Avatar */}
            <div className="relative h-24 w-24 shrink-0 md:h-28 md:w-28">
              <div className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 opacity-40 blur-sm" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-800 ring-2 ring-violet-500/50">
                {influencer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={influencer.avatarUrl}
                    alt={influencer.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {influencer.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                {influencer.name}
              </h1>
              <p className="mt-2 text-sm text-slate-400">{influencer.bio}</p>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge
                  className={cn(
                    "border px-2.5 py-0.5 text-xs",
                    niche.bg,
                    niche.text
                  )}
                >
                  {niche.label}
                </Badge>
                <Badge
                  className={cn(
                    "border px-2.5 py-0.5 text-xs",
                    status.bg,
                    status.text
                  )}
                >
                  {status.label}
                </Badge>
                {/* NSFW/SFW badge — hidden for now */}
              </div>

              {/* Inline stats */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-violet-400" />
                  <strong className="text-white">
                    {formatFollowers(totalFollowers)}
                  </strong>{" "}
                  followers
                </span>
                <span className="flex items-center gap-1.5">
                  <Image className="h-4 w-4 text-blue-400" aria-hidden role="img" aria-label="" />
                  <strong className="text-white">
                    {influencer._count.contents}
                  </strong>{" "}
                  contenus
                </span>
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  <strong className="text-white">
                    {influencer.analytics?.avgEngagement?.toFixed(1) ?? "0.0"}%
                  </strong>{" "}
                  engagement
                </span>
              </div>

              {/* Social accounts */}
              <div className="mt-3 flex flex-wrap gap-2">
                {influencer.socialAccounts.map((s) => (
                  <div
                    key={s.platform}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-800/50 px-2.5 py-1"
                  >
                    {s.platform === "INSTAGRAM" && (
                      <InstagramIcon className="h-3.5 w-3.5 text-pink-400" />
                    )}
                    {s.platform === "TIKTOK" && (
                      <TikTokIcon className="h-3.5 w-3.5 text-white" />
                    )}
                    {s.platform === "ONLYFANS" && (
                      <OnlyFansIcon className="h-3.5 w-3.5 text-blue-400" />
                    )}
                    <span className="text-xs font-medium text-slate-300">
                      {formatFollowers(s.followers)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/content/photo?influencer=${id}`}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <ImagePlus className="h-4 w-4" />
                <span className="hidden sm:inline">Créer du contenu</span>
              </Link>
              <Link
                href={`/influencers/${id}/edit`}
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Modifier</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 border-slate-800 bg-slate-900"
                >
                  {influencer.status === "ACTIVE" ? (
                    <DropdownMenuItem
                      onClick={() =>
                        statusMutation.mutate({ id, status: "PAUSED" })
                      }
                      className="text-yellow-400 focus:bg-slate-800"
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Mettre en pause
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() =>
                        statusMutation.mutate({ id, status: "ACTIVE" })
                      }
                      className="text-emerald-400 focus:bg-slate-800"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Réactiver
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    onClick={() =>
                      statusMutation.mutate({ id, status: "ARCHIVED" })
                    }
                    className="text-red-400 focus:bg-slate-800"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archiver
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="space-y-4">
        <TabsList className="h-auto gap-1 rounded-xl border border-slate-800/50 bg-slate-900/50 p-1">
          <TabsTrigger
            value="feed"
            className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400"
          >
            <Image className="mr-2 h-4 w-4" aria-hidden role="img" aria-label="" />
            Feed
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Calendrier
          </TabsTrigger>
          <TabsTrigger
            value="social"
            className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Réseaux
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400"
          >
            <Settings className="mr-2 h-4 w-4" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <InfluencerFeed
            contents={influencer.contents.map((c) => ({
              id: c.id,
              type: c.type,
              status: c.status,
              mediaUrls: c.mediaUrls,
              thumbnailUrl: c.thumbnailUrl,
              platforms: c.platforms,
              caption: c.caption,
            }))}
            totalContents={influencer._count.contents}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl md:p-8">
            <InfluencerAnalyticsTab influencerId={id} />
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl md:p-8">
            <InfluencerCalendarTab influencerId={id} />
          </div>
        </TabsContent>

        <TabsContent value="social">
          <InfluencerSocial influencerId={id} />
        </TabsContent>

        <TabsContent value="settings">
          <InfluencerSettings
            influencer={{
              id: influencer.id,
              name: influencer.name,
              bio: influencer.bio,
              personality: influencer.personality,
              niche: influencer.niche,
              age: influencer.age,
              style: (influencer.style as Record<string, string>) ?? {},
              isNsfw: influencer.isNsfw,
            }}
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-40 bg-slate-800/50" />
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-8">
        <div className="flex items-start gap-6">
          <Skeleton className="h-28 w-28 rounded-full bg-slate-800/50" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-60 bg-slate-800/50" />
            <Skeleton className="h-4 w-full max-w-md bg-slate-800/50" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full bg-slate-800/50" />
              <Skeleton className="h-6 w-16 rounded-full bg-slate-800/50" />
            </div>
            <Skeleton className="h-4 w-48 bg-slate-800/50" />
          </div>
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-md bg-slate-800/50" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl bg-slate-800/50" />
        ))}
      </div>
    </div>
  );
}
