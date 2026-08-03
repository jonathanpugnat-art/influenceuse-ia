"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  MoreHorizontal,
  Eye,
  ImagePlus,
  Pause,
  Play,
  Archive,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TikTokIcon,
  InstagramIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import { nicheConfig, statusConfig, formatFollowers } from "@/lib/influencer-utils";

export interface InfluencerCardData {
  id: string;
  name: string;
  slug: string;
  bio: string;
  niche: string;
  status: string;
  isNsfw: boolean;
  avatarUrl?: string | null;
  socialAccounts: {
    platform: string;
    followers: number;
    isConnected: boolean;
  }[];
  analytics?: {
    avgEngagement: number;
  } | null;
  _count: { contents: number };
}

const NICHE_KEYS: Record<string, string> = {
  FASHION: "nicheFashion",
  FITNESS: "nicheFitness",
  LIFESTYLE: "nicheLifestyle",
  TRAVEL: "nicheTravel",
  TECH: "nicheTech",
  GAMING: "nicheGaming",
  ADULT: "nicheAdult",
  FOOD: "nicheFood",
};

const STATUS_KEYS: Record<string, string> = {
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
};

export function InfluencerCard({
  influencer,
  onStatusChange,
}: {
  influencer: InfluencerCardData;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const t = useTranslations("influencer");
  const niche = nicheConfig[influencer.niche] ?? nicheConfig.FASHION;
  const status = statusConfig[influencer.status] ?? statusConfig.ACTIVE;
  const nicheLabel = t(NICHE_KEYS[influencer.niche] ?? "nicheFashion");
  const statusLabel = t(STATUS_KEYS[influencer.status] ?? "active");

  const getSocial = (platform: string) =>
    influencer.socialAccounts.find((s) => s.platform === platform);

  const insta = getSocial("INSTAGRAM");
  const tiktok = getSocial("TIKTOK");
  const onlyfans = getSocial("ONLYFANS");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative surface transition-all hover:border-border hover:shadow-lg hover:shadow-black/30"
    >
      {/* Menu */}
      <div className="absolute right-3 top-3 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-100 transition-all hover:bg-accent hover:text-foreground md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 border-border bg-popover"
          >
            <DropdownMenuItem asChild>
              <Link
                href={`/influencers/${influencer.id}`}
                className="text-foreground focus:bg-accent"
              >
                <Eye className="mr-2 h-4 w-4" />
                {t("viewProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/content?influencer=${influencer.id}`}
                className="text-foreground focus:bg-accent"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {t("createContent")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            {influencer.status === "ACTIVE" ? (
              <DropdownMenuItem
                onClick={() => onStatusChange?.(influencer.id, "PAUSED")}
                className="text-yellow-400 focus:bg-accent focus:text-yellow-300"
              >
                <Pause className="mr-2 h-4 w-4" />
                {t("pauseAction")}
              </DropdownMenuItem>
            ) : influencer.status === "PAUSED" ? (
              <DropdownMenuItem
                onClick={() => onStatusChange?.(influencer.id, "ACTIVE")}
                className="text-emerald-400 focus:bg-accent focus:text-emerald-300"
              >
                <Play className="mr-2 h-4 w-4" />
                {t("reactivateAction")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => onStatusChange?.(influencer.id, "ARCHIVED")}
              className="text-red-400 focus:bg-accent focus:text-red-300"
            >
              <Archive className="mr-2 h-4 w-4" />
              {t("archiveAction")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Clickable body */}
      <Link href={`/influencers/${influencer.id}`} className="block p-5">
        {/* Avatar + Info */}
        <div className="flex items-start gap-4">
          <div className="relative h-[72px] w-[72px] shrink-0">
            <div className="relative flex h-full w-full items-center justify-center rounded-full border border-border bg-muted">
              {influencer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={influencer.avatarUrl}
                  alt={influencer.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-foreground">
                  {influencer.name.charAt(0)}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <h3 className="truncate text-lg font-semibold text-white">
              {influencer.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                className={cn(
                  "border px-2 py-0 text-xs",
                  niche.bg,
                  niche.text
                )}
              >
                {nicheLabel}
              </Badge>
              <Badge
                className={cn(
                  "border px-2 py-0 text-xs",
                  status.bg,
                  status.text
                )}
              >
                {statusLabel}
              </Badge>
              {/* NSFW badge — hidden for now */}
            </div>
          </div>
        </div>

        {/* Bio */}
        <p className="mt-3 line-clamp-2 text-sm text-slate-400">
          {influencer.bio}
        </p>

        {/* Social stats */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SocialBadge
            icon={<InstagramIcon className="h-3.5 w-3.5 text-pink-400" />}
            followers={insta?.followers}
            connected={insta?.isConnected}
          />
          <SocialBadge
            icon={<TikTokIcon className="h-3.5 w-3.5 text-white" />}
            followers={tiktok?.followers}
            connected={tiktok?.isConnected}
          />
          <SocialBadge
            icon={<OnlyFansIcon className="h-3.5 w-3.5 text-blue-400" />}
            followers={onlyfans?.followers}
            connected={onlyfans?.isConnected}
          />
        </div>

        {/* Footer stats */}
        <div className="mt-4 flex items-center gap-4 border-t border-slate-800/50 pt-3 text-xs text-slate-500">
          <span>{t("contentsCount", { count: influencer._count.contents })}</span>
          <span>·</span>
          <span>
            {influencer.analytics?.avgEngagement?.toFixed(1) ?? "0.0"}%
            {t("engagement")}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function SocialBadge({
  icon,
  followers,
  connected,
}: {
  icon: React.ReactNode;
  followers?: number;
  connected?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1",
        connected ? "bg-slate-800/50" : "bg-slate-800/20 opacity-40"
      )}
    >
      {icon}
      <span className="text-xs font-medium text-slate-300">
        {followers ? formatFollowers(followers) : "—"}
      </span>
    </div>
  );
}

