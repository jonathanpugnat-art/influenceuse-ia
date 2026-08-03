"use client";

import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  influencerName: string;
  portraitUrl?: string | null;
  isPremium?: boolean;
  onDismiss: () => void;
};

/** Shown after wizard create when landing on /content/photo?welcome=1 */
export function PhotoWelcomeBanner({
  influencerName,
  portraitUrl,
  isPremium = false,
  onDismiss,
}: Props) {
  const t = useTranslations("content");

  return (
    <div
      className={cn(
        "relative flex items-start gap-4 border-b border-border/60 bg-card/40 px-4 py-3 md:px-6",
        isPremium && "bg-card/60"
      )}
    >
      {portraitUrl ? (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border">
          <Image
            src={portraitUrl}
            alt={influencerName}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
          <Sparkles className="h-6 w-6 text-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1 pr-8">
        <p className="text-sm font-semibold text-foreground">
          {t("welcomeBannerTitle", { name: influencerName })}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {t("welcomeBannerSubtitle")}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        aria-label={t("welcomeBannerDismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
