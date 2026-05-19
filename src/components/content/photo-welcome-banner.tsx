"use client";

import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

type Props = {
  influencerName: string;
  portraitUrl?: string | null;
  onDismiss: () => void;
};

/** Shown after wizard create when landing on /content/photo?welcome=1 */
export function PhotoWelcomeBanner({
  influencerName,
  portraitUrl,
  onDismiss,
}: Props) {
  const t = useTranslations("content");

  return (
    <div className="relative flex items-start gap-4 border-b border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent px-4 py-3 md:px-6">
      {portraitUrl ? (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-violet-500/30">
          <Image
            src={portraitUrl}
            alt={influencerName}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
          <Sparkles className="h-6 w-6 text-violet-400" />
        </div>
      )}
      <div className="min-w-0 flex-1 pr-8">
        <p className="text-sm font-semibold text-white">
          {t("welcomeBannerTitle", { name: influencerName })}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
          {t("welcomeBannerSubtitle")}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800/50 hover:text-white"
        aria-label={t("welcomeBannerDismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
