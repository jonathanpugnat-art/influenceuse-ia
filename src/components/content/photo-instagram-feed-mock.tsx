"use client";

import Image from "next/image";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type FeedAspect = "square" | "portrait";

export function PhotoInstagramFeedMock({
  username,
  avatarUrl,
  imageUrl,
  scenePreviewUrl,
  caption,
  hashtags = [],
  isLoading = false,
  loadingLabel,
  aspect = "square",
  className,
}: {
  username: string;
  avatarUrl?: string | null;
  imageUrl?: string | null;
  /** Scene plate before influencer compose (step 1). */
  scenePreviewUrl?: string | null;
  caption?: string;
  hashtags?: string[];
  isLoading?: boolean;
  loadingLabel?: string;
  aspect?: FeedAspect;
  className?: string;
}) {
  const t = useTranslations("content");
  const displayUrl = imageUrl ?? scenePreviewUrl;
  const isSceneOnly = Boolean(scenePreviewUrl && !imageUrl);

  const hashtagLine =
    hashtags.length > 0
      ? hashtags
          .slice(0, 8)
          .map((h) => (h.startsWith("#") ? h : `#${h}`))
          .join(" ")
      : "";

  return (
    <div
      className={cn(
        "mx-auto w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-black shadow-2xl shadow-black/50",
        className
      )}
    >
      {/* IG header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-pink-500 p-[2px]">
            <div className="relative h-full w-full overflow-hidden rounded-full bg-slate-900">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{username}</p>
            <p className="truncate text-[10px] text-slate-500">{t("studioFeedPreview")}</p>
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
      </div>

      {/* Media */}
      <div
        className={cn(
          "relative w-full bg-slate-900",
          aspect === "square" ? "aspect-square" : "aspect-[4/5]"
        )}
      >
        {isLoading ? (
          <>
            <Skeleton className="absolute inset-0 h-full w-full bg-slate-800/50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              <p className="text-xs text-slate-400">{loadingLabel ?? t("generating")}</p>
            </div>
          </>
        ) : displayUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl} alt="" className="h-full w-full object-cover" />
            {isSceneOnly && (
              <span className="absolute left-2 top-2 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                {t("studioScenePreviewBadge")}
              </span>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="h-14 w-14 rounded-xl border border-dashed border-slate-600 bg-slate-800/30" />
            <p className="text-xs text-slate-500">{t("studioFeedEmpty")}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-3.5 text-white">
          <Heart className="h-6 w-6" strokeWidth={1.5} />
          <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
          <Send className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <Bookmark className="h-6 w-6 text-white" strokeWidth={1.5} />
      </div>

      {/* Caption */}
      <div className="space-y-1 px-3 pb-4 text-left">
        <p className="text-xs font-semibold text-white">
          {t("studioFeedLikes")}
        </p>
        <p className="text-sm leading-snug text-slate-200">
          <span className="font-semibold text-white">{username}</span>{" "}
          {caption?.trim() ? (
            <span className="text-slate-300">{caption}</span>
          ) : (
            <span className="italic text-slate-500">{t("studioCaptionPlaceholder")}</span>
          )}
        </p>
        {hashtagLine ? (
          <p className="text-xs text-violet-300/80">{hashtagLine}</p>
        ) : null}
      </div>
    </div>
  );
}
