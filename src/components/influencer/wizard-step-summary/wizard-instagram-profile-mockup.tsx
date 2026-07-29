"use client";

import {
  Grid3x3,
  Bookmark,
  UserSquare2,
  Lock,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { InstagramIcon } from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import {
  placeholderGradients,
  WizardSummaryStat,
} from "./wizard-summary-ui";

export function WizardInstagramProfileMockup({
  name,
  bio,
  niche,
  handle,
  portraitUrl,
  generatedImages,
  selectedImageIndex,
  stats,
}: {
  name: string;
  bio: string;
  niche: { label: string; text: string; bg: string };
  handle: string;
  portraitUrl: string | null;
  generatedImages: string[];
  selectedImageIndex: number;
  stats: { followers: number; following: number; posts: number };
}) {
  const t = useTranslations("wizard");

  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <InstagramIcon className="h-4 w-4 text-pink-400" />
            <span className="tracking-tight">{handle}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-base">≡</span>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-500 p-[2.5px]">
                <div className="h-full w-full rounded-full bg-slate-950" />
              </div>
              {portraitUrl ? (
                <img
                  src={portraitUrl}
                  alt=""
                  className="relative h-20 w-20 rounded-full object-cover ring-2 ring-slate-950"
                />
              ) : (
                <div
                  className={cn(
                    "relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-slate-950",
                    generatedImages.length > 0
                      ? (placeholderGradients[selectedImageIndex] ??
                          placeholderGradients[0])
                      : "from-slate-700 to-slate-800"
                  )}
                >
                  <span className="text-2xl font-bold text-white/40">
                    {name?.charAt(0) || "?"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-1 justify-around text-center">
              <WizardSummaryStat label={t("posts")} value={stats.posts} />
              <WizardSummaryStat
                label={t("followers")}
                value={stats.followers}
                format
              />
              <WizardSummaryStat
                label={t("following")}
                value={stats.following}
                format
              />
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-sm font-semibold text-white">
              {name || t("noName")}
            </p>
            <Badge
              className={cn(
                "border px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
                niche.bg,
                niche.text
              )}
            >
              {niche.label}
            </Badge>
            <p className="whitespace-pre-line pt-1 text-xs leading-relaxed text-slate-200">
              {bio || t("bioComingSoon")}
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled
              className="flex-1 rounded-lg bg-violet-500 py-1.5 text-xs font-semibold text-white"
            >
              {t("follow")}
            </button>
            <button
              type="button"
              disabled
              className="flex-1 rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-slate-200"
            >
              {t("message")}
            </button>
            <button
              type="button"
              disabled
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-slate-800/60 text-slate-500">
          <div className="flex items-center justify-center border-b-2 border-white py-2 text-white">
            <Grid3x3 className="h-4 w-4" />
          </div>
          <div className="flex items-center justify-center py-2">
            <UserSquare2 className="h-4 w-4" />
          </div>
          <div className="flex items-center justify-center py-2">
            <Bookmark className="h-4 w-4" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-[2px] bg-slate-800/40 p-[2px]">
          {Array.from({ length: 9 }).map((_, i) => {
            const isHero = i === 0 && portraitUrl;
            return (
              <div
                key={i}
                className={cn(
                  "relative aspect-square overflow-hidden bg-slate-900",
                  isHero && "ring-1 ring-violet-500/40"
                )}
              >
                {isHero ? (
                  <img
                    src={portraitUrl ?? undefined}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800/70">
                    <Lock className="h-3 w-3 text-slate-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-800/60 px-4 py-3 text-center">
          <p className="text-[11px] italic text-slate-500">{t("nextPostsHint")}</p>
        </div>
      </div>
    </div>
  );
}
