"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { OnlyFansIcon } from "@/components/ui/social-icons";
import { formatFollowers } from "@/lib/influencer-utils";
import { cn } from "@/lib/utils";

export function WizardOfProfileMockup({
  name,
  bio,
  brief,
  niche,
  handle,
  portraitUrl,
  stats,
}: {
  name: string;
  bio: string;
  brief?: string;
  niche: { label: string; text: string; bg: string };
  handle: string;
  portraitUrl: string | null;
  stats: { photos: number; videos: number; likes: number };
}) {
  const t = useTranslations("wizard");

  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-blue-500/10">
        <div className="relative h-28 bg-gradient-to-r from-blue-600 via-sky-500 to-blue-400">
          {portraitUrl ? (
            <img
              src={portraitUrl}
              alt=""
              className="h-full w-full object-cover opacity-40 blur-sm"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
          <div className="absolute left-4 top-3 flex items-center gap-1.5 text-sm font-semibold text-white">
            <OnlyFansIcon className="h-4 w-4" />
            <span>OnlyFans</span>
          </div>
        </div>

        <div className="relative px-4 pb-4">
          <div className="-mt-10 flex items-end gap-3">
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt=""
                className="h-20 w-20 rounded-full border-4 border-slate-950 object-cover ring-2 ring-blue-500/40"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-950 bg-gradient-to-br from-blue-600 to-sky-500 ring-2 ring-blue-500/40">
                <span className="text-2xl font-bold text-white/80">
                  {name?.charAt(0) || "?"}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-sm font-semibold text-white">
                {name || t("noName")}
              </p>
              <p className="truncate text-xs text-slate-400">@{handle}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className="border-blue-500/30 bg-blue-500/10 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              Premium
            </Badge>
            <Badge
              className={cn(
                "border px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
                niche.bg,
                niche.text
              )}
            >
              {niche.label}
            </Badge>
          </div>

          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-200">
            {bio || t("bioComingSoon")}
          </p>

          {brief?.trim() && (
            <p className="mt-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-[11px] italic text-violet-200/90">
              {brief}
            </p>
          )}

          <div className="mt-3 flex gap-4 text-center text-xs text-slate-400">
            <span>
              {stats.photos} {t("ofPhotos")}
            </span>
            <span>
              {stats.videos} {t("ofVideos")}
            </span>
            <span>
              {formatFollowers(stats.likes)} {t("ofLikes")}
            </span>
          </div>

          <button
            type="button"
            disabled
            className="mt-3 w-full rounded-full bg-blue-500 py-2 text-xs font-semibold text-white"
          >
            {t("ofSubscribeMock")}
          </button>

          <div className="mt-4 grid grid-cols-3 gap-[2px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden bg-slate-900"
              >
                {i === 0 && portraitUrl ? (
                  <>
                    <img
                      src={portraitUrl}
                      alt=""
                      className="h-full w-full object-cover blur-md brightness-75"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
                      <Lock className="h-4 w-4 text-white/80" />
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                    <Lock className="h-3 w-3 text-slate-600" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] italic text-slate-500">
            {t("ofNextContentHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
