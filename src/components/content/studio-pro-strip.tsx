"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

export function StudioProStrip({ variant }: { variant: "photo" | "reel" }) {
  const t = useTranslations("content");
  return (
    <div className="flex items-center justify-center gap-2 border-b border-slate-800/50 bg-slate-900/50 px-4 py-2">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400/80" />
      <p className="text-center text-[11px] leading-snug text-slate-500">
        {variant === "photo" ? t("studioProStripPhoto") : t("studioProStripReel")}
      </p>
    </div>
  );
}
